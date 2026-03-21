use async_trait::async_trait;
use serde_json::json;

use super::{LLMAdapter, LLMRequest, LLMResponse};
use crate::agent::adapters::types::LLMConfig;

pub struct AnthropicAdapter;

pub static ANTHROPIC_ADAPTER: AnthropicAdapter = AnthropicAdapter;

#[async_trait]
impl LLMAdapter for AnthropicAdapter {
    fn name(&self) -> &'static str {
        "anthropic"
    }

    fn requires_api_key(&self, _provider: &str) -> bool {
        true
    }

    fn is_configured(&self, _provider: &str, _config: &LLMConfig) -> bool {
        true
    }

    async fn call(&self, request: &LLMRequest, api_key: Option<&str>) -> Result<LLMResponse, String> {
        let api_key = api_key
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "API key required for provider anthropic".to_string())?;

        let messages: Vec<serde_json::Value> = request
            .messages
            .iter()
            .map(|message| json!({ "role": message.role, "content": message.content }))
            .collect();

        let client = reqwest::Client::new();
        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("content-type", "application/json")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": request.model,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "system": request.system,
                "messages": messages,
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let body: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        if !status.is_success() {
            let message = body
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(|message| message.as_str())
                .map(str::to_string)
                .unwrap_or_else(|| body.to_string());
            return Err(format!("Anthropic API error: {}", message));
        }

        let content_blocks = body
            .get("content")
            .and_then(|content| content.as_array())
            .ok_or_else(|| "missing content from Anthropic".to_string())?;

        let mut parts: Vec<&str> = Vec::new();
        for block in content_blocks {
            let is_text = block.get("type").and_then(|value| value.as_str()) == Some("text");
            if !is_text && block.get("type").is_some() {
                continue;
            }
            if let Some(text) = block.get("text").and_then(|value| value.as_str()) {
                parts.push(text);
            }
        }

        if parts.is_empty() {
            return Err("missing text content from Anthropic".to_string());
        }

        Ok(LLMResponse {
            content: parts.join(""),
            model: body
                .get("model")
                .and_then(|value| value.as_str())
                .unwrap_or(&request.model)
                .to_string(),
            input_tokens: body
                .get("usage")
                .and_then(|usage| usage.get("input_tokens"))
                .and_then(|value| value.as_u64())
                .unwrap_or(0),
            output_tokens: body
                .get("usage")
                .and_then(|usage| usage.get("output_tokens"))
                .and_then(|value| value.as_u64())
                .unwrap_or(0),
        })
    }
}
