//! Load/save `walle.config.json` in the app config directory.

use std::path::PathBuf;

use serde_json::json;
use tauri::path::BaseDirectory;
use tauri::AppHandle;
use tauri::Manager;

const CONFIG_FILENAME: &str = "walle.config.json";

pub fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(CONFIG_FILENAME, BaseDirectory::AppConfig)
        .map_err(|e| e.to_string())
}

/// Ensures the config file exists, copying the bundled default from the repo on first run.
pub fn ensure_config_exists(app: &AppHandle) -> Result<(), String> {
    let p = config_path(app)?;
    if p.exists() {
        return Ok(());
    }
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let default = include_str!("../../walle.config.json");
    std::fs::write(&p, default).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn read_config_string(app: &AppHandle) -> Result<String, String> {
    ensure_config_exists(app)?;
    let p = config_path(app)?;
    std::fs::read_to_string(&p).map_err(|e| e.to_string())
}

pub fn read_config_json(app: &AppHandle) -> Result<serde_json::Value, String> {
    let text = read_config_string(app)?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

pub fn write_config_json(app: &AppHandle, value: &serde_json::Value) -> Result<(), String> {
    let p = config_path(app)?;
    ensure_config_exists(app)?;
    let out = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(&p, out).map_err(|e| e.to_string())
}

/// Reads saved logical position, or default bottom-right of the primary monitor.
pub fn resolve_mascot_logical_position(app: &AppHandle) -> Result<(f64, f64), String> {
    let p = config_path(app)?;
    if !p.exists() {
        return default_mascot_logical_position(app);
    }
    let text = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let x = v["mascot"]["window_x"].as_f64();
    let y = v["mascot"]["window_y"].as_f64();
    if let (Some(x), Some(y)) = (x, y) {
        return Ok((x, y));
    }
    default_mascot_logical_position(app)
}

// PLATFORM: Windows — primary monitor geometry uses physical pixels; divide by scale for logical coords.
// macOS swap: same PhysicalPosition / PhysicalSize pattern from `Monitor`.
fn default_mascot_logical_position(app: &AppHandle) -> Result<(f64, f64), String> {
    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no primary monitor".to_string())?;
    let size = monitor.size();
    let pos = monitor.position();
    let scale = monitor.scale_factor();
    let w = size.width as f64 / scale;
    let h = size.height as f64 / scale;
    let margin = 24.0;
    let lx = pos.x as f64 / scale;
    let ly = pos.y as f64 / scale;
    let x = lx + w - 160.0 - margin;
    let y = ly + h - 200.0 - margin;
    Ok((x, y))
}

pub fn save_mascot_position(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    let p = config_path(app)?;
    ensure_config_exists(app)?;
    let text = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let mut v: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if v.get("mascot").is_none() || !v["mascot"].is_object() {
        v["mascot"] = json!({});
    }
    v["mascot"]["window_x"] = json!(x);
    v["mascot"]["window_y"] = json!(y);
    let out = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    std::fs::write(&p, out).map_err(|e| e.to_string())?;
    Ok(())
}
