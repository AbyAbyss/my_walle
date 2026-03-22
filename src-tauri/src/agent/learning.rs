//! Pattern detection from `task_outcomes` — emits `pattern:detected` on the mascot window.

use chrono::DateTime;
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;
use tauri::Emitter;

use crate::config;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PatternDto {
    pub id: String,
    pub description: String,
    pub trigger: String,
    pub action: String,
    pub occurrences: i64,
    pub confidence: f64,
    pub last_seen: String,
    pub suggested: bool,
    pub accepted: Option<bool>,
}

fn learning_config(app: &AppHandle) -> (bool, i64, f64) {
    let Ok(v) = config::read_config_json(app) else {
        return (true, 3, 0.75);
    };
    let l = v.get("learning");
    let enabled = l.and_then(|x| x.get("enabled")).and_then(|x| x.as_bool()).unwrap_or(true);
    let min_occ = l
        .and_then(|x| x.get("min_occurrences"))
        .and_then(|x| x.as_i64())
        .unwrap_or(3);
    let min_conf = l
        .and_then(|x| x.get("min_confidence"))
        .and_then(|x| x.as_f64())
        .unwrap_or(0.75);
    (enabled, min_occ, min_conf)
}

fn pattern_id(trigger: &str, action: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    format!("{}|{}", trigger, action).hash(&mut h);
    format!("p{:016x}", h.finish())
}

fn seconds_between(prev_ts: &str, next_ts: &str) -> Option<i64> {
    let a = DateTime::parse_from_rfc3339(prev_ts).ok()?;
    let b = DateTime::parse_from_rfc3339(next_ts).ok()?;
    Some((b - a).num_seconds())
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}…", &s[..max.saturating_sub(1)])
    }
}

fn describe_pair(p_tr: &str, p_ac: &str) -> String {
    format!(
        "You often run {} right after {} — want to automate this sequence?",
        p_ac, p_tr
    )
}

/// Scans last 30 days of outcomes for consecutive command pairs ≤60s apart.
pub async fn scan_and_emit(app: &AppHandle, pool: &SqlitePool) -> Result<(), String> {
    let (enabled, min_occurrences, min_confidence) = learning_config(app);
    if !enabled {
        return Ok(());
    }

    let rows = sqlx::query(
        r#"SELECT plugin, command, timestamp FROM task_outcomes
           WHERE timestamp > datetime('now', '-30 days')
           ORDER BY timestamp ASC LIMIT 8000"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if rows.len() < 2 {
        return Ok(());
    }

    use std::collections::HashMap;
    let mut pair_counts: HashMap<(String, String, String, String), (i64, String)> = HashMap::new();

    for w in rows.windows(2) {
        let p0: String = w[0].get("plugin");
        let c0: String = w[0].get("command");
        let t0: String = w[0].get("timestamp");
        let p1: String = w[1].get("plugin");
        let c1: String = w[1].get("command");
        let t1: String = w[1].get("timestamp");

        let Some(secs) = seconds_between(&t0, &t1) else { continue };
        if !(0..=60).contains(&secs) {
            continue;
        }

        let key = (p0.clone(), c0.clone(), p1.clone(), c1.clone());
        let last = t1.clone();
        pair_counts
            .entry(key)
            .and_modify(|(n, ls)| {
                *n += 1;
                *ls = last.clone();
            })
            .or_insert((1, last));
    }

    for ((p_tr, c_tr, p_ac, c_ac), (occ, last_seen)) in pair_counts {
        if occ < min_occurrences {
            continue;
        }
        let confidence = ((occ as f64 / 10.0) + 0.55).min(0.98);
        if confidence < min_confidence {
            continue;
        }

        let trigger = format!("{}:{}", p_tr, truncate(&c_tr, 120));
        let action = format!("{}:{}", p_ac, truncate(&c_ac, 120));
        let id = pattern_id(&trigger, &action);
        let desc = describe_pair(&p_tr, &p_ac);

        let prior = sqlx::query(r#"SELECT suggested, accepted FROM patterns WHERE id = ?"#)
            .bind(&id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(r) = &prior {
            let accepted: Option<i64> = r.try_get("accepted").ok().flatten();
            if accepted == Some(0) {
                continue;
            }
        }

        sqlx::query(
            r#"INSERT INTO patterns (id, description, trigger, action, occurrences, confidence,
               last_seen, suggested, accepted)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)
               ON CONFLICT(id) DO UPDATE SET
                 description = excluded.description,
                 trigger = excluded.trigger,
                 action = excluded.action,
                 occurrences = excluded.occurrences,
                 confidence = excluded.confidence,
                 last_seen = excluded.last_seen"#,
        )
        .bind(&id)
        .bind(&desc)
        .bind(&trigger)
        .bind(&action)
        .bind(occ)
        .bind(confidence)
        .bind(&last_seen)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        let suggested_before: i64 = prior
            .as_ref()
            .and_then(|r| r.try_get("suggested").ok())
            .unwrap_or(0);

        if suggested_before == 1 {
            continue;
        }

        let dto = PatternDto {
            id: id.clone(),
            description: desc,
            trigger: trigger.clone(),
            action: action.clone(),
            occurrences: occ,
            confidence,
            last_seen: last_seen.clone(),
            suggested: true,
            accepted: None,
        };

        sqlx::query(r#"UPDATE patterns SET suggested = 1 WHERE id = ?"#)
            .bind(&id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

        let _ = app.emit_to("mascot", "pattern:detected", &dto);
    }

    Ok(())
}

pub fn schedule_scan(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = scan_and_emit(&app, &pool).await {
            eprintln!("learning scan: {e}");
        }
    });
}
