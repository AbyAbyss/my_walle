CREATE TABLE IF NOT EXISTS memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    confidence  REAL DEFAULT 1.0,
    source      TEXT DEFAULT 'user',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    last_used   TEXT,
    use_count   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    emotion     TEXT,
    timestamp   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_outcomes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin      TEXT NOT NULL,
    command     TEXT NOT NULL,
    success     INTEGER NOT NULL,
    error_msg   TEXT,
    timestamp   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_key  ON memories(key);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
