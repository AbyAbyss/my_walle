//! List memories for UI / Zustand (SQLite).

use serde::Serialize;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryDto {
    pub id: i64,
    #[serde(rename = "type")]
    pub mem_type: String,
    pub key: String,
    pub value: String,
    pub confidence: f64,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_used: Option<String>,
    pub use_count: i64,
}

#[tauri::command]
pub async fn memories_list_cmd(
    pool: State<'_, SqlitePool>,
    limit: Option<i64>,
) -> Result<Vec<MemoryDto>, String> {
    let lim = limit.unwrap_or(100).clamp(1, 500);
    let rows = sqlx::query(
        r#"SELECT id, type, key, value, confidence, source, created_at, updated_at, last_used, use_count
           FROM memories ORDER BY updated_at DESC LIMIT ?"#,
    )
    .bind(lim)
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        out.push(MemoryDto {
            id: r.try_get("id").map_err(|e: sqlx::Error| e.to_string())?,
            mem_type: r.try_get("type").map_err(|e: sqlx::Error| e.to_string())?,
            key: r.try_get("key").map_err(|e: sqlx::Error| e.to_string())?,
            value: r.try_get("value").map_err(|e: sqlx::Error| e.to_string())?,
            confidence: r.try_get("confidence").map_err(|e: sqlx::Error| e.to_string())?,
            source: r.try_get("source").map_err(|e: sqlx::Error| e.to_string())?,
            created_at: r.try_get("created_at").map_err(|e: sqlx::Error| e.to_string())?,
            updated_at: r.try_get("updated_at").map_err(|e: sqlx::Error| e.to_string())?,
            last_used: r.try_get("last_used").map_err(|e: sqlx::Error| e.to_string())?,
            use_count: r.try_get("use_count").map_err(|e: sqlx::Error| e.to_string())?,
        });
    }
    Ok(out)
}
