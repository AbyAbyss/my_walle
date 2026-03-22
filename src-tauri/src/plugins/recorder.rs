//! In-memory recording session for “watch me → plugin”.

use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedStepDto {
    pub label: String,
    pub plugin: String,
    pub command: Option<String>,
}

struct Session {
    started_at: Instant,
    steps: Vec<RecordedStepDto>,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);

pub fn start_session() {
    let mut g = SESSION.lock().unwrap();
    *g = Some(Session {
        started_at: Instant::now(),
        steps: Vec::new(),
    });
}

pub fn stop_session() -> Vec<RecordedStepDto> {
    let mut g = SESSION.lock().unwrap();
    let out = g.take().map(|s| s.steps).unwrap_or_default();
    out
}

pub fn record_step(label: String, plugin: String, command: Option<String>) {
    let mut g = SESSION.lock().unwrap();
    let Some(s) = g.as_mut() else {
        return;
    };
    s.steps.push(RecordedStepDto {
        label,
        plugin,
        command,
    });
}

pub fn is_recording() -> bool {
    SESSION.lock().unwrap().is_some()
}
