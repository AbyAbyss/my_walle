//! Simple registry client (read-only JSON over HTTPS).

use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct RegistryPluginRow {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest_url: String,
    pub package_url: String,
}

pub async fn fetch_registry_index(base: &str) -> Result<Vec<RegistryPluginRow>, String> {
    let url = format!("{}/plugins", base.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("registry HTTP {}", res.status()));
    }
    let v: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let arr = v
        .as_array()
        .cloned()
        .or_else(|| v.get("plugins").and_then(|x| x.as_array()).cloned())
        .unwrap_or_default();
    let mut out = Vec::new();
    for item in arr {
        if let Ok(row) = serde_json::from_value::<RegistryPluginRow>(item) {
            out.push(row);
        }
    }
    Ok(out)
}
