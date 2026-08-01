// Database adapter
export { default as DatabaseAdapter } from "./adapter";
export type { default as Database } from "./adapter";

// Schema
export { SCHEMA_TABLES, SCHEMA_INDEXES, SCHEMA } from "./schema";

// Initialization
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  isDatabaseEmpty,
  db,
} from "./init";
export type { InitDatabaseHooks } from "./init";
export {
  acquireDatabaseClientLease,
  inspectDatabaseClientLock,
  recoverDatabaseClientLock,
} from "./database-client-lock";
export type {
  DatabaseClientLease,
  DatabaseClientLeaseOptions,
  DatabaseLockInspection,
  DatabaseLockRecoveryReason,
  DatabaseLockRecoveryResult,
} from "./database-client-lock";

// DB classes
export { PromptDB } from "./prompt";
export { PromptRelationDB } from "./prompt-relation";
export { PromptOutputFormatDB } from "./prompt-output-format";
export { FolderDB } from "./folder";
export { SkillDB } from "./skill";
export { RuleDB } from "./rule";
export { AgentProviderProfileDB } from "./agent-provider-profile";
export { AgentSessionIndexDB } from "./agent-session-index";
export { AgentConversationDB } from "./agent-conversation";
