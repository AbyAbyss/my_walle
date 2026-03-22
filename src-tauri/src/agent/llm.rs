use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;

use crate::agent::adapters::{get_adapter, LLMConfig, LLMMessage, LLMRequest};
use crate::agent::model_router::select_model;
use crate::config;
use crate::keychain;
use crate::memory::json_extract;
use crate::memory::reader;
use crate::memory::writer;

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
struct MemoryConfig {
    #[serde(default = "memory_default_enabled")]
    enabled: bool,
    #[serde(default = "memory_default_max_injection")]
    max_memory_injection: u32,
    /// Reserved for future override; DB file is `memory.db` under app data today.
    #[serde(default)]
    #[allow(dead_code)]
    db_path: String,
}

fn memory_default_enabled() -> bool {
    true
}

fn memory_default_max_injection() -> u32 {
    8
}

#[derive(Debug, Deserialize)]
struct ContextConfig {
    #[serde(default = "context_default_inject_window")]
    inject_active_window: bool,
    #[serde(default)]
    inject_clipboard: bool,
}

fn context_default_inject_window() -> bool {
    true
}

#[derive(Debug, Deserialize)]
struct DeveloperModeConfig {
    #[serde(default)]
    enabled: bool,
    /// Parsed for config compatibility; repo detection uses the same keys on the frontend.
    #[serde(default)]
    #[allow(dead_code)]
    watch_dir: String,
    #[serde(default = "dev_default_bool")]
    #[allow(dead_code)]
    auto_detect_repo: bool,
    #[serde(default = "dev_default_bool")]
    inject_git_status: bool,
}

fn dev_default_bool() -> bool {
    true
}

#[derive(Debug, Deserialize)]
struct AppConfig {
    user: Option<UserConfig>,
    agent: Option<AgentConfig>,
    llm: LLMConfig,
    workflows: Option<Vec<WorkflowConfig>>,
    plugins: Option<PluginsConfig>,
    #[serde(default)]
    memory: Option<MemoryConfig>,
    #[serde(default)]
    context: Option<ContextConfig>,
    #[serde(default)]
    developer_mode: Option<DeveloperModeConfig>,
}

fn memory_is_enabled(config: &AppConfig) -> bool {
    config.memory.as_ref().map(|m| m.enabled).unwrap_or(true)
}

fn memory_injection_limit(config: &AppConfig) -> usize {
    config
        .memory
        .as_ref()
        .map(|m| m.max_memory_injection.max(1) as usize)
        .unwrap_or(8)
}

fn context_inject_window(config: &AppConfig) -> bool {
    config
        .context
        .as_ref()
        .map(|c| c.inject_active_window)
        .unwrap_or(true)
}

fn context_inject_clipboard(config: &AppConfig) -> bool {
    config
        .context
        .as_ref()
        .map(|c| c.inject_clipboard)
        .unwrap_or(false)
}

fn developer_mode_enabled(config: &AppConfig) -> bool {
    config
        .developer_mode
        .as_ref()
        .map(|d| d.enabled)
        .unwrap_or(false)
}

fn shell_plugin_list_line() -> String {
    if cfg!(target_os = "windows") {
        "- shell: run PowerShell commands (Windows)".to_string()
    } else if cfg!(target_os = "macos") {
        "- shell: run commands via zsh (macOS)".to_string()
    } else {
        "- shell: run commands in the system shell (Unix)".to_string()
    }
}

fn runtime_os_shell_line() -> &'static str {
    if cfg!(target_os = "windows") {
        "OS: Windows — use PowerShell syntax for shell commands"
    } else if cfg!(target_os = "macos") {
        "OS: macOS — use zsh/bash syntax for shell commands"
    } else {
        "OS: Linux/Unix — use sh/bash syntax for shell commands"
    }
}

fn shell_param_doc_line() -> &'static str {
    if cfg!(target_os = "windows") {
        "- shell: {{ \"command\": \"PowerShell command string\" }}\n- chain: {{ \"agents\": [ {{ \"id\": \"a1\", \"goal\": \"sub-task\", \"depends_on\": [] }} ] }}"
    } else {
        "- shell: {{ \"command\": \"shell command string\" }}\n- chain: {{ \"agents\": [ {{ \"id\": \"a1\", \"goal\": \"sub-task\", \"depends_on\": [] }} ] }}"
    }
}

fn git_plugins_allowed_in_config(config: &AppConfig) -> bool {
    match config.plugins.as_ref().and_then(|p| p.enabled.as_ref()) {
        None => true,
        Some(list) if list.is_empty() => true,
        Some(list) => list.iter().any(|x| x == "git"),
    }
}

fn inject_git_context(config: &AppConfig) -> bool {
    config
        .developer_mode
        .as_ref()
        .map(|d| d.enabled && d.inject_git_status)
        .unwrap_or(false)
}

async fn build_git_context_section(config: &AppConfig, git_repo_path: Option<&str>) -> String {
    if !inject_git_context(config) {
        return String::new();
    }
    let Some(rp) = git_repo_path.map(str::trim).filter(|s| !s.is_empty()) else {
        return String::new();
    };
    match crate::commands::format_git_context_for_llm(rp).await {
        Ok(s) => s,
        Err(e) => format!("\n[GIT CONTEXT]\n(error loading git state: {e})\n\n"),
    }
}

/// Builds `[CONTEXT]` block for the system prompt (omits self-references in the window title).
fn format_context_for_prompt(
    config: &AppConfig,
    active_window_title: Option<&str>,
    clipboard_preview: Option<&str>,
) -> String {
    let mut lines: Vec<String> = Vec::new();
    if context_inject_window(config) {
        if let Some(title) = active_window_title.map(str::trim).filter(|s| !s.is_empty()) {
            if !title.to_ascii_lowercase().contains("walle") {
                lines.push(format!("Active window: {title}"));
            }
        }
    }
    if context_inject_clipboard(config) {
        if let Some(clip) = clipboard_preview.map(str::trim).filter(|s| !s.is_empty()) {
            let preview: String = clip.chars().take(50).collect();
            lines.push(format!("Clipboard: {preview}"));
        }
    }
    if lines.is_empty() {
        return String::new();
    }
    format!(
        r#"
[CONTEXT]
{}

"#,
        lines.join("\n")
    )
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
    for schedule_plugin in ["schedule_create", "schedule_list", "schedule_delete"] {
        if !plugins.iter().any(|plugin| plugin == schedule_plugin) {
            plugins.push(schedule_plugin.to_string());
        }
    }
    if developer_mode_enabled(config) {
        let git_ok = match config.plugins.as_ref().and_then(|p| p.enabled.as_ref()) {
            None => true,
            Some(list) if list.is_empty() => true,
            Some(list) => list.iter().any(|x| x == "git"),
        };
        if git_ok {
            for p in [
                "git_status",
                "git_log",
                "git_diff",
                "git_commit",
                "git_push",
                "git_checkout",
            ] {
                if !plugins.iter().any(|plugin| plugin == p) {
                    plugins.push(p.to_string());
                }
            }
        }
    }

    plugins
        .into_iter()
        .map(|plugin| match plugin.as_str() {
            "shell" => shell_plugin_list_line(),
            "app_launch" => "- app_launch: open an app by display name".to_string(),
            "notify" => "- notify: OS toast notification".to_string(),
            "save_workflow" => "- save_workflow: save a named multi-step workflow to config".to_string(),
            "run_workflow" => "- run_workflow: run a saved workflow by name".to_string(),
            "schedule_create" => {
                "- schedule_create: create a named cron schedule (cron_expr + actions array)".to_string()
            }
            "schedule_list" => "- schedule_list: list saved schedules from SQLite".to_string(),
            "schedule_delete" => "- schedule_delete: delete a schedule by id or name".to_string(),
            "git_status" => "- git_status: git status --short (params: repo_path)".to_string(),
            "git_log" => "- git_log: oneline log (params: repo_path, optional n)".to_string(),
            "git_diff" => "- git_diff: diff --stat or single file (params: repo_path, optional file)".to_string(),
            "git_commit" => "- git_commit: commit -m (params: repo_path, message)".to_string(),
            "git_push" => "- git_push: push (params: repo_path; optional remote, branch)".to_string(),
            "git_checkout" => "- git_checkout: checkout branch (params: repo_path, branch)".to_string(),
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

fn build_system_prompt(
    config: &AppConfig,
    memory_on: bool,
    memory_block: &str,
    context_block: &str,
    git_context_block: &str,
    persona_block: &str,
) -> String {
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
    let git_prompt = developer_mode_enabled(config) && git_plugins_allowed_in_config(config);
    let plugin_union = if git_prompt {
        "shell|app_launch|notify|save_workflow|run_workflow|schedule_create|schedule_list|schedule_delete|git_status|git_log|git_diff|git_commit|git_push|git_checkout|chain"
    } else {
        "shell|app_launch|notify|save_workflow|run_workflow|schedule_create|schedule_list|schedule_delete|chain"
    };
    let git_params = if git_prompt {
        r#"- git_status: {{ "repo_path": "absolute path to .git parent" }}
- git_log: {{ "repo_path": "...", "n": optional number (default 10, max 500) }}
- git_diff: {{ "repo_path": "...", "file": optional relative path }}
- git_commit: {{ "repo_path": "...", "message": "commit message" }}
- git_push: {{ "repo_path": "...", "remote": optional, "branch": optional }}
- git_checkout: {{ "repo_path": "...", "branch": "branch name" }}
"#
    } else {
        ""
    };

    let memory_section = if memory_on {
        format!(
            r#"
[MEMORY — from SQLite]
What I know about you:
{memory_block}

"#,
            memory_block = memory_block,
        )
    } else {
        String::new()
    };

    let json_memories = if memory_on {
        ",\n  \"memories\": [ { \"type\": \"preference\", \"key\": \"short_id\", \"value\": \"memory text\", \"source\": \"user\" } ]"
    } else {
        ""
    };

    let memories_rules = if memory_on {
        "\n\nOptional \"memories\" array: only when you learn something durable about the user (habits, preferences, facts). Omit the field if nothing new. Use source \"user\" only if they stated it explicitly; otherwise \"inferred\" or \"observed\"."
    } else {
        ""
    };

    let persona_section = if persona_block.trim().is_empty() {
        String::new()
    } else {
        format!("\nPersonality: {}\n", persona_block.trim())
    };

    format!(
        r#"You are WALLE, a desktop AI companion for {user_name}.
You are compact, direct, and efficient. Max 2 sentences per response.
{persona_section}{context_block}{git_context_block}{memory_section}
Available plugins:
{plugin_list}

Saved workflows:
{workflow_list}

{os_shell_line}
Mode: {mode}
Time: {time}

To save a workflow, use plugin "save_workflow".
To run a saved workflow, use plugin "run_workflow".
For recurring tasks, use schedule_create with standard 5-field cron (minute hour day month weekday), e.g. "0 9 * * 1-5" = weekdays 9:00. Use schedule_list / schedule_delete to manage.
Example trigger phrases: "save this as X", "run X", "start X", "every morning at 8", "remind me weekdays at 5pm"
{dev_git_hint}

When the user asks to run a workflow, return run_workflow in actions. Do not claim a workflow is "already running", "in progress", or "must wait" — the app runs it immediately or reports an error. Never describe blocking/wait states unless the user sees a concrete error.

Respond ONLY with valid JSON - no markdown, no explanation:
{{
  "message": "string (max 2 sentences)",
  "emotion": "idle|thinking|happy|sad|alert|focused|sleeping",
  "actions": [
    {{
      "plugin": "{plugin_union}",
      "label": "plain english description",
      "risk": "low|medium|high",
      "params": {{}}
    }}
  ],
  "requires_approval": false{json_memories}
}}

Params MUST use these exact keys:
{shell_param_doc}
- app_launch: {{ "app": "AppName" }}
- notify: {{ "title": "short title", "body": "message body", "delay_seconds": optional number, "delay_minutes": optional number }}
  For reminders ("remind me in 10 minutes"), set delay_minutes or delay_seconds so the toast fires after that wait. Immediate notify: omit both delay fields.
- save_workflow: {{ "name": "workflow name", "description": "optional", "steps": [ same action objects as above ] }}
- run_workflow: {{ "name": "saved_workflow_name" }}
- schedule_create: {{ "name": "short label", "cron_expr": "5-field cron", "actions": [ same action objects as above, no schedule_* plugins ] }}
- schedule_list: {{}}
- schedule_delete: {{ "id": number }} OR {{ "name": "schedule name" }}
{git_params}{memories_rules}

If mode is manual_review, set requires_approval to true whenever actions are present.
If no action is needed, return an empty actions array.
Always set a valid emotion. Default to "idle" if nothing else fits."#,
        user_name = user_name,
        persona_section = persona_section,
        context_block = context_block,
        git_context_block = git_context_block,
        dev_git_hint = if git_prompt {
            "\nWhen [GIT CONTEXT] appears above, use the Repo path as repo_path for git_* plugins unless the user specifies another directory.\n"
        } else {
            ""
        },
        memory_section = memory_section,
        plugin_union = plugin_union,
        git_params = git_params,
        plugin_list = plugin_list,
        workflow_list = workflow_list,
        mode = mode,
        json_memories = json_memories,
        memories_rules = memories_rules,
        time = chrono::Local::now().to_string(),
        os_shell_line = runtime_os_shell_line(),
        shell_param_doc = shell_param_doc_line(),
    )
}

async fn apply_memories_from_llm_response(pool: &SqlitePool, raw: &str) {
    let Some(slice) = json_extract::extract_json_object(raw) else {
        return;
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&slice) else {
        return;
    };
    let Some(arr) = v.get("memories").and_then(|m| m.as_array()) else {
        return;
    };
    if arr.is_empty() {
        return;
    }
    let mut items = Vec::new();
    for x in arr {
        if let Ok(i) = serde_json::from_value::<writer::MemoryItemInput>(x.clone()) {
            items.push(i);
        }
    }
    let _ = writer::upsert_memories(pool, &items).await;
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
    active_window_title: Option<&str>,
    clipboard_preview: Option<&str>,
    git_repo_path: Option<&str>,
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

    let pool = app.state::<SqlitePool>();
    let memory_on = memory_is_enabled(&parsed);
    let memory_lines = if memory_on {
        reader::get_relevant_memories(&pool, user_text, memory_injection_limit(&parsed))
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let memory_display = if memory_on {
        reader::format_memory_prompt(&memory_lines)
    } else {
        String::new()
    };
    let context_block = format_context_for_prompt(&parsed, active_window_title, clipboard_preview);
    let git_context_block = build_git_context_section(&parsed, git_repo_path).await;
    let persona_extra = crate::persona::personality_modifier(&app);
    let persona_block = persona_extra.as_deref().unwrap_or("");
    let system = build_system_prompt(
        &parsed,
        memory_on,
        &memory_display,
        &context_block,
        &git_context_block,
        persona_block,
    );

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

    if memory_on {
        apply_memories_from_llm_response(&pool, &response.content).await;
    }

    Ok(WalleCompletion {
        raw: response.content,
        model: response.model,
        input_tokens: response.input_tokens,
        output_tokens: response.output_tokens,
    })
}

/// Minimal LLM call for multi-agent sub-tasks (no memory injection).
pub async fn chain_sub_agent_completion(
    app: &AppHandle,
    goal: &str,
    dependency_context: &str,
) -> Result<WalleCompletion, String> {
    let cfg_str = config::read_config_string(app)?;
    let parsed: AppConfig = serde_json::from_str(&cfg_str).map_err(|e| e.to_string())?;
    let provider = parsed.llm.provider_name().to_string();
    let adapter = get_adapter(&provider)?;
    if !adapter.is_configured(&provider, &parsed.llm) {
        return Err("LLM not configured for chain".into());
    }
    let api_key = if adapter.requires_api_key(&provider) {
        Some(keychain::get_api_key_for_provider(&provider)?)
    } else {
        None
    };
    let model = select_model(goal, &parsed.llm);
    let system = format!(
        "You are a sub-agent in WALLE. Answer concisely with plain text only. No JSON.\n\
         Dependency outputs from other agents:\n{}",
        if dependency_context.trim().is_empty() {
            "(none)"
        } else {
            dependency_context
        }
    );
    let messages = vec![LLMMessage {
        role: "user".into(),
        content: goal.to_string(),
    }];
    let response = adapter
        .call(
            &LLMRequest {
                model: model.clone(),
                messages,
                system: Some(system),
                max_tokens: parsed.llm.max_tokens_value().min(2048),
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
