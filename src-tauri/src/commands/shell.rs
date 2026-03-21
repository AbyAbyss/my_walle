use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[tauri::command]
pub async fn shell_run(command: String, working_dir: Option<String>) -> Result<ShellOutput, String> {
    // PLATFORM: Windows — PowerShell -NoProfile -Command
    // macOS swap: Command::new("zsh").args(["-c", &command])
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", &command]);
    if let Some(dir) = working_dir {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }
    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
