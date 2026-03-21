mod commands;
mod config;

use tauri::WebviewUrl;
use tauri::webview::WebviewWindowBuilder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            config::ensure_config_exists(&handle)?;
            let (x, y) = config::resolve_mascot_logical_position(&handle)?;
            let _mascot = WebviewWindowBuilder::new(
                &handle,
                "mascot",
                WebviewUrl::App("mascot.html".into()),
            )
            .transparent(true)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .inner_size(160.0, 200.0)
            .shadow(false)
            .position(x, y)
            .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_walle_config,
            commands::save_mascot_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
