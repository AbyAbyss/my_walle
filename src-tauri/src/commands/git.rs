//! Git — requires `git` on PATH (Windows and macOS).

use std::path::Path;

use serde_json::json;

/// Run `git` in `repo_path` (must be a directory). Returns stdout on success; on failure includes stderr.
pub async fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let cwd = Path::new(repo_path);
    if !cwd.is_dir() {
        return Err(format!("Not a directory: {repo_path}"));
    }
    let path = repo_path.to_string();
    let owned: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
    tauri::async_runtime::spawn_blocking(move || {
        let output = std::process::Command::new("git")
            .args(&owned)
            .current_dir(&path)
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if !output.status.success() {
            let mut msg = format!("git failed ({})", output.status);
            if !stderr.trim().is_empty() {
                msg.push_str("\n");
                msg.push_str(stderr.trim());
            } else if !stdout.trim().is_empty() {
                msg.push_str("\n");
                msg.push_str(stdout.trim());
            }
            return Err(msg);
        }
        Ok(stdout)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn repo_from_params(params: &serde_json::Value) -> Result<String, String> {
    let s = params
        .get("repo_path")
        .or_else(|| params.get("repoPath"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "repo_path required".to_string())?;
    Ok(s.to_string())
}

#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<String, String> {
    run_git(&repo_path, &["status", "--short"]).await
}

#[tauri::command]
pub async fn git_log(repo_path: String, n: u32) -> Result<String, String> {
    let n = n.max(1).min(500);
    run_git(&repo_path, &["log", "--oneline", &format!("-{n}")]).await
}

#[tauri::command]
pub async fn git_diff(repo_path: String, file: Option<String>) -> Result<String, String> {
    match file {
        Some(f) if !f.trim().is_empty() => {
            run_git(&repo_path, &["diff", "--", f.trim()]).await
        }
        _ => run_git(&repo_path, &["diff", "--stat"]).await,
    }
}

#[tauri::command]
pub async fn git_action(repo_path: String, args: Vec<String>) -> Result<String, String> {
    if args.is_empty() {
        return Err("git_action requires at least one argument".into());
    }
    let a: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_git(&repo_path, &a).await
}

/// Current branch name, or `"detached"` / error text.
pub async fn git_current_branch(repo_path: &str) -> String {
    match run_git(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"]).await {
        Ok(s) => {
            let t = s.trim();
            if t.is_empty() {
                "(unknown)".to_string()
            } else {
                t.to_string()
            }
        }
        Err(_) => "(unknown)".to_string(),
    }
}

/// `[GIT CONTEXT]` block for the system prompt (status + short log).
pub async fn format_git_context_for_llm(repo_path: &str) -> Result<String, String> {
    let branch = git_current_branch(repo_path).await;
    let status = run_git(repo_path, &["status", "--short"])
        .await
        .unwrap_or_else(|e| format!("(error) {e}"));
    let log = run_git(repo_path, &["log", "--oneline", "-5"])
        .await
        .unwrap_or_else(|e| format!("(error) {e}"));
    Ok(format!(
        r#"
[GIT CONTEXT]
Repo: {repo} (branch: {branch})
Status:
{status}

Recent commits:
{log}

"#,
        repo = repo_path,
        branch = branch,
        status = status.trim_end(),
        log = log.trim_end(),
    ))
}

/// Executor / plugin helpers (same behavior as Tauri commands).
pub async fn plugin_git_status(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let repo = repo_from_params(params)?;
    let out = run_git(&repo, &["status", "--short"]).await?;
    Ok(json!({ "ok": true, "stdout": out }))
}

pub async fn plugin_git_log(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let repo = repo_from_params(params)?;
    let n = params
        .get("n")
        .and_then(|v| v.as_u64())
        .unwrap_or(10)
        .clamp(1, 500) as u32;
    let out = run_git(&repo, &["log", "--oneline", &format!("-{n}")]).await?;
    Ok(json!({ "ok": true, "stdout": out }))
}

pub async fn plugin_git_diff(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let repo = repo_from_params(params)?;
    let file = params
        .get("file")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let out = match file {
        Some(f) => run_git(&repo, &["diff", "--", f]).await?,
        None => run_git(&repo, &["diff", "--stat"]).await?,
    };
    Ok(json!({ "ok": true, "stdout": out }))
}

pub async fn plugin_git_commit(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let repo = repo_from_params(params)?;
    let message = params
        .get("message")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "message required".to_string())?;
    let out = run_git(&repo, &["commit", "-m", message]).await?;
    Ok(json!({ "ok": true, "stdout": out }))
}

pub async fn plugin_git_push(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let repo = repo_from_params(params)?;
    let remote = params
        .get("remote")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let branch = params
        .get("branch")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let out = match (remote, branch) {
        (Some(r), Some(b)) => run_git(&repo, &["push", r, b]).await?,
        (Some(r), None) => run_git(&repo, &["push", r]).await?,
        (None, Some(b)) => run_git(&repo, &["push", "origin", b]).await?,
        (None, None) => run_git(&repo, &["push"]).await?,
    };
    Ok(json!({ "ok": true, "stdout": out }))
}

pub async fn plugin_git_checkout(params: &serde_json::Value) -> Result<serde_json::Value, String> {
    let repo = repo_from_params(params)?;
    let branch = params
        .get("branch")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "branch required".to_string())?;
    let out = run_git(&repo, &["checkout", branch]).await?;
    Ok(json!({ "ok": true, "stdout": out }))
}
