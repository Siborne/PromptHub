export const MOBILE_DATABASE_VERSION = 1;

export interface MobileSchemaDatabase {
  exec(source: string): Promise<void>;
  getFirst(source: string): Promise<unknown>;
}

export async function initMobileDatabase(
  database: MobileSchemaDatabase,
): Promise<void> {
  const versionRow = await database.getFirst("PRAGMA user_version") as {
    user_version: number;
  } | null;
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion > MOBILE_DATABASE_VERSION) {
    throw new Error(`Unsupported mobile database version: ${currentVersion}`);
  }

  await database.exec("BEGIN");
  try {
    await database.exec(`
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
      PRAGMA user_version = ${MOBILE_DATABASE_VERSION};
    `);
    await database.exec("COMMIT");
  } catch (error) {
    try {
      await database.exec("ROLLBACK");
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Mobile database initialization and rollback failed",
      );
    }
    throw error;
  }
}
