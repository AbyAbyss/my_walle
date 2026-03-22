//! SQLite pool for WALLE memory (`memory.db` under app data dir).

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use tauri::AppHandle;
use tauri::Manager;

/// Opens `memory.db`, creates parent dirs, runs migrations.
pub async fn init_db(app: &AppHandle) -> anyhow::Result<SqlitePool> {
    let base = app.path().app_data_dir()?;
    std::fs::create_dir_all(&base)?;
    let db_path = base.join("memory.db");

    let opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Row;

    #[tokio::test]
    async fn insert_and_read_memory() {
        let pool = SqlitePool::connect("sqlite::memory:?cache=shared")
            .await
            .expect("connect");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrate");

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"INSERT INTO memories (type, key, value, confidence, source, created_at, updated_at, use_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind("preference")
        .bind("test_key")
        .bind("test value")
        .bind(1.0_f64)
        .bind("user")
        .bind(&now)
        .bind(&now)
        .bind(0_i64)
        .execute(&pool)
        .await
        .expect("insert");

        let row = sqlx::query("SELECT key, value FROM memories WHERE key = ?")
            .bind("test_key")
            .fetch_one(&pool)
            .await
            .expect("select");

        assert_eq!(row.get::<String, _>("key"), "test_key");
        assert_eq!(row.get::<String, _>("value"), "test value");
    }
}
