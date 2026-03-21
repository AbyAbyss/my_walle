//! Anthropic API key storage via OS credential store (never written to disk).
use keyring::Entry;

const SERVICE: &str = "walle";
const USER: &str = "anthropic_api_key";

pub fn save_api_key(key: &str) -> Result<(), String> {
    Entry::new(SERVICE, USER)
        .map_err(|e| e.to_string())?
        .set_password(key)
        .map_err(|e| e.to_string())
}

pub fn get_api_key() -> Result<String, String> {
    Entry::new(SERVICE, USER)
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|e| e.to_string())
}

pub fn clear_api_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE, USER).map_err(|e| e.to_string())?;
    let _ = entry.delete_password();
    Ok(())
}

pub fn has_api_key() -> bool {
    get_api_key().map(|k| !k.is_empty()).unwrap_or(false)
}
