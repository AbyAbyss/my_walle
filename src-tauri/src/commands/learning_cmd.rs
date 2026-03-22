use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use tauri::AppHandle;
use tauri::State;

use crate::config;

fn split_plugin_payload(s: &str) -> Option<(String, serde_json::Value)> {
    let i = s.find(':')?;
    let plugin = s[..i].trim().to_string();
    let rest = s[i + 1..].trim();
    let params: serde_json::Value = serde_json::from_str(rest).unwrap_or_else(|_| json!({}));
    Some((plugin, params))
}

#[tauri::command]
pub async fn pattern_accept(app: AppHandle, pool: State<'_, SqlitePool>, id: String) -> Result<(), String> {
    let row = sqlx::query(r#"SELECT trigger, action, description FROM patterns WHERE id = ?"#)
        .bind(&id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "pattern not found".to_string())?;

    let trigger: String = row.try_get("trigger").map_err(|e| e.to_string())?;
    let action: String = row.try_get("action").map_err(|e| e.to_string())?;
    let description: String = row.try_get("description").map_err(|e| e.to_string())?;

    let (p1, params1) = split_plugin_payload(&trigger).ok_or_else(|| "invalid trigger".to_string())?;
    let (p2, params2) = split_plugin_payload(&action).ok_or_else(|| "invalid action".to_string())?;

    let name = format!("Learned {}", &id.chars().take(12).collect::<String>());
    let steps = vec![
        json!({
            "plugin": p1,
            "label": "Learned step 1",
            "risk": "low",
            "params": params1,
        }),
        json!({
            "plugin": p2,
            "label": "Learned step 2",
            "risk": "low",
            "params": params2,
        }),
    ];

    let mut v = config::read_config_json(&app)?;
    if !v["workflows"].is_array() {
        v["workflows"] = json!([]);
    }
    let arr = v["workflows"].as_array_mut().unwrap();
    let entry = json!({
        "name": name,
        "description": description,
        "steps": steps,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });
    arr.retain(|w| w["name"].as_str() != Some(name.as_str()));
    arr.push(entry);
    config::write_config_json(&app, &v)?;

    sqlx::query(r#"UPDATE patterns SET accepted = 1 WHERE id = ?"#)
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn patterns_list(pool: State<'_, SqlitePool>) -> Result<Vec<Value>, String> {
    let rows = sqlx::query(
        r#"SELECT id, description, trigger, action, occurrences, confidence, last_seen, suggested, accepted
           FROM patterns ORDER BY last_seen DESC LIMIT 500"#,
    )
    .fetch_all(&*pool)
    .await
    .map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        let acc: Option<i64> = r.try_get("accepted").ok().flatten();
        let accepted = acc.map(|a| a != 0);
        out.push(json!({
            "id": r.try_get::<String, _>("id").map_err(|e| e.to_string())?,
            "description": r.try_get::<String, _>("description").map_err(|e| e.to_string())?,
            "trigger": r.try_get::<String, _>("trigger").map_err(|e| e.to_string())?,
            "action": r.try_get::<String, _>("action").map_err(|e| e.to_string())?,
            "occurrences": r.try_get::<i64, _>("occurrences").unwrap_or(0),
            "confidence": r.try_get::<f64, _>("confidence").unwrap_or(0.0),
            "lastSeen": r.try_get::<String, _>("last_seen").map_err(|e| e.to_string())?,
            "suggested": r.try_get::<i64, _>("suggested").unwrap_or(0) != 0,
            "accepted": accepted,
        }));
    }
    Ok(out)
}

#[tauri::command]
pub async fn pattern_dismiss(pool: State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query(r#"UPDATE patterns SET accepted = 0 WHERE id = ?"#)
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
