use sqlx::{Row, SqlitePool};
use tauri::State;

/// Increments dismiss streak for a watcher; at 3, disables the watcher row.
#[tauri::command]
pub async fn proactive_watcher_dismiss(pool: State<'_, SqlitePool>, watcher_id: String) -> Result<(), String> {
    sqlx::query(
        r#"INSERT INTO proactive_state (watcher_id, last_nudge, dismiss_streak, disabled)
           VALUES (?, '', 1, 0)
           ON CONFLICT(watcher_id) DO UPDATE SET
             dismiss_streak = dismiss_streak + 1"#,
    )
    .bind(&watcher_id)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query(r#"SELECT dismiss_streak FROM proactive_state WHERE watcher_id = ?"#)
        .bind(&watcher_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    let streak: i64 = row.try_get("dismiss_streak").map_err(|e| e.to_string())?;
    if streak >= 3 {
        sqlx::query(r#"UPDATE proactive_state SET disabled = 1 WHERE watcher_id = ?"#)
            .bind(&watcher_id)
            .execute(&*pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
