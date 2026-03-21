use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::agent::adapters::{get_adapter, LLMConfig, LLMMessage, LLMRequest};
use crate::agent::model_router::select_model;
use crate::config;
use crate::keychain;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatHistoryItem {
    pub role: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WalleCompletion {
    pub raw: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Deserialize)]
struct UserConfig {
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AgentConfig {
    mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WorkflowConfig {
    name: String,
    description: Option<String>,
    #[serde(default)]
    steps: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct PluginsConfig {
    enabled: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct AppConfig {
    user: Option<UserConfig>,
    agent: Option<AgentConfig>,
    llm: LLMConfig,
    workflows: Option<Vec<WorkflowConfig>>,
    plugins: Option<PluginsConfig>,
}

fn normalize_role(role: &str) -> &'static str {
    if role == "assistant" {
        "assistant"
    } else {
        "user"
    }
}

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

fn build_plugin_list(config: &AppConfig) -> String {
    let mut plugins = config
        .plugins
        .as_ref()
        .and_then(|plugins| plugins.enabled.clone())
        .unwrap_or_else(|| vec!["shell".to_string(), "app_launch".to_string(), "notify".to_string()]);

    for workflow_plugin in ["save_workflow", "run_workflow"] {
        if !plugins.iter().any(|plugin| plugin == workflow_plugin) {
            plugins.push(workflow_plugin.to_string());
        }
    }

    plugins
        .into_iter()
        .map(|plugin| match plugin.as_str() {
            "shell" => "- shell: run PowerShell commands (Windows)".to_string(),
            "app_launch" => "- app_launch: open an app by display name".to_string(),
            "notify" => "- notify: OS toast notification".to_string(),
            "save_workflow" => "- save_workflow: save a named multi-step workflow to config".to_string(),
            "run_workflow" => "- run_workflow: run a saved workflow by name".to_string(),
            other => format!("- {}", other),
        })
        .collect::<Vec<String>>()
        .join("\n")
}

fn build_workflow_list(workflows: Option<&Vec<WorkflowConfig>>) -> String {
    match workflows {
        Some(workflows) if !workflows.is_empty() => workflows
            .iter()
            .map(|workflow| {
                let detail = workflow
                    .description
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
                    .map(str::to_string)
                    .unwrap_or_else(|| {
                        workflow
                            .steps
                            .iter()
                            .filter_map(|step| {
                                step.get("label")
                                    .and_then(|label| label.as_str())
                                    .map(str::to_string)
                            })
                            .collect::<Vec<String>>()
                            .join(", ")
                    });
                format!(
                    "- \"{}\": {} steps - {}",
                    workflow.name,
                    workflow.steps.len(),
                    if detail.is_empty() {
                        "no description".to_string()
                    } else {
                        detail
                    }
                )
            })
            .collect::<Vec<String>>()
            .join("\n"),
        _ => "none saved yet".to_string(),
    }
}

fn build_system_prompt(config: &AppConfig) -> String {
    let user_name = config
        .user
        .as_ref()
        .and_then(|user| user.name.as_deref())
        .unwrap_or("User");
    let mode = config
        .agent
        .as_ref()
        .and_then(|agent| agent.mode.as_deref())
        .unwrap_or("manual_review");
    let workflow_list = build_workflow_list(config.workflows.as_ref());
    let plugin_list = build_plugin_list(config);

    format!(
        r#"You are WALLE, a desktop AI companion for {user_name}.
You are compact, direct, and efficient. Max 2 sentences per response.

Available plugins:
{plugin_list}

Saved workflows:
{workflow_list}

OS: Windows - use PowerShell syntax for shell commands
Mode: {mode}
Time: {time}

To save a workflow, use plugin "save_workflow".
To run a saved workflow, use plugin "run_workflow".
Example trigger phrases: "save this as X", "run X", "start X"

When the user asks to run a workflow, return run_workflow in actions. Do not claim a workflow is "already running", "in progress", or "must wait" — the app runs it immediately or reports an error. Never describe blocking/wait states unless the user sees a concrete error.

Respond ONLY with valid JSON - no markdown, no explanation:
{{
  "message": "string (max 2 sentences)",
  "emotion": "idle|thinking|happy|sad|alert|focused|sleeping",
  "actions": [
    {{
      "plugin": "shell|app_launch|notify|save_workflow|run_workflow",
      "label": "plain english description",
      "risk": "low|medium|high",
      "params": {{}}
    }}
  ],
  "requires_approval": false
}}

Params MUST use these exact keys:
- shell: {{ "command": "PowerShell command string" }}
- app_launch: {{ "app": "AppName" }}
- notify: {{ "title": "short title", "body": "message body", "delay_seconds": optional number, "delay_minutes": optional number }}
  For reminders ("remind me in 10 minutes"), set delay_minutes or delay_seconds so the toast fires after that wait. Immediate notify: omit both delay fields.
- save_workflow: {{ "name": "workflow name", "description": "optional", "steps": [ same action objects as above ] }}
- run_workflow: {{ "name": "saved_workflow_name" }}

If mode is manual_review, set requires_approval to true whenever actions are present.
If no action is needed, return an empty actions array.
Always set a valid emotion. Default to "idle" if nothing else fits."#,
        time = chrono::Local::now().to_string(),
    )
}

fn resolve_base_url(provider: &str, llm: &LLMConfig) -> Option<String> {
    if let Some(base_url) = llm.configured_base_url() {
        return Some(base_url.to_string());
    }

    match provider.to_ascii_lowercase().as_str() {
        "openai" => Some("https://api.openai.com/v1".to_string()),
        "openrouter" => Some("https://openrouter.ai/api/v1".to_string()),
        "ollama" => Some("http://localhost:11434/v1".to_string()),
        _ => None,
    }
}

pub fn provider_requires_api_key(app: &AppHandle) -> Result<bool, String> {
    let cfg = config::read_config_string(app)?;
    let parsed: AppConfig = serde_json::from_str(&cfg).map_err(|e| e.to_string())?;
    let provider = parsed.llm.provider_name().to_string();
    let adapter = get_adapter(&provider)?;
    Ok(adapter.requires_api_key(&provider))
}

pub fn current_provider_name(app: &AppHandle) -> Result<String, String> {
    let cfg = config::read_config_string(app)?;
    let parsed: AppConfig = serde_json::from_str(&cfg).map_err(|e| e.to_string())?;
    Ok(parsed.llm.provider_name().to_string())
}

pub async fn walle_complete(
    app: &AppHandle,
    user_text: &str,
    history: &[ChatHistoryItem],
) -> Result<WalleCompletion, String> {
    let cfg_str = config::read_config_string(app)?;
    let parsed: AppConfig = serde_json::from_str(&cfg_str).map_err(|e| e.to_string())?;
    let provider = parsed.llm.provider_name().to_string();
    let adapter = get_adapter(&provider)?;
    if !adapter.is_configured(&provider, &parsed.llm) {
        return Err(format!(
            "Provider {} (adapter: {}) is missing required configuration. Check provider settings and base URL.",
            provider,
            adapter.name(),
        ));
    }

    let api_key = if adapter.requires_api_key(&provider) {
        Some(keychain::get_api_key_for_provider(&provider)?)
    } else {
        None
    };

    let model = select_model(user_text, &parsed.llm);
    let system = build_system_prompt(&parsed);

    let mut combined: Vec<ChatHistoryItem> = history.to_vec();
    combined.push(ChatHistoryItem {
        role: "user".to_string(),
        text: user_text.to_string(),
    });
    let merged = coalesce_history(&combined);
    let messages = merged
        .into_iter()
        .map(|item| LLMMessage {
            role: normalize_role(item.role.trim()).to_string(),
            content: item.text,
        })
        .collect::<Vec<LLMMessage>>();

    let response = adapter
        .call(
            &LLMRequest {
                model: model.clone(),
                messages,
                system: Some(system),
                max_tokens: parsed.llm.max_tokens_value(),
                temperature: parsed.llm.temperature_value(),
                base_url: resolve_base_url(&provider, &parsed.llm),
            },
            api_key.as_deref(),
        )
        .await?;

    Ok(WalleCompletion {
        raw: response.content,
        model: response.model,
        input_tokens: response.input_tokens,
        output_tokens: response.output_tokens,
    })
}
