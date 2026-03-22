//! Per-entity trust scores (plugins, command patterns, workflows).

use chrono::Utc;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone, Copy)]
pub enum TrustEvent {
    Success,
    Failure,
    UserApproved,
    UserDenied,
}

fn adjust_score(current: f64, event: TrustEvent) -> f64 {
    match event {
        TrustEvent::Success => (current + 2.0_f64).min(95.0),
        TrustEvent::Failure => (current - 8.0_f64).max(5.0),
        TrustEvent::UserApproved => (current + 5.0_f64).min(95.0),
        TrustEvent::UserDenied => (current - 10.0_f64).max(5.0),
    }
}

fn hash_command_id(command: &str) -> String {
    let mut h = DefaultHasher::new();
    command.trim().hash(&mut h);
    format!("cmd:{:016x}", h.finish())
}

/// Maps a task_outcomes row to trust entity (plugin name or hashed shell command).
pub fn entity_for_task(plugin: &str, command: &str) -> (&'static str, String) {
    if plugin == "shell" {
        ("command_pattern", hash_command_id(command))
    } else {
        ("plugin", plugin.to_string())
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrustScoreDto {
    pub entity_type: String,
    pub entity_id: String,
    pub score: f64,
    pub total_runs: i64,
    pub successful_runs: i64,
    pub failed_runs: i64,
    pub last_run: Option<String>,
    pub last_failure: Option<String>,
    pub user_overrides: i64,
    pub pinned: Option<String>,
}

async fn fetch_row(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
) -> Result<Option<TrustScoreDto>, sqlx::Error> {
    let row = sqlx::query(
        r#"SELECT entity_type, entity_id, score, total_runs, successful_runs, failed_runs,
                  last_run, last_failure, user_overrides, pinned
           FROM trust_scores WHERE entity_type = ? AND entity_id = ?"#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| TrustScoreDto {
        entity_type: r.get::<String, _>("entity_type"),
        entity_id: r.get::<String, _>("entity_id"),
        score: r.get::<f64, _>("score"),
        total_runs: r.get::<i64, _>("total_runs"),
        successful_runs: r.get::<i64, _>("successful_runs"),
        failed_runs: r.get::<i64, _>("failed_runs"),
        last_run: r.try_get::<Option<String>, _>("last_run").ok().flatten(),
        last_failure: r.try_get::<Option<String>, _>("last_failure").ok().flatten(),
        user_overrides: r.get::<i64, _>("user_overrides"),
        pinned: r.try_get::<Option<String>, _>("pinned").ok().flatten(),
    }))
}

/// Updates trust after a recorded task outcome (shell → command_pattern; else plugin entity).
pub async fn apply_outcome_from_task(
    pool: &SqlitePool,
    plugin: &str,
    command: &str,
    success: bool,
) -> Result<(), sqlx::Error> {
    let (etype, eid) = entity_for_task(plugin, command);
    let existing = fetch_row(pool, etype, &eid).await?;
    let now = Utc::now().to_rfc3339();
    let event = if success {
        TrustEvent::Success
    } else {
        TrustEvent::Failure
    };

    let (score, total_runs, successful_runs, failed_runs, last_failure, user_overrides) =
        match existing {
            Some(r) => {
                if r.pinned.as_deref() == Some("whitelist") {
                    return Ok(());
                }
                let score = adjust_score(r.score, event);
                let total_runs = r.total_runs + 1;
                let successful_runs = r.successful_runs + if success { 1 } else { 0 };
                let failed_runs = r.failed_runs + if success { 0 } else { 1 };
                let last_failure = if success {
                    r.last_failure
                } else {
                    Some(now.clone())
                };
                (
                    score,
                    total_runs,
                    successful_runs,
                    failed_runs,
                    last_failure,
                    r.user_overrides,
                )
            }
            None => {
                let score = adjust_score(50.0, event);
                let successful_runs = if success { 1 } else { 0 };
                let failed_runs = if success { 0 } else { 1 };
                let last_failure = if success {
                    None
                } else {
                    Some(now.clone())
                };
                (score, 1, successful_runs, failed_runs, last_failure, 0)
            }
        };

    sqlx::query(
        r#"INSERT INTO trust_scores (
            entity_type, entity_id, score, total_runs, successful_runs, failed_runs,
            last_run, last_failure, user_overrides, pinned
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(entity_type, entity_id) DO UPDATE SET
            score = excluded.score,
            total_runs = excluded.total_runs,
            successful_runs = excluded.successful_runs,
            failed_runs = excluded.failed_runs,
            last_run = excluded.last_run,
            last_failure = excluded.last_failure,
            user_overrides = excluded.user_overrides"#,
    )
    .bind(etype)
    .bind(&eid)
    .bind(score)
    .bind(total_runs)
    .bind(successful_runs)
    .bind(failed_runs)
    .bind(&now)
    .bind(&last_failure)
    .bind(user_overrides)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn record_user_decision(
    pool: &SqlitePool,
    entity_type: String,
    entity_id: String,
    approved: bool,
) -> Result<(), sqlx::Error> {
    let event = if approved {
        TrustEvent::UserApproved
    } else {
        TrustEvent::UserDenied
    };
    let row = fetch_row(pool, &entity_type, &entity_id).await?;
    let now = Utc::now().to_rfc3339();
    if let Some(mut r) = row {
        if matches!(r.pinned.as_deref(), Some("whitelist" | "blacklist")) {
            return Ok(());
        }
        r.score = adjust_score(r.score, event);
        r.user_overrides += 1;
        r.last_run = Some(now);
        sqlx::query(
            r#"UPDATE trust_scores SET score = ?, user_overrides = ?, last_run = ?
               WHERE entity_type = ? AND entity_id = ?"#,
        )
        .bind(r.score)
        .bind(r.user_overrides)
        .bind(&r.last_run)
        .bind(&entity_type)
        .bind(&entity_id)
        .execute(pool)
        .await?;
    } else {
        let score = adjust_score(50.0, event);
        sqlx::query(
            r#"INSERT INTO trust_scores (
                entity_type, entity_id, score, total_runs, successful_runs, failed_runs,
                last_run, last_failure, user_overrides, pinned
            ) VALUES (?, ?, ?, 0, 0, 0, ?, NULL, 1, NULL)"#,
        )
        .bind(&entity_type)
        .bind(&entity_id)
        .bind(score)
        .bind(&now)
        .execute(pool)
        .await?;
    }
    Ok(())
}

pub async fn get_trust_score(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
) -> Result<Option<TrustScoreDto>, sqlx::Error> {
    fetch_row(pool, entity_type, entity_id).await
}

pub async fn get_trust_for_plugin_action(
    pool: &SqlitePool,
    plugin: &str,
    command_summary: &str,
) -> Result<Option<TrustScoreDto>, sqlx::Error> {
    let (etype, eid) = entity_for_task(plugin, command_summary);
    get_trust_score(pool, etype, &eid).await
}

pub async fn list_trust_scores(pool: &SqlitePool) -> Result<Vec<TrustScoreDto>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT entity_type, entity_id, score, total_runs, successful_runs, failed_runs,
                  last_run, last_failure, user_overrides, pinned
           FROM trust_scores ORDER BY score DESC"#,
    )
    .fetch_all(pool)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        out.push(TrustScoreDto {
            entity_type: r.get::<String, _>("entity_type"),
            entity_id: r.get::<String, _>("entity_id"),
            score: r.get::<f64, _>("score"),
            total_runs: r.get::<i64, _>("total_runs"),
            successful_runs: r.get::<i64, _>("successful_runs"),
            failed_runs: r.get::<i64, _>("failed_runs"),
            last_run: r.try_get::<Option<String>, _>("last_run").ok().flatten(),
            last_failure: r.try_get::<Option<String>, _>("last_failure").ok().flatten(),
            user_overrides: r.get::<i64, _>("user_overrides"),
            pinned: r.try_get::<Option<String>, _>("pinned").ok().flatten(),
        });
    }
    Ok(out)
}

pub async fn reset_trust_score(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE trust_scores SET score = 50.0 WHERE entity_type = ? AND entity_id = ?"#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_pinned(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    pinned: Option<&str>,
) -> Result<(), sqlx::Error> {
    let (score, pin) = match pinned {
        Some("whitelist") => (100.0_f64, Some("whitelist")),
        Some("blacklist") => (0.0_f64, Some("blacklist")),
        _ => {
            sqlx::query(
                r#"UPDATE trust_scores SET pinned = NULL WHERE entity_type = ? AND entity_id = ?"#,
            )
            .bind(entity_type)
            .bind(entity_id)
            .execute(pool)
            .await?;
            return Ok(());
        }
    };

    sqlx::query(
        r#"INSERT INTO trust_scores (entity_type, entity_id, score, total_runs, successful_runs, failed_runs, last_run, last_failure, user_overrides, pinned)
           VALUES (?, ?, ?, 0, 0, 0, NULL, NULL, 0, ?)
           ON CONFLICT(entity_type, entity_id) DO UPDATE SET
             score = excluded.score,
             pinned = excluded.pinned"#,
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(score)
    .bind(pin)
    .execute(pool)
    .await?;
    Ok(())
}
