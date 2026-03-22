//! Persona metadata (`~/.walle/personas/{id}/persona.json`) + bundled defaults.

use tauri::AppHandle;

pub mod voice;

pub fn personality_modifier(app: &AppHandle) -> Option<String> {
    let cfg = crate::config::read_config_json(app).ok()?;
    let id = cfg
        .get("persona")
        .and_then(|p| p.get("active"))
        .and_then(|x| x.as_str())
        .unwrap_or("walle");
    if id == "walle" {
        return None;
    }
    let home = std::env::var("HOME")
        .ok()
        .or_else(|| std::env::var("USERPROFILE").ok())?;
    let path = std::path::Path::new(&home)
        .join(".walle/personas")
        .join(id)
        .join("persona.json");
    let text = std::fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&text).ok()?;
    v.get("personality_modifier")?
        .as_str()
        .map(|s| s.to_string())
}
