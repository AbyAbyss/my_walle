//! Programmatic window creation for mascot, chat, and setup.
use tauri::webview::WebviewWindowBuilder;
use tauri::AppHandle;
use tauri::LogicalPosition;
use tauri::Manager;
use tauri::WebviewUrl;

pub fn create_setup_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window("setup").is_some() {
        return Ok(());
    }
    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no primary monitor".to_string())?;
    let size = monitor.size();
    let pos = monitor.position();
    let scale = monitor.scale_factor();
    let w = size.width as f64 / scale;
    let h = size.height as f64 / scale;
    let lx = pos.x as f64 / scale;
    let ly = pos.y as f64 / scale;
    let x = lx + (w - 520.0) / 2.0;
    let y = ly + (h - 420.0) / 2.0;

    WebviewWindowBuilder::new(app, "setup", WebviewUrl::App("setup.html".into()))
        .title("WALLE — Setup")
        .inner_size(520.0, 420.0)
        .resizable(false)
        .position(x, y)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn create_mascot_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window("mascot").is_some() {
        return Ok(());
    }
    let (x, y) = crate::config::resolve_mascot_logical_position(app)?;
    WebviewWindowBuilder::new(app, "mascot", WebviewUrl::App("mascot.html".into()))
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(220.0, 300.0)
        .shadow(false)
        .position(x, y)
        .build()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    {
        if let Some(w) = app.get_webview_window("mascot") {
            let _ = mascot_macos_set_floating_level(&w);
        }
    }
    Ok(())
}

/// Phase 2 / macOS: float above normal windows (same as `NSFloatingWindowLevel`).
#[cfg(target_os = "macos")]
fn mascot_macos_set_floating_level<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> Result<(), String> {
    window
        .with_webview(|webview| {
            unsafe {
                use objc2_app_kit::{NSFloatingWindowLevel, NSWindow};
                let ns_window: &NSWindow = &*webview.ns_window().cast();
                ns_window.setLevel(NSFloatingWindowLevel);
            }
        })
        .map_err(|e| e.to_string())
}

/// Chat panel: glass-style, hidden until toggled.
pub fn create_chat_window(app: &AppHandle, visible: bool) -> Result<(), String> {
    if app.get_webview_window("chat").is_some() {
        return Ok(());
    }
    let mascot = app
        .get_webview_window("mascot")
        .ok_or_else(|| "mascot window missing".to_string())?;
    let pos = mascot
        .outer_position()
        .map_err(|e| e.to_string())?;
    let scale = mascot.scale_factor().map_err(|e| e.to_string())?;
    let lx = pos.x as f64 / scale;
    let ly = pos.y as f64 / scale;
    // Position to the left of mascot
    let chat_x = lx - 390.0;
    let chat_y = ly - 420.0;

    WebviewWindowBuilder::new(app, "chat", WebviewUrl::App("chat.html".into()))
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(380.0, 620.0)
        .shadow(false)
        .position(chat_x.max(0.0), chat_y.max(0.0))
        .visible(visible)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Settings: glass panel, hidden until opened from chat.
pub fn create_settings_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window("settings").is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .inner_size(720.0, 780.0)
        .visible(false)
        .center()
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn toggle_chat_visibility(app: &AppHandle) -> Result<bool, String> {
    if app.get_webview_window("chat").is_none() {
        create_chat_window(app, false)?;
    }
    reposition_chat_near_mascot(app)?;
    let chat = app
        .get_webview_window("chat")
        .ok_or_else(|| "chat window missing".to_string())?;
    let vis = chat.is_visible().map_err(|e| e.to_string())?;
    if vis {
        chat.hide().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        chat.show().map_err(|e| e.to_string())?;
        chat.set_focus().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

pub fn reposition_chat_near_mascot(app: &AppHandle) -> Result<(), String> {
    let Some(mascot) = app.get_webview_window("mascot") else {
        return Ok(());
    };
    let Some(chat) = app.get_webview_window("chat") else {
        return Ok(());
    };
    let pos = mascot.outer_position().map_err(|e| e.to_string())?;
    let scale = mascot.scale_factor().map_err(|e| e.to_string())?;
    let lx = pos.x as f64 / scale;
    let ly = pos.y as f64 / scale;
    let chat_x = lx - 390.0;
    let chat_y = ly - 420.0;
    chat
        .set_position(LogicalPosition::new(
            chat_x.max(0.0),
            chat_y.max(0.0),
        ))
        .map_err(|e| e.to_string())?;
    Ok(())
}
