import {
  DatabaseAdapter,
  closeDatabase,
  getDatabase,
  initDatabase as dbInit,
  isDatabaseEmpty,
  PromptDB,
  PromptOutputFormatDB,
  PromptRelationDB,
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
  PromptOutputFormatDB,
  PromptRelationDB,
  RuleDB,
  SCHEMA,
  SCHEMA_INDEXES,
  SCHEMA_TABLES,
  SkillDB,
};
