//! Background watchers — emits `proactive:nudge` to the mascot window.

use chrono::{Local, NaiveTime, Timelike, Utc};
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

use crate::agent::learning::PatternDto;
use crate::config;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NudgeEnvelope {
    pub kind: String,
    pub watcher_id: String,
    pub pattern: PatternDto,
}

fn parse_hhmm(s: &str) -> Option<NaiveTime> {
    let parts: Vec<&str> = s.trim().split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let h: u32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    NaiveTime::from_hms_opt(h, m, 0)
}

fn in_quiet_hours(start_s: &str, end_s: &str) -> bool {
    let Some(start) = parse_hhmm(start_s) else {
        return false;
    };
    let Some(end) = parse_hhmm(end_s) else {
        return false;
    };
    let now = Local::now().time();
    let ns = now.num_seconds_from_midnight();
    let a = start.num_seconds_from_midnight();
    let b = end.num_seconds_from_midnight();
    if a <= b {
        ns >= a && ns <= b
    } else {
        ns >= a || ns <= b
    }
}

async fn chat_is_open(app: &AppHandle) -> bool {
    app.get_webview_window("chat")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false)
}

async fn watcher_allowed(pool: &SqlitePool, watcher_id: &str, min_gap_secs: u64) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(r#"SELECT last_nudge, dismiss_streak, disabled FROM proactive_state WHERE watcher_id = ?"#)
        .bind(watcher_id)
        .fetch_optional(pool)
        .await?;

    if let Some(r) = &row {
        if r.try_get::<i64, _>("disabled").unwrap_or(0) != 0 {
            return Ok(false);
        }
        if r.try_get::<i64, _>("dismiss_streak").unwrap_or(0) >= 3 {
            return Ok(false);
        }
        if let Ok(last) = r.try_get::<String, _>("last_nudge") {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&last) {
                let elapsed = (Utc::now() - dt.with_timezone(&Utc)).num_seconds();
                if elapsed >= 0 && (elapsed as u64) < min_gap_secs {
                    return Ok(false);
                }
            }
        }
    }
    Ok(true)
}

async fn nudges_today(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let day = Local::now().format("%Y-%m-%d").to_string();
    let row = sqlx::query(r#"SELECT n FROM nudge_daily WHERE day = ?"#)
        .bind(&day)
        .fetch_optional(pool)
        .await?;
    Ok(row.and_then(|r| r.try_get("n").ok()).unwrap_or(0))
}

async fn bump_nudge_day(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let day = Local::now().format("%Y-%m-%d").to_string();
    sqlx::query(
        r#"INSERT INTO nudge_daily (day, n) VALUES (?, 1)
           ON CONFLICT(day) DO UPDATE SET n = n + 1"#,
    )
    .bind(&day)
    .execute(pool)
    .await?;
    Ok(())
}

async fn record_watcher_nudge(pool: &SqlitePool, watcher_id: &str) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"INSERT INTO proactive_state (watcher_id, last_nudge, dismiss_streak, disabled)
           VALUES (?, ?, 0, 0)
           ON CONFLICT(watcher_id) DO UPDATE SET last_nudge = excluded.last_nudge"#,
    )
    .bind(watcher_id)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

fn git_uncommitted_info(repo: &Path) -> Option<(usize, i64)> {
    let root = repo.to_str()?;
    let out = Command::new("git")
        .args(["-C", root, "status", "--porcelain"])
        .output()
        .ok()?;
    let dirty = String::from_utf8_lossy(&out.stdout);
    let lines = dirty.lines().filter(|l| !l.trim().is_empty()).count();
    if lines == 0 {
        return None;
    }
    let log = Command::new("git")
        .args(["-C", root, "log", "-1", "--format=%ct"])
        .output()
        .ok()?;
    let ts_s: i64 = String::from_utf8_lossy(&log.stdout).trim().parse().ok()?;
    let now = Utc::now().timestamp();
    let age_min = (now - ts_s) / 60;
    Some((lines, age_min))
}

async fn emit_nudge(
    app: &AppHandle,
    pool: &SqlitePool,
    watcher_id: &str,
    kind: &str,
    description: String,
) -> Result<(), sqlx::Error> {
    let dto = PatternDto {
        id: format!("nudge_{}_{}", kind, Utc::now().timestamp()),
        description,
        trigger: kind.into(),
        action: String::new(),
        occurrences: 1,
        confidence: 1.0,
        last_seen: Utc::now().to_rfc3339(),
        suggested: true,
        accepted: None,
    };
    let env = NudgeEnvelope {
        kind: kind.into(),
        watcher_id: watcher_id.to_string(),
        pattern: dto,
    };
    let _ = app.emit_to("mascot", "proactive:nudge", &env);
    record_watcher_nudge(pool, watcher_id).await?;
    bump_nudge_day(pool).await?;
    Ok(())
}

pub async fn tick_proactive(app: &AppHandle, pool: &SqlitePool) {
    let Ok(cfg) = config::read_config_json(app) else {
        return;
    };
    let proactive = cfg.get("proactive");
    let enabled = proactive
        .and_then(|p| p.get("enabled"))
        .and_then(|x| x.as_bool())
        .unwrap_or(false);
    if !enabled {
        return;
    }
    if chat_is_open(app).await {
        return;
    }
    let qh_s = proactive
        .and_then(|p| p.get("quiet_hours_start"))
        .and_then(|x| x.as_str())
        .unwrap_or("22:00");
    let qh_e = proactive
        .and_then(|p| p.get("quiet_hours_end"))
        .and_then(|x| x.as_str())
        .unwrap_or("08:00");
    if in_quiet_hours(qh_s, qh_e) {
        return;
    }
    let max_day = proactive
        .and_then(|p| p.get("max_nudges_per_day"))
        .and_then(|x| x.as_u64())
        .unwrap_or(3) as i64;
    if nudges_today(pool).await.unwrap_or(0) >= max_day {
        return;
    }

    let watchers = proactive.and_then(|p| p.get("watchers"));
    if let Some(w) = watchers.and_then(|x| x.get("git_uncommitted")) {
        let on = w.get("enabled").and_then(|x| x.as_bool()).unwrap_or(false);
        if on {
            let thresh = w.get("threshold_minutes").and_then(|x| x.as_i64()).unwrap_or(120);
            let dev = cfg
                .get("developer_mode")
                .and_then(|d| d.get("enabled"))
                .and_then(|x| x.as_bool())
                .unwrap_or(false);
            let watch = cfg
                .get("developer_mode")
                .and_then(|d| d.get("watch_dir"))
                .and_then(|x| x.as_str())
                .unwrap_or("");
            if dev && !watch.is_empty() {
                let repo = Path::new(watch);
                if let Some((n_files, age_min)) = git_uncommitted_info(repo) {
                    if age_min >= thresh {
                        let wid = "git_uncommitted";
                        if watcher_allowed(pool, wid, 3600).await.unwrap_or(false) {
                            let desc = format!(
                                "You have {n_files} uncommitted change(s) in {}. Last commit was {age_min} minutes ago.",
                                repo.display()
                            );
                            if emit_nudge(app, pool, wid, "git_uncommitted", desc).await.is_ok() {
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(w) = watchers.and_then(|x| x.get("test_failures")) {
        let on = w.get("enabled").and_then(|x| x.as_bool()).unwrap_or(false);
        if on {
            let fail_thresh = w.get("failure_threshold").and_then(|x| x.as_i64()).unwrap_or(3);
            let row = sqlx::query(
                r#"SELECT COUNT(*) as c FROM task_outcomes
                   WHERE plugin = 'shell' AND success = 0
                   AND command LIKE '%test%'
                   AND timestamp > datetime('now', '-2 days')"#,
            )
            .fetch_one(pool)
            .await;
            if let Ok(r) = row {
                let c: i64 = r.try_get("c").unwrap_or(0);
                if c >= fail_thresh {
                    let wid = "test_failures";
                    if watcher_allowed(pool, wid, 3600).await.unwrap_or(false) {
                        let desc = format!("Detected {c} recent test command failures in task history.");
                        emit_nudge(app, pool, wid, "test_failures", desc).await.ok();
                    }
                }
            }
        }
    }
}

pub fn start_proactive_loop(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(300)).await;
            let _ = tick_proactive(&app, &pool).await;
        }
    });
}
