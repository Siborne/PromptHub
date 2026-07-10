import { closeDatabase, initDatabase } from "@prompthub/db";

const [dbPath, mode] = process.argv.slice(2);

if (!dbPath || (mode !== "writer" && mode !== "reader")) {
  throw new Error(
    "Usage: database-lock-client <db-path> <writer|reader> [hold-ms]",
  );
}

if (mode === "writer") {
  const database = initDatabase(dbPath);
  try {
    database.exec("BEGIN IMMEDIATE");
    process.stdout.write("writer-ready\n");
    await new Promise<void>((resolve) =>
      process.stdin.once("data", () => resolve()),
    );
    database.exec("COMMIT");
    process.stdout.write("writer-released\n");
  } finally {
    closeDatabase();
  }
} else {
  process.stdout.write("reader-opening\n");
  const startedAt = Date.now();
  const database = initDatabase(dbPath);
  try {
    database.prepare("SELECT COUNT(*) AS count FROM prompts").get();
    process.stdout.write(
      `${JSON.stringify({ result: "opened", waitedMs: Date.now() - startedAt })}\n`,
    );
  } finally {
    closeDatabase();
  }
}
