mod agent;
mod commands;
mod config;
mod keychain;
mod memory;
mod windows;

use serde_json::json;
use tauri::Emitter;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            let pool = tauri::async_runtime::block_on(memory::db::init_db(&handle))?;
            let pool_sched = pool.clone();
            app.manage(pool);
            commands::start_scheduler(handle.clone(), pool_sched);
            config::ensure_config_exists(&handle)?;

            let provider = agent::llm::current_provider_name(&handle)
                .unwrap_or_else(|_| "anthropic".to_string());
            let needs_api_key = agent::llm::provider_requires_api_key(&handle).unwrap_or(true);
            if needs_api_key && !keychain::has_api_key_for_provider(&provider) {
                windows::create_setup_window(&handle)?;
            } else {
                windows::create_mascot_window(&handle)?;
                windows::create_chat_window(&handle, false)?;
            }

            #[cfg(desktop)]
            register_global_shortcuts(handle.clone())?;

            commands::spawn_plugins_folder_watcher(handle.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_walle_config,
            commands::save_mascot_position,
            commands::has_api_key,
            commands::has_provider_api_key,
            commands::save_api_key,
            commands::save_provider_api_key,
            commands::clear_api_key,
            commands::clear_provider_api_key,
            commands::complete_setup_flow,
            commands::walle_chat,
            commands::toggle_chat_window,
            commands::shell_run,
            commands::launch_app,
            commands::send_notify,
            commands::run_plugin_action,
            commands::save_agent_mode,
            commands::save_llm_settings,
            commands::save_workflow_to_config,
            commands::save_ui_preferences,
            commands::conversation_append,
            commands::conversation_load_recent,
            commands::get_active_window,
            commands::get_clipboard,
            commands::save_context_settings,
            commands::schedules_list_cmd,
            commands::schedules_delete_cmd,
            commands::schedules_set_enabled_cmd,
            commands::git_status,
            commands::git_log,
            commands::git_diff,
            commands::git_action,
            commands::save_plugins_enabled,
            commands::save_workflows_to_config,
            commands::list_external_plugin_manifests,
            commands::get_user_plugins_dir_cmd,
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

    let show_work = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyW);
    let h3 = handle.clone();
    h3.global_shortcut()
        .on_shortcut(show_work, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = app.emit_to("chat", "walle/toggle-show-work", json!(null));
            }
        })
        .map_err(|e| anyhow::anyhow!(e))?;

    Ok(())
}
