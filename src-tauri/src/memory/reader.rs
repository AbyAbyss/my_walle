use sqlx::Row;
use sqlx::SqlitePool;

#[derive(Debug, Clone)]
pub struct MemoryRow {
    pub mem_type: String,
    #[allow(dead_code)]
    pub key: String,
    pub value: String,
    pub confidence: f64,
    pub use_count: i64,
}

fn tokenize(msg: &str) -> Vec<String> {
    msg.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() > 2)
        .map(str::to_string)
        .collect()
}

/// Keyword overlap with `user_message`, then `use_count`, `confidence`, `last_used`.
/// If no overlap, falls back to global ranking by use and confidence.
pub async fn get_relevant_memories(
    pool: &SqlitePool,
    user_message: &str,
    limit: usize,
) -> Result<Vec<MemoryRow>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT type, key, value, confidence, use_count FROM memories"#,
    )
    .fetch_all(pool)
    .await?;

    let tokens = tokenize(user_message);
    let mut scored: Vec<(i32, MemoryRow)> = Vec::new();

    for r in rows {
        let mem_type: String = r.try_get("type")?;
        let key: String = r.try_get("key")?;
        let value: String = r.try_get("value")?;
        let confidence: f64 = r.try_get("confidence")?;
        let use_count: i64 = r.try_get("use_count")?;
        let value_lower = value.to_lowercase();
        let score = tokens
            .iter()
            .filter(|t| value_lower.contains(t.as_str()))
            .count() as i32;

        scored.push((
            score,
            MemoryRow {
                mem_type,
                key,
                value,
                confidence,
                use_count,
            },
        ));
    }

    let has_overlap = scored.iter().any(|(s, _)| *s > 0);
    if has_overlap {
        scored.sort_by(|a, b| {
            b.0.cmp(&a.0)
                .then_with(|| b.1.use_count.cmp(&a.1.use_count))
                .then_with(|| {
                    b.1.confidence
                        .partial_cmp(&a.1.confidence)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });
        return Ok(scored
            .into_iter()
            .filter(|(s, _)| *s > 0)
            .take(limit)
            .map(|(_, m)| m)
            .collect());
    }

    let rows = sqlx::query(
        r#"SELECT type, key, value, confidence, use_count FROM memories
           ORDER BY use_count DESC, confidence DESC
           LIMIT ?"#,
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        out.push(MemoryRow {
            mem_type: r.try_get("type")?,
            key: r.try_get("key")?,
            value: r.try_get("value")?,
            confidence: r.try_get("confidence")?,
            use_count: r.try_get("use_count")?,
        });
    }
    Ok(out)
}

/// Renders the block injected into the system prompt.
pub fn format_memory_prompt(memories: &[MemoryRow]) -> String {
    if memories.is_empty() {
        return "(nothing stored yet)".to_string();
    }
    memories
        .iter()
        .map(|m| format!("- [{}] {}", m.mem_type, m.value))
        .collect::<Vec<_>>()
        .join("\n")
}
