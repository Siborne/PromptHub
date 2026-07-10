import { getDatabase } from "../../../storage/database";
import {
  createPromptRepository,
  type MobilePromptSummary,
} from "./promptRepositoryCore";

export type { MobilePromptSummary } from "./promptRepositoryCore";

export const promptRepository = createPromptRepository(async () => {
  const database = await getDatabase();
  return {
    getAll: (source) => database.getAllAsync(source),
    getFirst: (source, params) => database.getFirstAsync(source, params),
    run: (source, params) => database.runAsync(source, params),
  };
});

export type MobilePromptCreate = Omit<MobilePromptSummary, "updatedAt">;
