use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct LLMConfig {
    pub provider: Option<String>,
    pub model: Option<String>,
    pub default_model: Option<String>,
    pub complex_model: Option<String>,
    pub smart_routing: Option<bool>,
    pub base_url: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f64>,
}

impl LLMConfig {
    pub fn provider_name(&self) -> &str {
        self.provider.as_deref().unwrap_or("anthropic")
    }

    pub fn default_model_name(&self) -> &str {
        self.default_model
            .as_deref()
            .or(self.model.as_deref())
            .unwrap_or("claude-haiku-4-5-20251001")
    }

    pub fn complex_model_name(&self) -> &str {
        self.complex_model
            .as_deref()
            .or(self.model.as_deref())
            .unwrap_or(self.default_model_name())
    }

    pub fn smart_routing_enabled(&self) -> bool {
        self.smart_routing.unwrap_or(true)
    }

    pub fn max_tokens_value(&self) -> u32 {
        self.max_tokens.unwrap_or(512)
    }

    pub fn temperature_value(&self) -> f64 {
        self.temperature.unwrap_or(0.7)
    }

    pub fn configured_base_url(&self) -> Option<&str> {
        self.base_url
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct LLMRequest {
    pub model: String,
    pub messages: Vec<LLMMessage>,
    pub system: Option<String>,
    pub max_tokens: u32,
    pub temperature: f64,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    pub content: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
}
