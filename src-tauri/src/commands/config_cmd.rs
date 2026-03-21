use serde_json::json;
use tauri::AppHandle;

use crate::config;

#[tauri::command]
pub fn get_walle_config(app: AppHandle) -> Result<String, String> {
    config::read_config_string(&app)
}

#[tauri::command]
pub fn save_mascot_position(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    config::save_mascot_position(&app, x, y)
}

#[tauri::command]
pub fn save_agent_mode(app: AppHandle, mode: String) -> Result<(), String> {
    let p = config::config_path(&app)?;
    config::ensure_config_exists(&app)?;
    let text = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let mut v: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if !v["agent"].is_object() {
        v["agent"] = json!({});
    }
    v["agent"]["mode"] = json!(mode);
    std::fs::write(
        &p,
        serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
