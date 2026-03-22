//! `~/.walle/plugins/` — external manifest-only plugins (Phase 2).

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExternalCommandDto {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub risk: Option<String>,
    #[serde(default, alias = "shell_template")]
    pub shell_template: Option<String>,
    #[serde(default)]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExternalManifestDto {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub commands: Vec<ExternalCommandDto>,
}

pub fn user_plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("home dir: {e}"))?;
    Ok(home.join(".walle").join("plugins"))
}

fn read_manifest(path: &Path) -> Option<ExternalManifestDto> {
    let data = fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Lists one entry per subdirectory that contains a valid `manifest.json`.
#[tauri::command]
pub fn list_external_plugin_manifests(app: AppHandle) -> Result<Vec<ExternalManifestDto>, String> {
    let root = user_plugins_dir(&app)?;
    let _ = fs::create_dir_all(&root);
    let mut out = Vec::new();
    let entries = match fs::read_dir(&root) {
        Ok(e) => e,
        Err(_) => return Ok(out),
    };
    for ent in entries.flatten() {
        let p = ent.path();
        if !p.is_dir() {
            continue;
        }
        let mf = p.join("manifest.json");
        if let Some(m) = read_manifest(&mf) {
            out.push(m);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

#[tauri::command]
pub fn get_user_plugins_dir_cmd(app: AppHandle) -> Result<String, String> {
    let p = user_plugins_dir(&app)?;
    let _ = fs::create_dir_all(&p);
    p.to_str()
        .map(str::to_string)
        .ok_or_else(|| "invalid plugins path".to_string())
}

/// Watches `~/.walle/plugins` and emits `walle/plugins-folder-changed` (debounced).
pub fn spawn_plugins_folder_watcher(app: AppHandle) {
    let Ok(dir) = user_plugins_dir(&app) else {
        return;
    };
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let app_clone = app.clone();
    std::thread::spawn(move || {
        use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher: RecommendedWatcher = match RecommendedWatcher::new(
            move |res: Result<notify::Event, notify::Error>| {
                if res.is_ok() {
                    let _ = tx.send(());
                }
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(_) => return,
        };
        if watcher.watch(&dir, RecursiveMode::NonRecursive).is_err() {
            return;
        }
        loop {
            if rx.recv().is_err() {
                break;
            }
            while rx.recv_timeout(Duration::from_millis(350)).is_ok() {}
            let _ = app_clone.emit("walle/plugins-folder-changed", ());
        }
    });
}
