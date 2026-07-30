import fs from "fs";
import os from "os";
import path from "path";
import { PassThrough } from "stream";

import { createCliSkillService, runCli } from "@prompthub/core";

export function makeTempRoot(
  tempDirs: string[],
  options: { seedDatabase?: boolean } = {},
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-cli-app-"));
  tempDirs.push(dir);

  if (options.seedDatabase !== false) {
    const templatePath = process.env.PROMPTHUB_CLI_TEST_DB_TEMPLATE;
    if (!templatePath || !fs.existsSync(templatePath)) {
      throw new Error("CLI test database template is unavailable");
    }
    const databasePath = path.join(dir, "user-data", "data", "prompthub.db");
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    fs.copyFileSync(templatePath, databasePath);
  }

  return dir;
}

export function withDataDir(rootDir: string): string[] {
  return ["--data-dir", path.join(rootDir, "user-data")];
}

export async function withTempHome<T>(
  rootDir: string,
  run: (homeDir: string) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const homeDir = path.join(rootDir, "home");
  fs.mkdirSync(homeDir, { recursive: true });

  try {
    process.env.HOME = homeDir;
    return await run(homeDir);
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  }
}

export async function execCli(
  args: string[],
  skillService?: ReturnType<typeof createCliSkillService>,
  ioOptions?: {
    stdin?: PassThrough;
    isInteractive?: boolean;
  },
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli(
    args,
    {
      stdout: (message: string) => stdout.push(message),
      stderr: (message: string) => stderr.push(message),
      ...ioOptions,
    },
    undefined,
    undefined,
    skillService,
  );

  const joinedStdout = stdout.join("\n");
  const joinedStderr = stderr.join("\n");
  const parseMaybeJson = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return undefined;
    }
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };

  return {
    exitCode,
    stdout,
    stderr,
    joinedStdout,
    joinedStderr,
    errorJson: parseMaybeJson(joinedStderr),
    json: parseMaybeJson(joinedStdout),
  };
}
