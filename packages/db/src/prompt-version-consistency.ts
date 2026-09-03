import Database from "./adapter";
import { v4 as uuidv4 } from "uuid";

/**
 * Repair report for prompt version consistency healing.
 * Storage-layer primitive: reconciles `prompts.current_version` with the
 * `prompt_versions` table so canonical graph validation can pass.
 */
export interface PromptVersionConsistencyRepair {
  /** Prompt ids whose `current_version` was rewritten to the stored maximum. */
  repairedPromptIds: string[];
  /** Prompt ids that had no version rows and received a v1 snapshot. */
  createdInitialVersionPromptIds: string[];
}

interface PromptVersionSourceRow {
  id: string;
  current_version: number;
  system_prompt: string | null;
  system_prompt_en: string | null;
  user_prompt: string;
  user_prompt_en: string | null;
  variables: string | null;
  last_ai_response: string | null;
  created_at: number;
}

const SELECT_PROMPT_VERSION_SOURCES = `
  SELECT
    id, current_version, system_prompt, system_prompt_en, user_prompt,
    user_prompt_en, variables, last_ai_response, created_at
  FROM prompts
`;

const INSERT_INITIAL_VERSION = `
  INSERT INTO prompt_versions (
    id, prompt_id, version, system_prompt, system_prompt_en, user_prompt,
    user_prompt_en, variables, note, ai_response, created_at
  ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, NULL, ?, ?)
`;

const UPDATE_CURRENT_VERSION = `
  UPDATE prompts SET current_version = ? WHERE id = ?
`;

/**
 * Make every prompt version set consistent with the canonical graph
 * invariant `max(prompt_versions.version) == prompts.current_version`:
 *
 * - when the prompt has version rows but `current_version` is missing,
 *   stale, or ahead, converge it to the stored maximum version number;
 * - when the prompt has content but no version rows at all, create a v1
 *   snapshot from the current prompt row and set `current_version = 1`.
 *
 * The repair runs inside a single transaction. Healthy prompts are left
 * untouched, and a second pass is a no-op. Prompt content and metadata other
 * than the version pointer are never modified.
 */
export function repairPromptVersionConsistency(
  database: Database,
): PromptVersionConsistencyRepair {
  const repairedPromptIds: string[] = [];
  const createdInitialVersionPromptIds: string[] = [];

  const run = database.transaction(() => {
    const prompts = database
      .prepare(SELECT_PROMPT_VERSION_SOURCES)
      .all() as PromptVersionSourceRow[];
    for (const prompt of prompts) {
      const maxRow = database
        .prepare(
          "SELECT MAX(version) AS maxVersion FROM prompt_versions WHERE prompt_id = ?",
        )
        .get(prompt.id) as { maxVersion: number | null };
      const maxVersion = maxRow.maxVersion;
      if (maxVersion === null) {
        // No version rows: snapshot the current prompt content as version 1.
        database
          .prepare(INSERT_INITIAL_VERSION)
          .run(
            uuidv4(),
            prompt.id,
            prompt.system_prompt,
            prompt.system_prompt_en,
            prompt.user_prompt,
            prompt.user_prompt_en,
            prompt.variables,
            prompt.last_ai_response,
            prompt.created_at,
          );
        if (prompt.current_version !== 1) {
          database
            .prepare(UPDATE_CURRENT_VERSION)
            .run(1, prompt.id);
        }
        createdInitialVersionPromptIds.push(prompt.id);
      } else if (prompt.current_version !== maxVersion) {
        database.prepare(UPDATE_CURRENT_VERSION).run(maxVersion, prompt.id);
        repairedPromptIds.push(prompt.id);
      }
    }
  });
  run();

  return { repairedPromptIds, createdInitialVersionPromptIds };
}
