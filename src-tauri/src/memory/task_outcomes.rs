//! Append-only `task_outcomes` rows for trust scores, patterns, and watchers.

use crate::agent::trust;
use sqlx::SqlitePool;

const MAX_CMD_LEN: usize = 2048;

/// Records one executed action outcome. Errors are swallowed so logging never breaks execution.
pub async fn record_task_outcome(
    pool: &SqlitePool,
    plugin: &str,
    command: &str,
    success: bool,
    error_msg: Option<&str>,
) {
    let mut cmd = command.to_string();
    if cmd.len() > MAX_CMD_LEN {
        cmd.truncate(MAX_CMD_LEN);
    }
    let ts = chrono::Utc::now().to_rfc3339();
    let ok = if success { 1 } else { 0 };
    let err = error_msg.map(|s| {
        let mut e = s.to_string();
        if e.len() > MAX_CMD_LEN {
            e.truncate(MAX_CMD_LEN);
        }
        e
    });
    let res = sqlx::query(
        r#"INSERT INTO task_outcomes (plugin, command, success, error_msg, timestamp)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(plugin)
    .bind(&cmd)
    .bind(ok)
    .bind(err)
    .bind(&ts)
    .execute(pool)
    .await;
    match res {
        Ok(_) => {
            if let Err(e) = trust::apply_outcome_from_task(pool, plugin, &cmd, success).await {
                eprintln!("trust update failed: {e}");
            }
        }
        Err(e) => eprintln!("task_outcomes insert failed: {e}"),
    }
}

pub fn params_summary(params: &serde_json::Value) -> String {
    params.to_string().chars().take(MAX_CMD_LEN).collect()
}
