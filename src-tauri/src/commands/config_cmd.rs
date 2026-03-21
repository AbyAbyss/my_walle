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
