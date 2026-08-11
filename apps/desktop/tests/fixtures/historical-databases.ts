import path from "path";

import Database from "../../src/main/database/sqlite";

export type HistoricalDatabaseFixtureVersion =
  | "0.4.7"
  | "0.4.8"
  | "0.5.1"
  | "0.5.2";

export interface HistoricalDatabaseFixtureDescriptor {
  version: HistoricalDatabaseFixtureVersion;
  tag: string;
  commit: string;
  schemaProfile: "legacy-local" | "shared-auth";
  legacyMigrationNames: readonly string[];
}

export const HISTORICAL_DATABASE_FIXTURES: readonly HistoricalDatabaseFixtureDescriptor[] =
  Object.freeze([
    Object.freeze({
      version: "0.4.7",
      tag: "v0.4.7",
      commit: "709d96ef5c443b52ceb0300212b6998b002136a9",
      schemaProfile: "legacy-local",
      legacyMigrationNames: Object.freeze([
        "backfill_local_repo_path_v1",
        "normalize_skill_version_tracking_v1",
      ]),
    }),
    Object.freeze({
      version: "0.4.8",
      tag: "v0.4.8",
      commit: "bab933950fb9f83c30ffad0773c8798cec8f5b98",
      schemaProfile: "legacy-local",
      legacyMigrationNames: Object.freeze([
        "backfill_local_repo_path_v1",
        "normalize_skill_version_tracking_v1",
      ]),
    }),
    Object.freeze({
      version: "0.5.1",
      tag: "v0.5.1",
      commit: "7b2322b792bf022759ec33436a75f876cc4156fb",
      schemaProfile: "legacy-local",
      legacyMigrationNames: Object.freeze([
        "backfill_local_repo_path_v1",
        "normalize_skill_version_tracking_v1",
        "dedupe_skill_names_v1",
      ]),
    }),
    Object.freeze({
      version: "0.5.2",
      tag: "v0.5.2",
      commit: "0bca71316ecc959696b43b45bf64f51ea9fa8b9d",
      schemaProfile: "shared-auth",
      legacyMigrationNames: Object.freeze([
        "backfill_local_repo_path_v1",
        "normalize_skill_version_tracking_v1",
        "server_auth_tables_v1",
        "dedupe_skill_names_v1",
      ]),
    }),
  ]);

const LEGACY_LOCAL_SCHEMA = `
  CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    is_private INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER,
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
  );
  CREATE TABLE prompts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    prompt_type TEXT DEFAULT 'text',
    system_prompt TEXT,
    user_prompt TEXT NOT NULL,
    variables TEXT,
    tags TEXT,
    folder_id TEXT,
    images TEXT,
    is_favorite INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    current_version INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    source TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
  );
  CREATE TABLE prompt_versions (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    system_prompt TEXT,
    user_prompt TEXT NOT NULL,
    variables TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    UNIQUE(prompt_id, version)
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT,
    mcp_config TEXT,
    protocol_type TEXT DEFAULT 'mcp',
    version TEXT,
    author TEXT,
    tags TEXT,
    is_favorite INTEGER DEFAULT 0,
    current_version INTEGER DEFAULT 0,
    version_tracking_enabled INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE skill_versions (
    id TEXT PRIMARY KEY,
    skill_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT,
    files_snapshot TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE(skill_id, version)
  );
  CREATE TABLE schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`;

function addSharedAuthSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE user_settings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, key)
    );
    ALTER TABLE prompts ADD COLUMN owner_user_id TEXT;
    ALTER TABLE prompts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
    ALTER TABLE prompts ADD COLUMN system_prompt_en TEXT;
    ALTER TABLE prompts ADD COLUMN user_prompt_en TEXT;
    ALTER TABLE prompts ADD COLUMN videos TEXT;
    ALTER TABLE prompts ADD COLUMN last_ai_response TEXT;
    ALTER TABLE prompt_versions ADD COLUMN system_prompt_en TEXT;
    ALTER TABLE prompt_versions ADD COLUMN user_prompt_en TEXT;
    ALTER TABLE prompt_versions ADD COLUMN ai_response TEXT;
    ALTER TABLE folders ADD COLUMN owner_user_id TEXT;
    ALTER TABLE folders ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
    ALTER TABLE skills ADD COLUMN owner_user_id TEXT;
    ALTER TABLE skills ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
  `);
}

function seedHistoricalRows(
  database: Database.Database,
  descriptor: HistoricalDatabaseFixtureDescriptor,
): void {
  const timestamp = Date.UTC(2026, 0, 1);
  database.run(
    `INSERT INTO folders (id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    "folder-history",
    `History ${descriptor.version}`,
    timestamp,
    timestamp,
  );
  database.run(
    `INSERT INTO prompts (
       id, title, user_prompt, variables, tags, folder_id,
       current_version, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "prompt-history",
    `Historical prompt ${descriptor.version}`,
    "Version one",
    "[]",
    '["history"]',
    "folder-history",
    1,
    timestamp,
    timestamp,
  );
  for (let version = 1; version <= 4; version += 1) {
    database.run(
      `INSERT INTO prompt_versions (
         id, prompt_id, version, user_prompt, variables, note, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      `prompt-history-v${version}`,
      "prompt-history",
      version,
      `Version ${version}`,
      "[]",
      `fixture-${descriptor.tag}`,
      timestamp + version,
    );
  }
  database.run(
    `INSERT INTO skills (
       id, name, content, tags, current_version,
       version_tracking_enabled, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    "skill-history",
    `Historical Skill ${descriptor.version}`,
    "# Historical skill",
    '["history"]',
    1,
    1,
    timestamp,
    timestamp,
  );
  database.run(
    `INSERT INTO skill_versions (
       id, skill_id, version, content, note, created_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    "skill-history-v1",
    "skill-history",
    1,
    "# Historical skill",
    `fixture-${descriptor.tag}`,
    timestamp,
  );
  for (const migrationName of descriptor.legacyMigrationNames) {
    database.run(
      `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`,
      migrationName,
      timestamp,
    );
  }
}

export function createHistoricalDatabaseFixture(
  rootPath: string,
  descriptor: HistoricalDatabaseFixtureDescriptor,
): string {
  const dbPath = path.join(rootPath, `prompthub-${descriptor.version}.db`);
  const database = new Database(dbPath);
  database.pragma("foreign_keys = OFF");
  database.exec(LEGACY_LOCAL_SCHEMA);
  if (descriptor.schemaProfile === "shared-auth") {
    addSharedAuthSchema(database);
  }
  if (descriptor.version === "0.5.1" || descriptor.version === "0.5.2") {
    database.exec(
      "CREATE UNIQUE INDEX idx_skills_name_lower ON skills(LOWER(name))",
    );
  }
  seedHistoricalRows(database, descriptor);
  database.close();
  return dbPath;
}
