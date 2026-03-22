use serde::Serialize;
use tauri::AppHandle;

use crate::config;
use crate::plugins::registry::RegistryPluginRow;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplacePluginRow {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest_url: String,
    pub package_url: String,
}

#[tauri::command]
pub async fn marketplace_search(app: AppHandle, query: String) -> Result<Vec<MarketplacePluginRow>, String> {
    let cfg = config::read_config_json(&app)?;
    let base = cfg
        .get("marketplace")
        .and_then(|m| m.get("registry_url"))
        .and_then(|x| x.as_str())
        .unwrap_or("https://registry.walle.dev/v1");
    let rows = crate::plugins::registry::fetch_registry_index(base).await?;
    let q = query.to_lowercase();
    Ok(rows
        .into_iter()
        .filter(|r| {
            r.name.to_lowercase().contains(&q) || r.id.to_lowercase().contains(&q)
        })
        .map(|r: RegistryPluginRow| MarketplacePluginRow {
            id: r.id,
            name: r.name,
            version: r.version,
            manifest_url: r.manifest_url,
            package_url: r.package_url,
        })
        .collect())
}
