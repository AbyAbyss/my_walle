CREATE TABLE IF NOT EXISTS schedules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    cron_expr   TEXT NOT NULL,
    actions     TEXT NOT NULL,
    enabled     INTEGER DEFAULT 1,
    last_run    TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
