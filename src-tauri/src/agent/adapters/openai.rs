use async_trait::async_trait;
use serde_json::json;

use super::{LLMAdapter, LLMRequest, LLMResponse};
use crate::agent::adapters::types::{LLMConfig, LLMMessage};

pub struct OpenAICompatibleAdapter;

pub static OPENAI_ADAPTER: OpenAICompatibleAdapter = OpenAICompatibleAdapter;

#[async_trait]
impl LLMAdapter for OpenAICompatibleAdapter {
    fn name(&self) -> &'static str {
        "openai-compatible"
    }

    fn requires_api_key(&self, provider: &str) -> bool {
        !provider.eq_ignore_ascii_case("ollama")
    }

    fn is_configured(&self, provider: &str, config: &LLMConfig) -> bool {
        if provider.eq_ignore_ascii_case("openai") {
            return true;
        }
        config.configured_base_url().is_some()
    }

    async fn call(&self, request: &LLMRequest, api_key: Option<&str>) -> Result<LLMResponse, String> {
        let base_url = request
            .base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "base_url is required for this provider".to_string())?;

        let mut messages = request.messages.clone();
        if let Some(system) = request
            .system
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            messages.insert(
                0,
                LLMMessage {
                    role: "system".to_string(),
                    content: system.to_string(),
                },
            );
        }

        let mut request_builder = reqwest::Client::new()
            .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
            .header("content-type", "application/json");

        if let Some(api_key) = api_key.map(str::trim).filter(|value| !value.is_empty()) {
            request_builder = request_builder.bearer_auth(api_key);
        }

        let response = request_builder
            .json(&json!({
                "model": request.model,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
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
                .and_then(|error| error.get("message").or(Some(error)))
                .and_then(|value| value.as_str())
                .map(str::to_string)
                .unwrap_or_else(|| body.to_string());
            return Err(format!("OpenAI-compatible API error: {}", message));
        }

        let content = match body
            .get("choices")
            .and_then(|choices| choices.as_array())
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
        {
            Some(serde_json::Value::String(text)) => text.to_string(),
            Some(serde_json::Value::Array(parts)) => parts
                .iter()
                .filter_map(|part| {
                    part.get("text")
                        .and_then(|value| value.as_str())
                        .map(str::to_string)
                })
                .collect::<Vec<String>>()
                .join(""),
            _ => String::new(),
        };

        Ok(LLMResponse {
            content,
            model: body
                .get("model")
                .and_then(|value| value.as_str())
                .unwrap_or(&request.model)
                .to_string(),
            input_tokens: body
                .get("usage")
                .and_then(|usage| usage.get("prompt_tokens"))
                .and_then(|value| value.as_u64())
                .unwrap_or(0),
            output_tokens: body
                .get("usage")
                .and_then(|usage| usage.get("completion_tokens"))
                .and_then(|value| value.as_u64())
                .unwrap_or(0),
        })
    }
}
