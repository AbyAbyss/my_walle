mod anthropic;
mod openai;
pub mod types;

use async_trait::async_trait;

pub use types::{LLMConfig, LLMMessage, LLMRequest, LLMResponse};

use anthropic::ANTHROPIC_ADAPTER;
use openai::OPENAI_ADAPTER;

#[async_trait]
pub trait LLMAdapter: Send + Sync {
    fn name(&self) -> &'static str;
    fn requires_api_key(&self, provider: &str) -> bool;
    fn is_configured(&self, provider: &str, config: &LLMConfig) -> bool;
    async fn call(&self, request: &LLMRequest, api_key: Option<&str>) -> Result<LLMResponse, String>;
}

pub fn get_adapter(provider: &str) -> Result<&'static dyn LLMAdapter, String> {
    match provider.to_ascii_lowercase().as_str() {
        "anthropic" => Ok(&ANTHROPIC_ADAPTER),
        "openai" | "ollama" | "openrouter" => Ok(&OPENAI_ADAPTER),
        _ => Err(format!(
            "Unknown provider: {}. Supported: anthropic, openai, ollama, openrouter",
            provider
        )),
    }
}
