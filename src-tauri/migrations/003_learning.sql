CREATE TABLE IF NOT EXISTS patterns (
    id           TEXT PRIMARY KEY,
    description  TEXT NOT NULL,
    trigger      TEXT NOT NULL,
    action       TEXT NOT NULL,
    occurrences  INTEGER DEFAULT 0,
    confidence   REAL DEFAULT 0.0,
    last_seen    TEXT NOT NULL,
    suggested    INTEGER DEFAULT 0,
    accepted     INTEGER
);
