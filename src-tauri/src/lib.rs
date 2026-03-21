mod agent;
mod commands;
mod config;
mod keychain;
mod windows;

use serde_json::json;
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            config::ensure_config_exists(&handle)?;

            if !keychain::has_api_key() {
                windows::create_setup_window(&handle)?;
            } else {
                windows::create_mascot_window(&handle)?;
                windows::create_chat_window(&handle, false)?;
            }

            #[cfg(desktop)]
            register_global_shortcuts(handle.clone())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_walle_config,
            commands::save_mascot_position,
            commands::has_api_key,
            commands::save_api_key,
            commands::clear_api_key,
            commands::complete_setup_flow,
            commands::walle_chat,
            commands::toggle_chat_window,
            commands::shell_run,
            commands::launch_app,
            commands::send_notify,
            commands::run_plugin_action,
            commands::save_agent_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
fn register_global_shortcuts(handle: tauri::AppHandle) -> anyhow::Result<()> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
    let h1 = handle.clone();
    h1.global_shortcut()
        .on_shortcut(toggle, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = windows::toggle_chat_visibility(app);
            }
        })
        .map_err(|e| anyhow::anyhow!(e))?;

    let voice = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyV);
    let h2 = handle.clone();
    h2.global_shortcut()
        .on_shortcut(voice, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app.emit_to("chat", "walle/voice-hotkey", json!(null));
            }
        })
        .map_err(|e| anyhow::anyhow!(e))?;

    Ok(())
}
