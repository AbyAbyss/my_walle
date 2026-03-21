//! Anthropic API key storage via OS credential store (never written to disk).
use keyring::Entry;

const SERVICE: &str = "walle";
const USER: &str = "anthropic_api_key";
const LEGACY_USER: &str = "anthropic_api_key";

fn normalize_provider(provider: &str) -> &'static str {
    match provider.trim().to_ascii_lowercase().as_str() {
        "anthropic" => "anthropic",
        "openai" => "openai",
        "openrouter" => "openrouter",
        "ollama" => "ollama",
        _ => "anthropic",
    }
}

fn user_for_provider(provider: &str) -> String {
    format!("{}_api_key", normalize_provider(provider))
}

pub fn save_api_key_for_provider(provider: &str, key: &str) -> Result<(), String> {
    Entry::new(SERVICE, &user_for_provider(provider))
        .map_err(|e| e.to_string())?
        .set_password(key)
        .map_err(|e| e.to_string())
}

pub fn save_api_key(key: &str) -> Result<(), String> {
    save_api_key_for_provider("anthropic", key)
}

pub fn get_api_key_for_provider(provider: &str) -> Result<String, String> {
    let normalized = normalize_provider(provider);
    if normalized == "anthropic" {
        if let Ok(entry) = Entry::new(SERVICE, USER) {
            if let Ok(password) = entry.get_password() {
                return Ok(password);
            }
        }
        return Entry::new(SERVICE, LEGACY_USER)
            .map_err(|e| e.to_string())?
            .get_password()
            .map_err(|e| e.to_string());
    }

    Entry::new(SERVICE, &user_for_provider(normalized))
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|e| e.to_string())
}

pub fn get_api_key() -> Result<String, String> {
    get_api_key_for_provider("anthropic")
}

pub fn clear_api_key_for_provider(provider: &str) -> Result<(), String> {
    let normalized = normalize_provider(provider);
    let entry = Entry::new(SERVICE, &user_for_provider(normalized)).map_err(|e| e.to_string())?;
    let _ = entry.delete_password();

    if normalized == "anthropic" {
        if let Ok(legacy_entry) = Entry::new(SERVICE, LEGACY_USER) {
            let _ = legacy_entry.delete_password();
        }
    }
    Ok(())
}

pub fn clear_api_key() -> Result<(), String> {
    clear_api_key_for_provider("anthropic")
}

pub fn has_api_key_for_provider(provider: &str) -> bool {
    get_api_key_for_provider(provider)
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false)
}

pub fn has_api_key() -> bool {
    get_api_key().map(|key| !key.trim().is_empty()).unwrap_or(false)
}
