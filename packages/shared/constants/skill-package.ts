/** Shared limits for every Skill package ingress path. */
export const MAX_SKILL_PACKAGE_FILES = 500;
export const MAX_SKILL_PACKAGE_ENTRIES = 1_000;
// Skills may contain nested templates and examples; keep the traversal bound
// high enough for real repositories while retaining the file, entry, and byte
// budgets that limit package expansion.
export const MAX_SKILL_PACKAGE_DEPTH = 32;
export const MAX_SKILL_PACKAGE_PATH_LENGTH = 1_024;
export const MAX_SKILL_PACKAGE_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SKILL_PACKAGE_TEXT_BYTES = 20 * 1024 * 1024;
export const MAX_SKILL_PACKAGE_TOTAL_BYTES = 100 * 1024 * 1024;
