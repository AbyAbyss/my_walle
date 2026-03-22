use serde::Serialize;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationRow {
    pub role: String,
    pub content: String,
    pub emotion: Option<String>,
    pub timestamp: String,
}

/// Persists one chat line (user or assistant).
#[tauri::command]
pub async fn conversation_append(
    pool: State<'_, SqlitePool>,
    session_id: String,
    role: String,
    content: String,
    emotion: Option<String>,
) -> Result<(), String> {
    let ts = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        r#"INSERT INTO conversations (session_id, role, content, emotion, timestamp)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(&session_id)
    .bind(&role)
    .bind(&content)
    .bind(&emotion)
    .bind(&ts)
    .execute(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Last `limit` messages in chronological order (oldest first).
#[tauri::command]
pub async fn conversation_load_recent(
    pool: State<'_, SqlitePool>,
    session_id: String,
    limit: i64,
) -> Result<Vec<ConversationRow>, String> {
    let records = sqlx::query(
        r#"SELECT role, content, emotion, timestamp FROM (
             SELECT id, role, content, emotion, timestamp FROM conversations
             WHERE session_id = ?
             ORDER BY id DESC
             LIMIT ?
           ) sub ORDER BY sub.id ASC"#,
    )
    .bind(&session_id)
    .bind(limit)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(records.len());
    for r in records {
        out.push(ConversationRow {
            role: r.try_get::<String, _>("role").map_err(|e| e.to_string())?,
            content: r.try_get::<String, _>("content").map_err(|e| e.to_string())?,
            emotion: r.try_get::<Option<String>, _>("emotion").map_err(|e| e.to_string())?,
            timestamp: r.try_get::<String, _>("timestamp").map_err(|e| e.to_string())?,
        });
    }
    Ok(out)
}
