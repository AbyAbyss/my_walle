use serde::Deserialize;
use tauri::AppHandle;

use crate::agent::llm::{self, ChatHistoryItem, WalleCompletion};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalleChatPayload {
    pub user_text: String,
    #[serde(default)]
    pub history: Vec<ChatHistoryItem>,
}

#[tauri::command]
pub async fn walle_chat(app: AppHandle, payload: WalleChatPayload) -> Result<WalleCompletion, String> {
    llm::walle_complete(&app, &payload.user_text, &payload.history).await
}
