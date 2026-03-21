use std::time::Duration;

use serde::Deserialize;
use serde_json::json;
use tauri::AppHandle;

use crate::commands::app_launch::launch_app;
use crate::commands::notify::{parse_notify_delay_secs, send_notify, spawn_delayed_notify};
use crate::commands::shell::shell_run;
use crate::config;

/// Resolves the target app name from LLM output (`app` is canonical; `name` / `application` tolerated).
fn app_name_from_params(params: &serde_json::Value) -> Option<String> {
    for key in ["app", "name", "application"] {
        if let Some(s) = params.get(key).and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

#[derive(Debug, Deserialize, Clone)]
pub struct PluginAction {
    pub plugin: String,
    #[allow(dead_code)]
    pub label: String,
    pub params: serde_json::Value,
}

/// Shell / app_launch / notify / save_workflow only (no nested `run_workflow` — avoids recursive async).
async fn dispatch_simple_plugin(app: &AppHandle, action: PluginAction) -> Result<serde_json::Value, String> {
    match action.plugin.as_str() {
        "shell" => {
            let cmd = action
                .params
                .get("command")
                .and_then(|c| c.as_str())
                .ok_or_else(|| "missing command".to_string())?;
            let out = shell_run(cmd.to_string(), None).await?;
            Ok(json!({
                "ok": true,
                "stdout": out.stdout,
                "stderr": out.stderr,
                "exit_code": out.exit_code,
            }))
        }
        "app_launch" => {
            let name = app_name_from_params(&action.params)
                .ok_or_else(|| "missing app".to_string())?;
            launch_app(name).await?;
            Ok(json!({ "ok": true }))
        }
        "notify" => {
            let title = action
                .params
                .get("title")
                .and_then(|c| c.as_str())
                .unwrap_or("WALLE")
                .to_string();
            let body = action
                .params
                .get("body")
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();
            let delay_secs = parse_notify_delay_secs(&action.params);
            if delay_secs == 0 {
                send_notify(app.clone(), title, body).await?;
                Ok(json!({ "ok": true }))
            } else {
                spawn_delayed_notify(app.clone(), title, body, delay_secs);
                Ok(json!({
                    "ok": true,
                    "scheduled": true,
                    "delay_seconds": delay_secs }))
            }
        }
        "save_workflow" => {
            save_workflow_impl(app, &action.params)?;
            Ok(json!({ "ok": true }))
        }
        _ => Err(format!(
            "plugin {} not supported in this context",
            action.plugin
        )),
    }
}

#[tauri::command]
pub async fn run_plugin_action(app: AppHandle, action: PluginAction) -> Result<serde_json::Value, String> {
    if action.plugin == "run_workflow" {
        let summary = run_workflow_impl(&app, &action.params).await?;
        return Ok(json!({ "ok": true, "summary": summary }));
    }
    dispatch_simple_plugin(&app, action).await
}

fn save_workflow_impl(app: &AppHandle, params: &serde_json::Value) -> Result<(), String> {
    let name = params
        .get("name")
        .and_then(|n| n.as_str())
        .ok_or_else(|| "workflow name required".to_string())?;
    let steps = params.get("steps").cloned().ok_or_else(|| "steps required".to_string())?;
    let mut v = config::read_config_json(app)?;
    if !v["workflows"].is_array() {
        v["workflows"] = json!([]);
    }
    let arr = v["workflows"].as_array_mut().unwrap();
    let entry = json!({
        "name": name,
        "description": params.get("description").and_then(|d| d.as_str()).unwrap_or(""),
        "steps": steps,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });
    arr.retain(|w| w["name"].as_str() != Some(name));
    arr.push(entry);
    config::write_config_json(app, &v)
}

fn action_delay_ms(app: &AppHandle) -> u64 {
    config::read_config_json(app)
        .ok()
        .and_then(|v| v.get("agent")?.get("action_delay_ms")?.as_u64())
        .unwrap_or(600)
}

async fn run_workflow_impl(app: &AppHandle, params: &serde_json::Value) -> Result<String, String> {
    let name = params
        .get("name")
        .and_then(|n| n.as_str())
        .ok_or_else(|| "workflow name required".to_string())?;
    let cfg = config::read_config_string(app)?;
    let v: serde_json::Value = serde_json::from_str(&cfg).map_err(|e| e.to_string())?;
    let workflows = v["workflows"].as_array().ok_or_else(|| "no workflows".to_string())?;
    let wf = workflows
        .iter()
        .find(|w| {
            w["name"]
                .as_str()
                .map(|workflow_name| workflow_name.eq_ignore_ascii_case(name))
                .unwrap_or(false)
        })
        .ok_or_else(|| format!("workflow '{}' not found", name))?;
    let steps = wf["steps"].as_array().ok_or_else(|| "invalid workflow steps".to_string())?;
    let delay_ms = action_delay_ms(app);
    let n = steps.len();
    let mut lines = Vec::new();
    for (idx, step) in steps.iter().enumerate() {
        let plugin = step["plugin"].as_str().unwrap_or("").to_string();
        let label = step["label"].as_str().unwrap_or("").to_string();
        let pparams = step["params"].clone();
        let action = PluginAction {
            plugin,
            label: label.clone(),
            params: pparams,
        };
        if action.plugin == "run_workflow" {
            lines.push(format!(
                "{} FAILED: nested run_workflow not supported",
                label
            ));
            if idx + 1 < n {
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
            continue;
        }
        match dispatch_simple_plugin(app, action).await {
            Ok(j) => lines.push(format!("{}: {}", label, j)),
            Err(e) => lines.push(format!("{} FAILED: {}", label, e)),
        }
        if idx + 1 < n {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }
    }
    Ok(lines.join("\n"))
}
