use std::process::Command;

#[cfg(target_os = "windows")]
fn launch_app_impl(app_name: &str) -> Result<(), std::io::Error> {
    let cmd = format!("Start-Process '{}'", app_name.replace('\'', "''"));
    Command::new("powershell")
        .args(["-NoProfile", "-Command", &cmd])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_app_impl(app_name: &str) -> Result<(), std::io::Error> {
    Command::new("open").args(["-a", app_name]).spawn()?;
    Ok(())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn launch_app_impl(_app_name: &str) -> Result<(), std::io::Error> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "app_launch is only wired for Windows and macOS; use the shell plugin on this platform",
    ))
}

#[tauri::command]
pub async fn launch_app(app_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || launch_app_impl(&app_name))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}
