//! Active window title + clipboard preview for LLM context (Phase 2).

use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub fn get_active_window() -> Option<String> {
    active_window_impl()
}

#[cfg(target_os = "windows")]
fn active_window_impl() -> Option<String> {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() {
            return None;
        }
        let mut buf = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len <= 0 {
            return None;
        }
        let n = len as usize;
        Some(String::from_utf16_lossy(&buf[..n]))
    }
}

#[cfg(target_os = "macos")]
fn active_window_impl() -> Option<String> {
    let output = std::process::Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to get name of first process where frontmost is true"#,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

#[cfg(target_os = "linux")]
fn active_window_impl() -> Option<String> {
    let output = std::process::Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

#[cfg(not(any(
    target_os = "windows",
    target_os = "macos",
    target_os = "linux"
)))]
fn active_window_impl() -> Option<String> {
    None
}

/// Returns at most 200 characters of plain text from the clipboard.
#[tauri::command]
pub fn get_clipboard(app: AppHandle) -> Option<String> {
    app.clipboard()
        .read_text()
        .ok()
        .map(|s| s.chars().take(200).collect())
}
