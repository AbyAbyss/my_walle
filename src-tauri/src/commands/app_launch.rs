use std::process::Command;

#[tauri::command]
pub async fn launch_app(app_name: String) -> Result<(), String> {
    // PLATFORM: Windows — Start-Process via PowerShell
    // macOS swap: Command::new("open").args(["-a", &app_name])
    let cmd = format!("Start-Process '{}'", app_name.replace('\'', "''"));
    Command::new("powershell")
        .args(["-NoProfile", "-Command", &cmd])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
