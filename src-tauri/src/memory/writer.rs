use serde::Deserialize;
use sqlx::Row;
use sqlx::SqlitePool;

#[derive(Debug, Deserialize)]
pub struct MemoryItemInput {
    #[serde(rename = "type")]
    pub mem_type: String,
    pub key: String,
    pub value: String,
    #[serde(default)]
    pub source: String,
}

fn initial_confidence(source: &str) -> f64 {
    match source {
        "user" => 1.0,
        _ => 0.7,
    }
}

fn normalize_source(raw: &str) -> &'static str {
    match raw {
        "user" => "user",
        "inferred" => "inferred",
        "observed" => "observed",
        _ => "observed",
    }
}

/// Upserts memories from a parsed LLM `memories` array.
pub async fn upsert_memories(pool: &SqlitePool, items: &[MemoryItemInput]) -> Result<(), sqlx::Error> {
    if items.is_empty() {
        return Ok(());
    }

    let now = chrono::Utc::now().to_rfc3339();

    for item in items {
        let key = item.key.trim();
        if key.is_empty() {
            continue;
        }
        let source = normalize_source(item.source.trim());
        let source_owned = source.to_string();

        let existing = sqlx::query(
            r#"SELECT id, confidence, use_count FROM memories WHERE key = ?"#,
        )
        .bind(key)
        .fetch_optional(pool)
        .await?;

        if let Some(row) = existing {
            let id: i64 = row.try_get("id")?;
            let conf: f64 = row.try_get("confidence")?;
            let new_conf = (conf + 0.1_f64).min(1.0_f64);
            sqlx::query(
                r#"UPDATE memories
                   SET value = ?, confidence = ?, updated_at = ?, use_count = use_count + 1, source = ?
                   WHERE id = ?"#,
            )
            .bind(&item.value)
            .bind(new_conf)
            .bind(&now)
            .bind(&source_owned)
            .bind(id)
            .execute(pool)
            .await?;
        } else {
            let conf = initial_confidence(source);
            sqlx::query(
                r#"INSERT INTO memories
                   (type, key, value, confidence, source, created_at, updated_at, use_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 0)"#,
            )
            .bind(&item.mem_type)
            .bind(key)
            .bind(&item.value)
            .bind(conf)
            .bind(&source_owned)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}
