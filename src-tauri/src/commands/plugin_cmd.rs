use std::fs;
use std::time::Duration;

use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;

use crate::commands::app_launch::launch_app;
use crate::commands::git;
use crate::commands::scheduler;
use crate::commands::notify::{parse_notify_delay_secs, send_notify, spawn_delayed_notify};
use crate::commands::shell::shell_run;
use crate::commands::user_plugins::{self, ExternalManifestDto};
use crate::agent::learning;
use crate::config;
use crate::memory::task_outcomes;

fn is_builtin_plugin_enabled(app: &AppHandle, plugin: &str) -> Result<bool, String> {
    const BUILTINS: &[&str] = &["shell", "app_launch", "notify"];
    if !BUILTINS.contains(&plugin) {
        return Ok(true);
    }
    let v = config::read_config_json(app)?;
    let arr = v
        .get("plugins")
        .and_then(|p| p.get("enabled"))
        .and_then(|e| e.as_array());
    let Some(arr) = arr else {
        return Ok(true);
    };
    let list: Vec<&str> = arr.iter().filter_map(|x| x.as_str()).collect();
    if list.is_empty() {
        return Ok(true);
    }
    Ok(list.iter().any(|&p| p == plugin))
}

fn assert_builtin_enabled(app: &AppHandle, plugin: &str) -> Result<(), String> {
    if !is_builtin_plugin_enabled(app, plugin)? {
        return Err(format!(
            "The {plugin} plugin is disabled in Settings → Plugins"
        ));
    }
    Ok(())
}

fn assert_git_plugins_allowed(app: &AppHandle) -> Result<(), String> {
    let v = config::read_config_json(app)?;
    let arr = v
        .get("plugins")
        .and_then(|p| p.get("enabled"))
        .and_then(|e| e.as_array());
    let Some(arr) = arr else {
        return Ok(());
    };
    let list: Vec<&str> = arr.iter().filter_map(|x| x.as_str()).collect();
    if list.is_empty() {
        return Ok(());
    }
    if !list.iter().any(|&p| p == "git") {
        return Err("The git plugin is disabled in Settings → Plugins".into());
    }
    Ok(())
}

/// Shell / external plugins can return HTTP OK JSON with non-zero `exit_code`.
fn semantic_success(plugin: &str, result: &Result<serde_json::Value, String>) -> bool {
    match result {
        Err(_) => false,
        Ok(v) => match plugin {
            "shell" | "external" | "ext_shell" => v
                .get("exit_code")
                .and_then(|x| x.as_i64())
                .map(|c| c == 0)
                .unwrap_or(true),
            _ => true,
        },
    }
}

async fn finish_with_outcome(
    app: &AppHandle,
    pool: &SqlitePool,
    plugin: &str,
    command: &str,
    result: Result<serde_json::Value, String>,
) -> Result<serde_json::Value, String> {
    let success = semantic_success(plugin, &result);
    let err = result.as_ref().err().map(|s| s.as_str());
    task_outcomes::record_task_outcome(pool, plugin, command, success, err).await;
    learning::schedule_scan(app.clone(), pool.clone());
    result
}

async fn dispatch_simple_plugin_recorded(
    app: &AppHandle,
    pool: &SqlitePool,
    action: PluginAction,
) -> Result<serde_json::Value, String> {
    let plugin = action.plugin.clone();
    let cmd = task_outcomes::params_summary(&action.params);
    if crate::plugins::recorder::is_recording() {
        crate::plugins::recorder::record_step(action.label.clone(), plugin.clone(), Some(cmd.clone()));
    }
    let res = dispatch_simple_plugin(app, action).await;
    let success = semantic_success(&plugin, &res);
    let err = res.as_ref().err().map(|s| s.as_str());
    task_outcomes::record_task_outcome(pool, &plugin, &cmd, success, err).await;
    learning::schedule_scan(app.clone(), pool.clone());
    res
}

async fn plugin_external_run(app: &AppHandle, params: &serde_json::Value) -> Result<serde_json::Value, String> {
    assert_builtin_enabled(app, "shell")?;
    let plugin_id = params
        .get("plugin_id")
        .or_else(|| params.get("pluginId"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "plugin_id required".to_string())?;
    let command_name = params
        .get("command")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "command required".to_string())?;
    let root = user_plugins::user_plugins_dir(app)?;
    let manifest_path = root.join(plugin_id).join("manifest.json");
    let data = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
    let m: ExternalManifestDto = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let cdef = m
        .commands
        .iter()
        .find(|c| c.name == command_name)
        .ok_or_else(|| format!("unknown command '{command_name}' in plugin {plugin_id}"))?;
    let tpl = cdef
        .shell_template
        .as_ref()
        .ok_or_else(|| "manifest command has no shellTemplate".to_string())?;
    let mut rendered = tpl.clone();
    if let Some(obj) = params.as_object() {
        for (k, v) in obj {
            if matches!(k.as_str(), "plugin_id" | "pluginId" | "command") {
                continue;
            }
            let val = match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Null => String::new(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                other => other.to_string(),
            };
            let needle = "{".to_owned() + "{" + k + "}" + "}";
            rendered = rendered.replace(&needle, &val);
        }
    }
    let out = shell_run(rendered, None).await?;
    Ok(json!({
        "ok": true,
        "stdout": out.stdout,
        "stderr": out.stderr,
        "exit_code": out.exit_code,
    }))
}

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
            assert_builtin_enabled(app, "shell")?;
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
            assert_builtin_enabled(app, "app_launch")?;
            let name = app_name_from_params(&action.params)
                .ok_or_else(|| "missing app".to_string())?;
            launch_app(name).await?;
            Ok(json!({ "ok": true }))
        }
        "notify" => {
            assert_builtin_enabled(app, "notify")?;
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
        "git_status" => {
            assert_git_plugins_allowed(app)?;
            git::plugin_git_status(&action.params).await
        }
        "git_log" => {
            assert_git_plugins_allowed(app)?;
            git::plugin_git_log(&action.params).await
        }
        "git_diff" => {
            assert_git_plugins_allowed(app)?;
            git::plugin_git_diff(&action.params).await
        }
        "git_commit" => {
            assert_git_plugins_allowed(app)?;
            git::plugin_git_commit(&action.params).await
        }
        "git_push" => {
            assert_git_plugins_allowed(app)?;
            git::plugin_git_push(&action.params).await
        }
        "git_checkout" => {
            assert_git_plugins_allowed(app)?;
            git::plugin_git_checkout(&action.params).await
        }
        "external" | "ext_shell" => plugin_external_run(app, &action.params).await,
        _ => Err(format!(
            "plugin {} not supported in this context",
            action.plugin
        )),
    }
}

async fn plugin_schedule_create(
    pool: &SqlitePool,
    params: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "name required".to_string())?
        .trim();
    if name.is_empty() {
        return Err("name required".into());
    }
    let cron_expr = params
        .get("cron_expr")
        .or_else(|| params.get("cronExpr"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| "cron_expr required".to_string())?;
    scheduler::validate_cron(cron_expr)?;
    let actions = params
        .get("actions")
        .ok_or_else(|| "actions required".to_string())?;
    if !actions.is_array() {
        return Err("actions must be a JSON array".into());
    }
    let actions_str = serde_json::to_string(actions).map_err(|e| e.to_string())?;
    scheduler::insert_schedule(pool, name, cron_expr, &actions_str)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true }))
}

async fn plugin_schedule_list(pool: &SqlitePool) -> Result<serde_json::Value, String> {
    let rows = scheduler::list_schedules(pool).await?;
    Ok(json!({ "ok": true, "schedules": rows }))
}

async fn plugin_schedule_delete(
    pool: &SqlitePool,
    params: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let id = params
        .get("id")
        .and_then(|v| v.as_i64())
        .or_else(|| params.get("id").and_then(|v| v.as_u64()).map(|u| u as i64));
    let name = params.get("name").and_then(|v| v.as_str());
    let n = scheduler::delete_schedule_by_name_or_id(pool, name, id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true, "deleted": n }))
}

#[tauri::command]
pub async fn run_plugin_action(app: AppHandle, action: PluginAction) -> Result<serde_json::Value, String> {
    let pool = app.state::<SqlitePool>().inner().clone();
    match action.plugin.as_str() {
        "schedule_create" => {
            let cmd = task_outcomes::params_summary(&action.params);
            let r = plugin_schedule_create(&pool, &action.params).await;
            finish_with_outcome(&app, &pool, "schedule_create", &cmd, r).await
        }
        "schedule_list" => {
            let r = plugin_schedule_list(&pool).await;
            finish_with_outcome(&app, &pool, "schedule_list", "{}", r).await
        }
        "schedule_delete" => {
            let cmd = task_outcomes::params_summary(&action.params);
            let r = plugin_schedule_delete(&pool, &action.params).await;
            finish_with_outcome(&app, &pool, "schedule_delete", &cmd, r).await
        }
        "external" | "ext_shell" => {
            let cmd = task_outcomes::params_summary(&action.params);
            let r = plugin_external_run(&app, &action.params).await;
            finish_with_outcome(&app, &pool, "external", &cmd, r).await
        }
        "run_workflow" => run_workflow_impl(&app, &pool, &action.params).await.map(|summary| {
            json!({ "ok": true, "summary": summary })
        }),
        "chain" => {
            let cmd = task_outcomes::params_summary(&action.params);
            let r = crate::agent::multi_agent::run_chain(&app, &action.params).await;
            finish_with_outcome(&app, &pool, "chain", &cmd, r).await
        },
        _ => dispatch_simple_plugin_recorded(&app, &pool, action).await,
    }
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

async fn run_workflow_impl(
    app: &AppHandle,
    pool: &SqlitePool,
    params: &serde_json::Value,
) -> Result<String, String> {
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
        match dispatch_simple_plugin_recorded(app, pool, action).await {
            Ok(j) => lines.push(format!("{}: {}", label, j)),
            Err(e) => lines.push(format!("{} FAILED: {}", label, e)),
        }
        if idx + 1 < n {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        }
    }
    Ok(lines.join("\n"))
}
