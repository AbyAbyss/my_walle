//! Cron schedules in SQLite + background tick (every 60s) → `schedule:fire` on the chat window.

use std::str::FromStr;
use std::time::Duration;

use chrono::{DateTime, Utc};
use cron::Schedule;
use serde::Serialize;
use serde_json::json;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDto {
    pub id: i64,
    pub name: String,
    pub cron_expr: String,
    pub actions: serde_json::Value,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub created_at: String,
}

pub fn validate_cron(expr: &str) -> Result<(), String> {
    Schedule::from_str(expr.trim()).map_err(|e| format!("invalid cron expression: {e}"))?;
    Ok(())
}

/// Next fire time after `after` must be ≤ `now` for a due run.
pub fn is_due(cron_expr: &str, last_run: Option<DateTime<Utc>>, now: DateTime<Utc>) -> bool {
    let schedule = match Schedule::from_str(cron_expr.trim()) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let after = last_run.unwrap_or_else(|| now - chrono::Duration::days(365 * 25));
    schedule
        .after(&after)
        .next()
        .map(|next| next <= now)
        .unwrap_or(false)
}

fn parse_last_run(s: Option<String>) -> Option<DateTime<Utc>> {
    s.and_then(|t| DateTime::parse_from_rfc3339(&t).ok()).map(|dt| dt.with_timezone(&Utc))
}

pub async fn insert_schedule(
    pool: &SqlitePool,
    name: &str,
    cron_expr: &str,
    actions_json: &str,
) -> Result<i64, sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let id = sqlx::query_scalar::<_, i64>(
        r#"INSERT INTO schedules (name, cron_expr, actions, enabled, created_at)
           VALUES (?, ?, ?, 1, ?) RETURNING id"#,
    )
    .bind(name)
    .bind(cron_expr)
    .bind(actions_json)
    .bind(&now)
    .fetch_one(pool)
    .await?;
    Ok(id)
}

pub async fn delete_schedule_by_name_or_id(
    pool: &SqlitePool,
    name: Option<&str>,
    id: Option<i64>,
) -> Result<u64, sqlx::Error> {
    if let Some(id) = id {
        return sqlx::query("DELETE FROM schedules WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map(|r| r.rows_affected());
    }
    if let Some(name) = name {
        let name = name.trim();
        if !name.is_empty() {
            return sqlx::query("DELETE FROM schedules WHERE name = ?")
                .bind(name)
                .execute(pool)
                .await
                .map(|r| r.rows_affected());
        }
    }
    Ok(0)
}

pub async fn list_schedules(pool: &SqlitePool) -> Result<Vec<ScheduleDto>, String> {
    let rows = sqlx::query(
        r#"SELECT id, name, cron_expr, actions, enabled, last_run, created_at FROM schedules ORDER BY id ASC"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let actions_s: String = r.try_get("actions").map_err(|e| e.to_string())?;
        let actions: serde_json::Value =
            serde_json::from_str(&actions_s).unwrap_or_else(|_| json!([]));
        out.push(ScheduleDto {
            id: r.try_get("id").map_err(|e| e.to_string())?,
            name: r.try_get("name").map_err(|e| e.to_string())?,
            cron_expr: r.try_get("cron_expr").map_err(|e| e.to_string())?,
            actions,
            enabled: r.try_get::<i64, _>("enabled").map_err(|e| e.to_string())? != 0,
            last_run: r.try_get("last_run").map_err(|e| e.to_string())?,
            created_at: r.try_get("created_at").map_err(|e| e.to_string())?,
        });
    }
    Ok(out)
}

pub async fn set_schedule_enabled(pool: &SqlitePool, id: i64, enabled: bool) -> Result<(), String> {
    sqlx::query("UPDATE schedules SET enabled = ? WHERE id = ?")
        .bind(if enabled { 1 } else { 0 })
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn update_last_run(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query("UPDATE schedules SET last_run = ? WHERE id = ?")
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

async fn run_scheduler_tick(app: &AppHandle, pool: &SqlitePool) {
    let now = Utc::now();
    let rows = match sqlx::query(
        r#"SELECT id, name, cron_expr, actions, last_run FROM schedules WHERE enabled = 1"#,
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(_) => return,
    };

    for r in rows {
        let id: i64 = match r.try_get("id") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let name: String = match r.try_get("name") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let cron_expr: String = match r.try_get("cron_expr") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let actions_s: String = match r.try_get("actions") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let last_run_s: Option<String> = r.try_get("last_run").ok().flatten();

        let last_run = parse_last_run(last_run_s);
        if !is_due(&cron_expr, last_run, now) {
            continue;
        }

        let actions: serde_json::Value =
            serde_json::from_str(&actions_s).unwrap_or_else(|_| json!([]));
        let payload = json!({
            "id": id,
            "name": name,
            "cronExpr": cron_expr,
            "actions": actions,
        });
        let _ = app.emit_to("chat", "schedule:fire", &payload);
        let _ = update_last_run(pool, id).await;
    }
}

pub fn start_scheduler(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            run_scheduler_tick(&app, &pool).await;
        }
    });
}

#[tauri::command]
pub async fn schedules_list_cmd(pool: State<'_, SqlitePool>) -> Result<Vec<ScheduleDto>, String> {
    list_schedules(&pool).await
}

#[tauri::command]
pub async fn schedules_delete_cmd(pool: State<'_, SqlitePool>, id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM schedules WHERE id = ?")
        .bind(id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn schedules_set_enabled_cmd(
    pool: State<'_, SqlitePool>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    set_schedule_enabled(&pool, id, enabled).await
}
