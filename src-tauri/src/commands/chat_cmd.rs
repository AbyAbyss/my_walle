use serde::Deserialize;
use tauri::AppHandle;

use crate::agent::llm::{self, ChatHistoryItem, WalleCompletion};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalleChatPayload {
    pub user_text: String,
    #[serde(default)]
    pub history: Vec<ChatHistoryItem>,
    /// Foreground window title from the frontend (when context injection is enabled).
    #[serde(default)]
    pub active_window_title: Option<String>,
    /// Clipboard preview from the frontend (when clipboard injection is enabled).
    #[serde(default)]
    pub clipboard_preview: Option<String>,
    /// Detected git repo root (when developer mode + auto-detect + inject are on).
    #[serde(default)]
    pub git_repo_path: Option<String>,
    /// Multi-step agent loop: 1-based planner round (omit for legacy single-shot behavior).
    #[serde(default)]
    pub agent_step: Option<u32>,
    /// Max planner rounds configured in `agent.max_iterations` (omit if not using the loop).
    #[serde(default)]
    pub agent_max_steps: Option<u32>,
}

#[tauri::command]
pub async fn walle_chat(app: AppHandle, payload: WalleChatPayload) -> Result<WalleCompletion, String> {
    llm::walle_complete(
        &app,
        &payload.user_text,
        &payload.history,
        payload.active_window_title.as_deref(),
        payload.clipboard_preview.as_deref(),
        payload.git_repo_path.as_deref(),
        payload.agent_step,
        payload.agent_max_steps,
    )
    .await
}
