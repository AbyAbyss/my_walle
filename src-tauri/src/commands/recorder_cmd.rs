use crate::plugins::recorder::{self, RecordedStepDto};

#[tauri::command]
pub fn recorder_start() {
    recorder::start_session();
}

#[tauri::command]
pub fn recorder_stop() -> Vec<RecordedStepDto> {
    recorder::stop_session()
}

#[tauri::command]
pub fn recorder_is_active() -> bool {
    recorder::is_recording()
}
