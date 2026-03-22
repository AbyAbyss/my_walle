use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[cfg(target_os = "windows")]
fn shell_command(command: &str, working_dir: Option<&str>) -> Command {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", command]);
    if let Some(dir) = working_dir {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }
    cmd
}

#[cfg(target_os = "macos")]
fn shell_command(command: &str, working_dir: Option<&str>) -> Command {
    let mut cmd = Command::new("zsh");
    cmd.arg("-c").arg(command);
    if let Some(dir) = working_dir {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }
    cmd
}

#[cfg(all(unix, not(target_os = "macos")))]
fn shell_command(command: &str, working_dir: Option<&str>) -> Command {
    let mut cmd = Command::new("sh");
    cmd.arg("-c").arg(command);
    if let Some(dir) = working_dir {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }
    cmd
}

#[tauri::command]
pub async fn shell_run(command: String, working_dir: Option<String>) -> Result<ShellOutput, String> {
    let output = tauri::async_runtime::spawn_blocking(move || {
        shell_command(&command, working_dir.as_deref()).output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
