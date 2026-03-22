use tauri::AppHandle;
use tauri::Manager;

use crate::windows;

#[tauri::command]
pub fn toggle_chat_window(app: AppHandle) -> Result<bool, String> {
    windows::toggle_chat_visibility(&app)
}

#[tauri::command]
pub fn open_insights_window(app: AppHandle) -> Result<(), String> {
    windows::create_insights_window(&app)
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if app.get_webview_window("settings").is_none() {
        windows::create_settings_window(&app)?;
    }
    let Some(win) = app.get_webview_window("settings") else {
        return Ok(());
    };
    let vis = win.is_visible().map_err(|e| e.to_string())?;
    if vis {
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
