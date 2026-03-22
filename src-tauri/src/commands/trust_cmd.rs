use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::agent::trust::{self, TrustScoreDto};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustLookupPayload {
    pub plugin: String,
    pub command_summary: String,
}

#[tauri::command]
pub async fn trust_get_for_action(
    pool: State<'_, SqlitePool>,
    payload: TrustLookupPayload,
) -> Result<Option<TrustScoreDto>, String> {
    trust::get_trust_for_plugin_action(&pool, &payload.plugin, &payload.command_summary)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustDecisionPayload {
    pub plugin: String,
    pub command_summary: String,
    pub approved: bool,
}

#[tauri::command]
pub async fn trust_record_user_decision(
    pool: State<'_, SqlitePool>,
    payload: TrustDecisionPayload,
) -> Result<(), String> {
    let (etype, eid) = trust::entity_for_task(&payload.plugin, &payload.command_summary);
    trust::record_user_decision(&pool, etype.to_string(), eid, payload.approved)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trust_list(pool: State<'_, SqlitePool>) -> Result<Vec<TrustScoreDto>, String> {
    trust::list_trust_scores(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustEntityPayload {
    pub entity_type: String,
    pub entity_id: String,
}

#[tauri::command]
pub async fn trust_reset_score(
    pool: State<'_, SqlitePool>,
    payload: TrustEntityPayload,
) -> Result<(), String> {
    trust::reset_trust_score(&pool, &payload.entity_type, &payload.entity_id)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustPinPayload {
    pub entity_type: String,
    pub entity_id: String,
    pub pinned: Option<String>,
}

#[tauri::command]
pub async fn trust_set_pinned(
    pool: State<'_, SqlitePool>,
    payload: TrustPinPayload,
) -> Result<(), String> {
    trust::set_pinned(
        &pool,
        &payload.entity_type,
        &payload.entity_id,
        payload.pinned.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}
