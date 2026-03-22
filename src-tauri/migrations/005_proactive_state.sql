CREATE TABLE IF NOT EXISTS proactive_state (
    watcher_id   TEXT PRIMARY KEY,
    last_nudge   TEXT,
    dismiss_streak INTEGER DEFAULT 0,
    disabled     INTEGER DEFAULT 0
);
