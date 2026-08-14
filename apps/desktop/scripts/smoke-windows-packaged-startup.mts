import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "../../../packages/db/src/adapter.ts";

const STARTUP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;
const MAX_CAPTURED_OUTPUT_CHARS = 64 * 1024;

interface StartupEvent {
  event?: unknown;
  status?: unknown;
  error?: unknown;
}

function seedUpgradeProfile(appDataPath: string): string {
  const userDataPath = path.join(appDataPath, "PromptHub");
  fs.mkdirSync(userDataPath, { recursive: true });
  const database = new Database(path.join(userDataPath, "prompthub.db"));
  try {
    database.exec("CREATE TABLE startup_smoke (value TEXT NOT NULL)");
    database.exec("INSERT INTO startup_smoke (value) VALUES ('0.5.9')");
  } finally {
    database.close();
  }

  const markerPath = path.join(
    userDataPath,
    "backups",
    "safety-points",
    "upgrades",
    ".last-run-version.json",
  );
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify({ version: "0.5.9", updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  return userDataPath;
}

function readStartupEvents(logPath: string): StartupEvent[] {
  try {
    return fs
      .readFileSync(logPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StartupEvent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function appendBounded(current: string, chunk: Buffer): string {
  return `${current}${chunk.toString("utf8")}`.slice(
    -MAX_CAPTURED_OUTPUT_CHARS,
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForUpgradeWindow(
  child: ChildProcessWithoutNullStreams,
  logPath: string,
  getOutput: () => string,
): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const events = readStartupEvents(logPath);
    const startupFailure = events.find((entry) =>
      [
        "startup:upgrade_backup_failed_to_bootstrap",
        "startup:canonical_storage_authority_failed",
      ].includes(String(entry.event)),
    );
    if (startupFailure) {
      throw new Error(
        `Packaged startup reported ${String(startupFailure.event)}: ${String(startupFailure.error ?? "unknown error")}`,
      );
    }

    const upgradeCreated = events.some(
      (entry) =>
        entry.event === "startup:upgrade_backup" &&
        entry.status === "snapshot-created",
    );
    const windowReady = events.some(
      (entry) => entry.event === "startup:window_ready",
    );
    if (upgradeCreated && windowReady) return;
    if (child.exitCode !== null) {
      throw new Error(
        `Packaged app exited before startup completed (code ${child.exitCode}).\n${getOutput()}`,
      );
    }
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Timed out waiting for packaged Windows upgrade startup.\n${getOutput()}`,
  );
}

function stopProcessTree(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.pid === undefined) return;
  spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
  });
}

async function main(): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("The packaged Windows startup smoke must run on Windows");
  }
  const executablePath = path.resolve(
    process.argv[2] ?? path.join("dist", "win-unpacked", "PromptHub.exe"),
  );
  if (!fs.existsSync(executablePath)) {
    throw new Error(
      `Packaged PromptHub executable not found: ${executablePath}`,
    );
  }

  const root = fs.mkdtempSync(
    path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "prompthub-win-startup-"),
  );
  const appDataPath = path.join(root, "AppData", "Roaming");
  const localAppDataPath = path.join(root, "AppData", "Local");
  const userProfilePath = path.join(root, "User");
  fs.mkdirSync(localAppDataPath, { recursive: true });
  fs.mkdirSync(userProfilePath, { recursive: true });
  const userDataPath = seedUpgradeProfile(appDataPath);
  const logPath = path.join(userDataPath, "logs", "startup.log");
  let output = "";
  const child = spawn(executablePath, [], {
    env: {
      ...process.env,
      APPDATA: appDataPath,
      LOCALAPPDATA: localAppDataPath,
      USERPROFILE: userProfilePath,
      HOME: userProfilePath,
      CI: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (chunk: Buffer) => {
    output = appendBounded(output, chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output = appendBounded(output, chunk);
  });

  try {
    await waitForUpgradeWindow(child, logPath, () => output);
    console.log(
      "Packaged Windows 0.5.9 upgrade startup reached a loaded window.",
    );
    console.log(fs.readFileSync(logPath, "utf8"));
  } finally {
    stopProcessTree(child);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

await main();
