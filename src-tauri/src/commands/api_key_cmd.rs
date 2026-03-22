use tauri::AppHandle;
use tauri::Manager;

use crate::keychain;
use crate::windows;

#[tauri::command]
pub fn has_api_key() -> bool {
    keychain::has_api_key()
}

#[tauri::command]
pub fn has_provider_api_key(provider: String) -> bool {
    keychain::has_api_key_for_provider(&provider)
}

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    keychain::save_api_key(key.trim())
}

#[tauri::command]
pub fn save_provider_api_key(provider: String, key: String) -> Result<(), String> {
    keychain::save_api_key_for_provider(&provider, key.trim())
}

#[tauri::command]
pub fn clear_api_key() -> Result<(), String> {
    keychain::clear_api_key()
}

#[tauri::command]
pub fn clear_provider_api_key(provider: String) -> Result<(), String> {
    keychain::clear_api_key_for_provider(&provider)
}

/// After saving the API key from setup UI: open mascot + chat (hidden), close setup.
#[tauri::command]
pub fn complete_setup_flow(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("setup") {
        let _ = w.close();
    }
    windows::create_mascot_window(&app)?;
    windows::create_chat_window(&app, false)?;
    windows::create_settings_window(&app)?;
    Ok(())
}
