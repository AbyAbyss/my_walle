use serde::Deserialize;
use serde_json::json;
use tauri::AppHandle;

use crate::config;
use crate::keychain;

#[derive(Debug, Clone, Deserialize)]
pub struct ChatHistoryItem {
    pub role: String,
    pub text: String,
}

fn normalize_role(role: &str) -> &'static str {
    if role == "assistant" {
        "assistant"
    } else {
        "user"
    }
}

/// Merge consecutive same-role turns so the API always alternates user/assistant.
fn coalesce_history(items: &[ChatHistoryItem]) -> Vec<ChatHistoryItem> {
    let mut out: Vec<ChatHistoryItem> = Vec::new();
    for h in items {
        let r = normalize_role(h.role.trim());
        if let Some(last) = out.last_mut() {
            if normalize_role(last.role.trim()) == r {
                last.text.push_str("\n\n");
                last.text.push_str(&h.text);
                continue;
            }
        }
        out.push(ChatHistoryItem {
            role: r.to_string(),
            text: h.text.clone(),
        });
    }
    out
}

pub async fn walle_complete(
    app: &AppHandle,
    user_text: &str,
    history: &[ChatHistoryItem],
) -> Result<String, String> {
    let api_key = keychain::get_api_key()?;
    let cfg_str = config::read_config_string(app)?;
    let v: serde_json::Value = serde_json::from_str(&cfg_str).map_err(|e| e.to_string())?;

    let model = v["llm"]["model"]
        .as_str()
        .unwrap_or("claude-sonnet-4-20250514");
    let max_tokens = v["llm"]["max_tokens"].as_u64().unwrap_or(2048) as u32;
    let temperature = v["llm"]["temperature"].as_f64().unwrap_or(0.7);

    let user_name = v["user"]["name"].as_str().unwrap_or("User");
    let mode = v["agent"]["mode"].as_str().unwrap_or("manual_review");
    let workflows = &v["workflows"];
    let wf_list = if workflows.is_array() && !workflows.as_array().unwrap().is_empty() {
        serde_json::to_string(workflows).unwrap_or_else(|_| "[]".to_string())
    } else {
        "none saved yet".to_string()
    };

    let system = format!(
        r#"You are WALLE, a compact and clever desktop AI companion living on {user_name}'s screen.
You have a personality: curious, efficient, occasionally witty, never verbose.
You respond in short, clear sentences. You do not ramble.

You have access to these tools:
- shell: run PowerShell commands (Windows)
- app_launch: open an app by display name
- notify: OS toast notification
- save_workflow: save a named multi-step workflow to config
- run_workflow: run a saved workflow by name

Operating system: Windows (use PowerShell for shell commands)
Current mode: {mode}
Current time: {time}

Saved workflows (JSON or "none saved yet"): {wf_list}

When you want to take an action, respond ONLY with this JSON structure:
{{
  "message": "What you say to the user (keep it under 2 sentences)",
  "emotion": "idle | thinking | happy | sad | alert | focused | sleeping",
  "actions": [
    {{
      "plugin": "shell | app_launch | notify | save_workflow | run_workflow",
      "label": "Plain English description",
      "risk": "low | medium | high",
      "params": {{ }}
    }}
  ],
  "requires_approval": false
}}

Params MUST use these exact keys (do not omit or rename):
- shell: {{ "command": "PowerShell command string" }}
- app_launch: {{ "app": "AppName" }} — the key MUST be "app" (e.g. "PowerShell", "Chrome", "notepad"). Never leave params empty for app_launch.
- notify: {{ "title": "short title", "body": "message body" }}
- save_workflow: {{ "name": "my_flow", "description": "optional", "steps": [ same action objects as above ] }}
- run_workflow: {{ "name": "saved_workflow_name" }}

Example app_launch action: {{ "plugin": "app_launch", "label": "Open PowerShell", "risk": "low", "params": {{ "app": "PowerShell" }} }}

For shell or any action that produces output: do not promise live streaming. The app shows raw output in the next chat bubble; a follow-up reply will summarize it when needed—the user does not have to send another message for that.

If mode is manual_review, always set requires_approval: true for any action.
If risk is "high", always set requires_approval: true regardless of mode.
If no action is needed (conversation only), return an empty actions array.
Always set a valid emotion. Default to "idle" if nothing else fits.
Never explain your JSON. Just return it."#,
        user_name = user_name,
        mode = mode,
        time = chrono::Local::now().to_rfc3339(),
        wf_list = wf_list
    );

    anthropic_messages(
        &api_key,
        model,
        max_tokens,
        temperature,
        &system,
        history,
        user_text,
    )
    .await
}

async fn anthropic_messages(
    api_key: &str,
    model: &str,
    max_tokens: u32,
    temperature: f64,
    system: &str,
    history: &[ChatHistoryItem],
    user_text: &str,
) -> Result<String, String> {
    let mut combined: Vec<ChatHistoryItem> = history.to_vec();
    combined.push(ChatHistoryItem {
        role: "user".to_string(),
        text: user_text.to_string(),
    });
    let merged = coalesce_history(&combined);

    let mut messages: Vec<serde_json::Value> = Vec::new();
    for h in merged {
        let role = normalize_role(h.role.trim());
        messages.push(json!({ "role": role, "content": h.text }));
    }

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&json!({
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": messages
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let t = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error: {}", t));
    }

    let body: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    extract_anthropic_text(&body)
}

fn extract_anthropic_text(body: &serde_json::Value) -> Result<String, String> {
    let content = body
        .get("content")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "missing content from Anthropic".to_string())?;

    let mut parts: Vec<&str> = Vec::new();
    for block in content {
        let is_text = block.get("type").and_then(|t| t.as_str()) == Some("text");
        if !is_text && block.get("type").is_some() {
            continue;
        }
        if let Some(t) = block.get("text").and_then(|x| x.as_str()) {
            parts.push(t);
        }
    }

    if parts.is_empty() {
        return Err("missing text content from Anthropic".to_string());
    }
    Ok(parts.join(""))
}
