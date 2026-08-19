import fs from "node:fs/promises";
import { watch as watchFs } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readOperationState(statePath) {
  const { stdout } = await execFileAsync(
    "/usr/bin/plutil",
    ["-convert", "json", "-o", "-", statePath],
    { encoding: "utf8", maxBuffer: 16 * 1024 },
  );
  const parsed = JSON.parse(stdout);
  return {
    token: String(parsed.operationToken || ""),
    status: String(parsed.status || ""),
    message: String(parsed.message || "").slice(0, 240),
    updatedAt: Number(parsed.updatedAt || 0),
  };
}

export async function writeModeAck(ackPath, operationToken, mode) {
  if (!ackPath) return;
  if (mode !== "control" && mode !== "full")
    throw new Error("Invalid injector ACK mode");
  const temporary = `${ackPath}.${process.pid}.tmp`;
  const payload = `${JSON.stringify(
    {
      operationToken,
      mode,
      injectorPid: process.pid,
      acknowledgedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
  try {
    await fs.writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, ackPath);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

export function isFreshBusyOperation(operation) {
  if (operation.status !== "applying" && operation.status !== "pausing")
    return false;
  const ageSeconds = Date.now() / 1000 - operation.updatedAt;
  const maxAgeSeconds = operation.status === "applying" ? 180 : 90;
  return ageSeconds >= -5 && ageSeconds <= maxAgeSeconds;
}

export async function watchOperationState(statePath, onState) {
  if (!statePath) return () => {};
  const directory = path.dirname(statePath);
  const basename = path.basename(statePath);
  let watcher = null;
  let readTimer = null;
  let readChain = Promise.resolve();
  let closed = false;
  let lastSnapshotKey = "";

  const readLatest = async () => {
    try {
      const operation = await readOperationState(statePath);
      if (!/^\d{1,12}:\d{13}:\d{1,8}$/.test(operation.token)) return;
      const snapshotKey = `${operation.token}:${operation.status}:${operation.updatedAt}`;
      if (snapshotKey === lastSnapshotKey) return;
      lastSnapshotKey = snapshotKey;
      await onState(operation);
    } catch (error) {
      if (!closed && error?.code !== "ENOENT") {
        console.error(
          `[dream-skin] operation state unavailable: ${error.message}`,
        );
      }
    }
  };

  const scheduleRead = () => {
    if (closed) return;
    if (readTimer) clearTimeout(readTimer);
    readTimer = setTimeout(async () => {
      readTimer = null;
      readChain = readChain.then(readLatest);
      await readChain;
    }, 10);
  };

  try {
    watcher = watchFs(directory, { persistent: false }, (_event, filename) => {
      if (!filename || String(filename) === basename) scheduleRead();
    });
    watcher.on("error", (error) => {
      console.error(
        `[dream-skin] operation watch unavailable: ${error.message}`,
      );
    });
  } catch (error) {
    console.error(`[dream-skin] operation watch unavailable: ${error.message}`);
  }

  readChain = readChain.then(readLatest);
  await readChain;

  return () => {
    closed = true;
    if (readTimer) clearTimeout(readTimer);
    watcher?.close();
  };
}
