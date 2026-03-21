use tauri::AppHandle;

use crate::windows;

#[tauri::command]
pub fn toggle_chat_window(app: AppHandle) -> Result<bool, String> {
    windows::toggle_chat_visibility(&app)
}
