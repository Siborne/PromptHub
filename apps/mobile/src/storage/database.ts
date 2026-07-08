import * as SQLite from 'expo-sqlite';

export const dbName = 'prompthub.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(dbName);
  }
  return dbInstance;
}

export function initDatabase() {
  const db = getDatabase();

  // Create tables needed for Prompts workspace
  db.execSync(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      user_prompt TEXT NOT NULL,
      variables TEXT,
      tags TEXT,
      is_favorite INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);
  `);
}
