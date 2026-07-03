import {
  DatabaseAdapter,
  closeDatabase,
  getDatabase,
  initDatabase as dbInit,
  isDatabaseEmpty,
  PromptDB,
  FolderDB,
  RuleDB,
  SkillDB,
  SCHEMA,
  SCHEMA_INDEXES,
  SCHEMA_TABLES,
} from "@prompthub/db";
import type { InitDatabaseHooks } from "@prompthub/db";

import { getDatabasePath } from "./runtime-paths";

export function initDatabase(hooks?: InitDatabaseHooks): DatabaseAdapter.Database {
  return dbInit(getDatabasePath(), hooks);
}

export {
  closeDatabase,
  DatabaseAdapter,
  FolderDB,
  getDatabase,
  isDatabaseEmpty,
  PromptDB,
  RuleDB,
  SCHEMA,
  SCHEMA_INDEXES,
  SCHEMA_TABLES,
  SkillDB,
};
