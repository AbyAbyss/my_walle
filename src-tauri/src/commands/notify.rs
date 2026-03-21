use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub async fn send_notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}
