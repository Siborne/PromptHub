import * as SQLite from "expo-sqlite";
import { initMobileDatabase } from "./mobileSchema";

export const dbName = "prompthub.db";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(dbName)
      .then(async (database) => {
        await initMobileDatabase({
          exec: (source) => database.execAsync(source),
          getFirst: (source) => database.getFirstAsync(source),
        });
        return database;
      })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  }
  return databasePromise;
}

export async function initDatabase(): Promise<void> {
  await getDatabase();
}
