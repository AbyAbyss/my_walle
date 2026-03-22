use serde_json::json;
use serde::Deserialize;
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
    let mut v = config::read_config_json(&app)?;
    if !v["agent"].is_object() {
        v["agent"] = json!({});
    }
    v["agent"]["mode"] = json!(mode);
    config::write_config_json(&app, &v)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLlmSettingsPayload {
    pub provider: String,
    pub default_model: String,
    pub complex_model: String,
    #[serde(default)]
    pub base_url: String,
    pub smart_routing: bool,
    #[serde(default)]
    pub debug_mode: bool,
}

#[tauri::command]
pub fn save_llm_settings(app: AppHandle, settings: SaveLlmSettingsPayload) -> Result<(), String> {
    let mut v = config::read_config_json(&app)?;
    if !v["llm"].is_object() {
        v["llm"] = json!({});
    }
    v["llm"]["provider"] = json!(settings.provider);
    v["llm"]["default_model"] = json!(settings.default_model);
    v["llm"]["complex_model"] = json!(settings.complex_model);
    v["llm"]["smart_routing"] = json!(settings.smart_routing);
    v["llm"]["base_url"] = json!(settings.base_url);
    if !v["ui"].is_object() {
        v["ui"] = json!({});
    }
    v["ui"]["debug_mode"] = json!(settings.debug_mode);

    if v["llm"].get("model").is_some() {
        v["llm"].as_object_mut().unwrap().remove("model");
    }

    config::write_config_json(&app, &v)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveContextSettingsPayload {
    pub inject_active_window: bool,
    pub inject_clipboard: bool,
}

#[tauri::command]
pub fn save_context_settings(
    app: AppHandle,
    settings: SaveContextSettingsPayload,
) -> Result<(), String> {
    let mut v = config::read_config_json(&app)?;
    if !v["context"].is_object() {
        v["context"] = json!({});
    }
    v["context"]["inject_active_window"] = json!(settings.inject_active_window);
    v["context"]["inject_clipboard"] = json!(settings.inject_clipboard);
    config::write_config_json(&app, &v)
}

#[tauri::command]
pub fn save_plugins_enabled(app: AppHandle, enabled: Vec<String>) -> Result<(), String> {
    let mut v = config::read_config_json(&app)?;
    if !v["plugins"].is_object() {
        v["plugins"] = json!({});
    }
    v["plugins"]["enabled"] = json!(enabled);
    config::write_config_json(&app, &v)
}

#[tauri::command]
pub fn save_workflows_to_config(app: AppHandle, workflows: Vec<serde_json::Value>) -> Result<(), String> {
    let mut v = config::read_config_json(&app)?;
    v["workflows"] = json!(workflows);
    config::write_config_json(&app, &v)
}

#[derive(Deserialize)]
pub struct SaveUiPreferencesPayload {
    #[serde(default)]
    pub onboarding_complete: Option<bool>,
    #[serde(default)]
    pub last_open_date: Option<String>,
    #[serde(default)]
    pub user_level: Option<String>,
    #[serde(default)]
    pub idle_wander: Option<bool>,
    #[serde(default)]
    pub show_work: Option<bool>,
}

#[tauri::command]
pub fn save_ui_preferences(app: AppHandle, prefs: SaveUiPreferencesPayload) -> Result<(), String> {
    let mut v = config::read_config_json(&app)?;
    if let Some(x) = prefs.onboarding_complete {
        v["onboarding_complete"] = json!(x);
    }
    if let Some(ref s) = prefs.last_open_date {
        v["last_open_date"] = json!(s);
    }
    if let Some(ref s) = prefs.user_level {
        v["user_level"] = json!(s);
    }
    if let Some(x) = prefs.idle_wander {
        if !v["mascot"].is_object() {
            v["mascot"] = json!({});
        }
        v["mascot"]["idle_wander"] = json!(x);
    }
    if let Some(x) = prefs.show_work {
        v["show_work"] = json!(x);
    }
    config::write_config_json(&app, &v)
}

#[tauri::command]
pub fn save_workflow_to_config(app: AppHandle, workflow: serde_json::Value) -> Result<(), String> {
    let name = workflow
        .get("name")
        .and_then(|n| n.as_str())
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .ok_or_else(|| "workflow name required".to_string())?;

    let mut v = config::read_config_json(&app)?;
    if !v["workflows"].is_array() {
        v["workflows"] = json!([]);
    }

    let workflows = v["workflows"]
        .as_array_mut()
        .ok_or_else(|| "workflows key missing".to_string())?;
    workflows.retain(|w| {
        w.get("name")
            .and_then(|existing| existing.as_str())
            .map(|existing| !existing.eq_ignore_ascii_case(name))
            .unwrap_or(true)
    });
    workflows.push(workflow);

    config::write_config_json(&app, &v)
}
