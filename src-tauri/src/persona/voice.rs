//! OS text-to-speech (optional) — extend with `say` / PowerShell / `espeak-ng`.

use tauri::AppHandle;

#[allow(dead_code)]
pub fn speak(_app: &AppHandle, _text: &str) -> Result<(), String> {
    Ok(())
}
