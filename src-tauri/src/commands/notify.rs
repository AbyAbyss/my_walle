use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

const MAX_DELAY_SECS: u64 = 604_800; // 7 days

fn show_notification(app: &AppHandle, title: &str, body: &str) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    show_notification(&app, &title, &body)
}

/// From notify plugin params: `delay_seconds`, `delay_minutes` (combined, capped).
pub(crate) fn parse_notify_delay_secs(params: &serde_json::Value) -> u64 {
    let secs = params.get("delay_seconds").and_then(|v| v.as_u64()).unwrap_or(0);
    let mins = params.get("delay_minutes").and_then(|v| v.as_u64()).unwrap_or(0);
    secs.saturating_add(mins.saturating_mul(60))
        .min(MAX_DELAY_SECS)
}

/// Shows a toast after the delay without blocking the invoke handler.
pub(crate) fn spawn_delayed_notify(app: AppHandle, title: String, body: String, delay_secs: u64) {
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(delay_secs)).await;
        let _ = show_notification(&app, &title, &body);
    });
}
