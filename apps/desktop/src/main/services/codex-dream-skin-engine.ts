import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type {
  AgentAppearanceThemeEngine,
  DreamSkinThemePackage,
} from "./agent-appearance-service";
import { readDreamSkinImageMetadata } from "./codex-dream-skin-image";

export const CODEX_DREAM_SKIN_VERSION = "1.2.0";
export const CODEX_DREAM_SKIN_COMMIT =
  "3af1d6d62f3a0388cc640d2f497ac3100998938e";
export const CODEX_DREAM_SKIN_LAST_VERIFIED = "26.707.72221";

const MAX_CONFIG_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const APPEARANCES = new Set(["auto", "light", "dark"]);
const SAFE_AREAS = new Set(["auto", "left", "right", "center", "none"]);
const TASK_MODES = new Set(["auto", "ambient", "banner", "off"]);
const COLOR_KEYS = new Set([
  "background",
  "panel",
  "panelAlt",
  "accent",
  "accentAlt",
  "secondary",
  "highlight",
  "text",
  "muted",
  "line",
]);
const COLOR_VALUE = /^(?:#[0-9a-f]{6}|rgba?\([0-9., %]+\))$/i;

export interface DreamSkinCommandOptions {
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}

export type DreamSkinCommandRunner = (
  executable: string,
  args: string[],
  options: DreamSkinCommandOptions,
) => Promise<{ stdout: string; stderr: string }>;

export interface CodexDreamSkinEngineOptions {
  runtimeRoot: string;
  stateRoot: string;
  platform?: NodeJS.Platform;
  runCommand?: DreamSkinCommandRunner;
}

const execFileAsync = promisify(execFile);

async function defaultRunCommand(
  executable: string,
  args: string[],
  options: DreamSkinCommandOptions,
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(executable, args, {
    encoding: "utf8",
    env: options.env,
    maxBuffer: 4 * 1024 * 1024,
    timeout: options.timeoutMs,
    windowsHide: true,
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

function assertContained(root: string, candidate: string, label: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  ) {
    return;
  }
  throw new Error(`${label} must stay inside its theme directory`);
}

async function readStableFile(
  filename: string,
  label: string,
  maxBytes: number,
): Promise<Buffer> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(
      filename,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error(`${label} must not be a symlink`);
    }
    throw error;
  }
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error(`${label} must be a regular file`);
    if (before.size < 1 || before.size > maxBytes) {
      throw new Error(`${label} exceeds the size limit`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      throw new Error(`${label} changed while it was being read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function decodeJson(bytes: Buffer): Record<string, unknown> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Theme config must use valid UTF-8");
  }
  if (text.includes("\0")) throw new Error("Theme config contains NUL bytes");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Theme config is not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Theme config must be an object");
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) {
    throw new Error(`Theme ${field} is invalid`);
  }
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > maxLength) {
    throw new Error(`Theme ${field} is invalid`);
  }
  return normalized;
}

function validateOptionalChoice(
  value: unknown,
  field: string,
  choices: Set<string>,
): void {
  if (
    value !== undefined &&
    (typeof value !== "string" || !choices.has(value))
  ) {
    throw new Error(`Theme ${field} is invalid`);
  }
}

function validateThemeConfig(config: Record<string, unknown>): {
  id: string;
  name: string;
  image: string;
} {
  if (config.schemaVersion !== 1) {
    throw new Error("Theme schemaVersion must be 1");
  }
  const id = requireText(config.id, "id", 128);
  if (!SAFE_ID.test(id) || id.includes("..")) {
    throw new Error("Theme id is invalid");
  }
  const name = requireText(config.name, "name", 80);
  const image = requireText(config.image, "image", 255);
  if (
    path.basename(image) !== image ||
    !IMAGE_EXTENSIONS.has(path.extname(image).toLowerCase())
  ) {
    throw new Error("Theme image must stay inside its theme directory");
  }
  validateOptionalChoice(config.appearance, "appearance", APPEARANCES);
  validateArt(config.art);
  validateColors(config.colors);
  for (const [field, limit] of [
    ["brandSubtitle", 80],
    ["tagline", 160],
    ["projectPrefix", 80],
    ["projectLabel", 80],
    ["statusText", 80],
    ["quote", 80],
  ] as const) {
    if (config[field] !== undefined) requireText(config[field], field, limit);
  }
  return { id, name, image };
}

function validateArt(value: unknown): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Theme art is invalid");
  }
  const art = value as Record<string, unknown>;
  for (const field of ["focusX", "focusY"] as const) {
    const coordinate = art[field];
    if (
      coordinate !== undefined &&
      (typeof coordinate !== "number" ||
        !Number.isFinite(coordinate) ||
        coordinate < 0 ||
        coordinate > 1)
    ) {
      throw new Error(`Theme art.${field} is invalid`);
    }
  }
  validateOptionalChoice(art.safeArea, "art.safeArea", SAFE_AREAS);
  validateOptionalChoice(art.taskMode, "art.taskMode", TASK_MODES);
}

function validateColors(value: unknown): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Theme colors is invalid");
  }
  for (const [key, color] of Object.entries(value)) {
    if (
      !COLOR_KEYS.has(key) ||
      typeof color !== "string" ||
      !COLOR_VALUE.test(color.trim())
    ) {
      throw new Error(`Theme colors.${key} is invalid`);
    }
  }
}

async function replaceDirectoryAtomically(
  target: string,
  theme: DreamSkinThemePackage,
): Promise<void> {
  const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  const staging = path.join(parent, `.stage-${process.pid}-${Date.now()}`);
  const backup = path.join(parent, `.backup-${process.pid}-${Date.now()}`);
  let backedUp = false;
  try {
    await fs.mkdir(staging, { mode: 0o700 });
    await fs.writeFile(path.join(staging, theme.imageName), theme.imageBytes, {
      mode: 0o600,
      flag: "wx",
    });
    await fs.writeFile(path.join(staging, "theme.json"), theme.configBytes, {
      mode: 0o600,
      flag: "wx",
    });
    try {
      await fs.rename(target, backup);
      backedUp = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.rename(staging, target);
    if (backedUp) await fs.rm(backup, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    if (backedUp) {
      await fs.rm(target, { recursive: true, force: true });
      await fs.rename(backup, target).catch(() => undefined);
    }
    throw error;
  }
}

export class CodexDreamSkinEngine implements AgentAppearanceThemeEngine {
  readonly version = CODEX_DREAM_SKIN_VERSION;
  readonly sourceCommit = CODEX_DREAM_SKIN_COMMIT;
  readonly adapterLastVerifiedVersion = CODEX_DREAM_SKIN_LAST_VERIFIED;
  private readonly platform: NodeJS.Platform;
  private readonly runCommand: DreamSkinCommandRunner;

  constructor(private readonly options: CodexDreamSkinEngineOptions) {
    this.platform = options.platform ?? process.platform;
    this.runCommand = options.runCommand ?? defaultRunCommand;
  }

  getBundledThemeDirectories(): string[] {
    return [path.join(this.options.runtimeRoot, "themes", "dream-portal")];
  }

  async readThemePackage(
    directoryPath: string,
  ): Promise<DreamSkinThemePackage> {
    const directory = await fs.lstat(directoryPath);
    if (directory.isSymbolicLink()) {
      throw new Error("Theme directory must not be a symlink");
    }
    if (!directory.isDirectory())
      throw new Error("Theme source must be a directory");
    const root = await fs.realpath(directoryPath);
    const configPath = path.join(root, "theme.json");
    assertContained(root, configPath, "Theme config");
    const configBytes = await readStableFile(
      configPath,
      "Theme config",
      MAX_CONFIG_BYTES,
    );
    const config = decodeJson(configBytes);
    const normalized = validateThemeConfig(config);
    const requestedImage = path.join(root, normalized.image);
    assertContained(root, requestedImage, "Theme image");
    const requestedImageEntry = await fs
      .lstat(requestedImage)
      .catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new Error("Theme image is missing");
        }
        throw error;
      });
    if (requestedImageEntry.isSymbolicLink()) {
      throw new Error("Theme image must not be a symlink");
    }
    if (!requestedImageEntry.isFile()) {
      throw new Error("Theme image must be a regular file");
    }
    const imagePath = await fs.realpath(requestedImage).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error("Theme image is missing");
      }
      throw error;
    });
    assertContained(root, imagePath, "Theme image");
    const imageBytes = await readStableFile(
      imagePath,
      "Theme image",
      MAX_IMAGE_BYTES,
    );
    const extension = path.extname(normalized.image).toLowerCase();
    if (!readDreamSkinImageMetadata(imageBytes, extension)) {
      throw new Error("Theme image dimensions or format are invalid");
    }
    const mime =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return {
      schemaVersion: 1,
      id: normalized.id,
      name: normalized.name,
      directoryPath: root,
      imagePath,
      imageName: normalized.image,
      config,
      configBytes,
      imageBytes,
      previewDataUrl: `data:${mime};base64,${imageBytes.toString("base64")}`,
    };
  }

  async applyTheme(options: {
    theme: DreamSkinThemePackage;
    restartExisting: boolean;
  }): Promise<void> {
    this.assertSupportedPlatform();
    const activeDirectory = path.join(
      this.options.stateRoot,
      this.platform === "win32" ? "active-theme" : "theme",
    );
    await replaceDirectoryAtomically(activeDirectory, options.theme);
    const command = this.startCommand(options.restartExisting);
    await this.execute(command.executable, command.args, 90_000);
  }

  async restoreTheme(): Promise<void> {
    this.assertSupportedPlatform();
    const command = this.restoreCommand();
    await this.execute(command.executable, command.args, 60_000);
  }

  private assertSupportedPlatform(): void {
    if (this.platform !== "darwin" && this.platform !== "win32") {
      throw new Error("Codex Dream Skin only supports macOS and Windows");
    }
  }

  private startCommand(restartExisting: boolean): {
    executable: string;
    args: string[];
  } {
    if (this.platform === "darwin") {
      const script = this.requireRuntimeFile(
        "macos",
        "scripts",
        "start-dream-skin-macos.sh",
      );
      return {
        executable: "/bin/bash",
        args: restartExisting ? [script, "--restart-existing"] : [script],
      };
    }
    const script = this.requireRuntimeFile(
      "windows",
      "scripts",
      "start-dream-skin.ps1",
    );
    return {
      executable: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        ...(restartExisting ? ["-RestartExisting"] : []),
      ],
    };
  }

  private restoreCommand(): { executable: string; args: string[] } {
    if (this.platform === "darwin") {
      return {
        executable: "/bin/bash",
        args: [
          this.requireRuntimeFile(
            "macos",
            "scripts",
            "restore-dream-skin-macos.sh",
          ),
          "--restart-codex",
        ],
      };
    }
    return {
      executable: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        this.requireRuntimeFile("windows", "scripts", "restore-dream-skin.ps1"),
        "-ForceRestart",
      ],
    };
  }

  private requireRuntimeFile(...segments: string[]): string {
    const filename = path.join(this.options.runtimeRoot, ...segments);
    if (
      !path
        .resolve(filename)
        .startsWith(`${path.resolve(this.options.runtimeRoot)}${path.sep}`)
    ) {
      throw new Error("Dream Skin runtime path escaped its resource root");
    }
    return filename;
  }

  private async execute(
    executable: string,
    args: string[],
    timeoutMs: number,
  ): Promise<void> {
    try {
      await this.runCommand(executable, args, {
        timeoutMs,
        env: {
          ...process.env,
          PROMPTHUB_DREAM_SKIN_STATE_ROOT: this.options.stateRoot,
        },
      });
    } catch (error) {
      const failure = error as Error & { stderr?: string; stdout?: string };
      const detail = (failure.stderr || failure.stdout || failure.message)
        .trim()
        .slice(0, 4_000);
      throw new Error(`Codex Dream Skin runtime failed: ${detail}`);
    }
  }
}
