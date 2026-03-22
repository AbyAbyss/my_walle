CREATE TABLE IF NOT EXISTS trust_scores (
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    score           REAL DEFAULT 50.0,
    total_runs      INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs     INTEGER DEFAULT 0,
    last_run        TEXT,
    last_failure    TEXT,
    user_overrides  INTEGER DEFAULT 0,
    pinned          TEXT,
    PRIMARY KEY (entity_type, entity_id)
);
