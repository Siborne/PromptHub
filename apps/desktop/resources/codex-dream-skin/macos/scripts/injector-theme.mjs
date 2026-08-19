import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readImageMetadata } from "./image-metadata.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const root = path.resolve(here, "..");
export const SKIN_VERSION = "1.2.0";
const MAX_ART_BYTES = 16 * 1024 * 1024;
let staticPayloadAssets = null;

function assertContainedPath(rootPath, candidatePath, label) {
  const relative = path.relative(rootPath, candidatePath);
  if (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  )
    return;
  throw new Error(`${label} must stay inside its theme directory`);
}

async function loadTheme(themeDir) {
  const requestedRoot = themeDir ?? path.join(root, "assets");
  const configPath = path.join(requestedRoot, "theme.json");
  let assetsRoot;
  let canonicalConfigPath;
  try {
    [assetsRoot, canonicalConfigPath] = await Promise.all([
      fs.realpath(requestedRoot),
      fs.realpath(configPath),
    ]);
  } catch (error) {
    if (themeDir && error.code === "ENOENT") {
      throw new Error(
        `Explicit theme directory is missing theme.json: ${configPath}`,
      );
    }
    throw error;
  }
  assertContainedPath(assetsRoot, canonicalConfigPath, "Theme config");
  let config;
  try {
    config = await fs.readFile(canonicalConfigPath, "utf8");
  } catch (error) {
    if (themeDir && error.code === "ENOENT") {
      throw new Error(
        `Explicit theme directory is missing theme.json: ${configPath}`,
      );
    }
    throw error;
  }
  const raw = JSON.parse(config);
  if (raw.schemaVersion !== 1 || typeof raw.image !== "string" || !raw.image) {
    throw new Error(`${configPath} has an unsupported schema or image field`);
  }
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(raw.image)) {
    throw new Error(`${configPath} has an invalid image field`);
  }
  if (path.basename(raw.image) !== raw.image)
    throw new Error("Theme image must stay inside its theme directory");
  const text = (value, fallback, max, name) => {
    if (value === undefined) return fallback;
    if (
      typeof value !== "string" ||
      /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)
    ) {
      throw new Error(`${configPath} has an invalid ${name} field`);
    }
    return value.trim()
      ? Array.from(value.trim()).slice(0, max).join("")
      : fallback;
  };
  const color = (value, fallback) => {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim();
    return /^#[0-9a-f]{6}$/i.test(normalized) ||
      /^rgba?\([0-9., %]+\)$/i.test(normalized)
      ? normalized
      : fallback;
  };
  const choice = (value, name, choices) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !choices.includes(value)) {
      throw new Error(`${configPath} has an invalid ${name} field`);
    }
    return value;
  };
  const unit = (value, name) => {
    if (value === undefined) return undefined;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(`${configPath} has an invalid ${name} field`);
    }
    return value;
  };
  const rawColors =
    raw.colors && typeof raw.colors === "object" && !Array.isArray(raw.colors)
      ? raw.colors
      : null;
  const colorKeys = [
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
  ];
  const appearance = choice(raw.appearance, "appearance", [
    "auto",
    "light",
    "dark",
  ]);
  if (
    raw.art !== undefined &&
    (!raw.art || typeof raw.art !== "object" || Array.isArray(raw.art))
  ) {
    throw new Error(`${configPath} has an invalid art field`);
  }
  const rawArt = raw.art || {};
  const art = {
    focusX: unit(rawArt.focusX, "art.focusX"),
    focusY: unit(rawArt.focusY, "art.focusY"),
    safeArea: choice(rawArt.safeArea, "art.safeArea", [
      "auto",
      "left",
      "right",
      "center",
      "none",
    ]),
    taskMode: choice(rawArt.taskMode, "art.taskMode", [
      "auto",
      "ambient",
      "banner",
      "off",
    ]),
  };
  const theme = {
    schemaVersion: 1,
    id: text(raw.id, "custom", 80, "id"),
    name: text(raw.name, "ChatGPT Dream Skin", 80, "name"),
    brandSubtitle: text(
      raw.brandSubtitle,
      "CODEX DREAM SKIN",
      80,
      "brandSubtitle",
    ),
    tagline: text(raw.tagline, "Make something wonderful.", 160, "tagline"),
    projectPrefix: text(raw.projectPrefix, "选择项目 · ", 80, "projectPrefix"),
    projectLabel: text(raw.projectLabel, "◉  选择项目", 80, "projectLabel"),
    statusText: text(raw.statusText, "DREAM SKIN ONLINE", 80, "statusText"),
    quote: text(raw.quote, "MAKE SOMETHING WONDERFUL", 80, "quote"),
    image: raw.image,
    colorMode: rawColors ? "explicit" : "auto",
    explicitColorKeys: rawColors
      ? colorKeys.filter((key) => Object.hasOwn(rawColors, key))
      : [],
    colors: {
      background: color(rawColors?.background, "#071116"),
      panel: color(rawColors?.panel, "#0b1a20"),
      panelAlt: color(rawColors?.panelAlt, "#10272c"),
      accent: color(rawColors?.accent, "#7cff46"),
      accentAlt: color(rawColors?.accentAlt, "#b8ff3d"),
      secondary: color(rawColors?.secondary, "#36d7e8"),
      highlight: color(rawColors?.highlight, "#642a8c"),
      text: color(rawColors?.text, "#e9fff1"),
      muted: color(rawColors?.muted, "#9ebdb3"),
      line: color(rawColors?.line, "rgba(124, 255, 70, .28)"),
    },
  };
  if (appearance !== undefined) theme.appearance = appearance;
  if (Object.values(art).some((value) => value !== undefined)) {
    theme.art = Object.fromEntries(
      Object.entries(art).filter(([, value]) => value !== undefined),
    );
  }
  const requestedImagePath = path.join(assetsRoot, theme.image);
  let imagePath;
  try {
    imagePath = await fs.realpath(requestedImagePath);
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error(`Theme image is missing: ${requestedImagePath}`);
    throw error;
  }
  assertContainedPath(assetsRoot, imagePath, "Theme image");
  const imageStat = await fs.stat(imagePath);
  const extension = path.extname(theme.image).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    throw new Error(
      `Unsupported theme image format: ${extension || "missing"}`,
    );
  }
  let imageHandle;
  try {
    imageHandle = await fs.open(
      imagePath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
  } catch (error) {
    if (error.code === "ELOOP")
      throw new Error("Theme image changed into a symbolic link while loading");
    throw error;
  }
  try {
    const openedStat = await imageHandle.stat();
    if (
      !imageStat.isFile() ||
      !openedStat.isFile() ||
      imageStat.dev !== openedStat.dev ||
      imageStat.ino !== openedStat.ino ||
      openedStat.size < 1 ||
      openedStat.size > MAX_ART_BYTES
    ) {
      throw new Error(
        `Theme image must be a stable non-empty file no larger than ${MAX_ART_BYTES} bytes`,
      );
    }
    const art = await imageHandle.readFile();
    if (art.length < 1 || art.length > MAX_ART_BYTES) {
      throw new Error(
        `Theme image must be a non-empty file no larger than ${MAX_ART_BYTES} bytes`,
      );
    }
    return { art, assetsRoot, extension, imagePath, theme };
  } finally {
    await imageHandle.close();
  }
}

async function loadStaticPayloadAssets() {
  const cacheHit = Boolean(staticPayloadAssets);
  if (!staticPayloadAssets) {
    staticPayloadAssets = Promise.all([
      fs.readFile(path.join(root, "assets", "dream-skin.css"), "utf8"),
      fs.readFile(path.join(root, "assets", "renderer-inject.js"), "utf8"),
    ]).catch((error) => {
      staticPayloadAssets = null;
      throw error;
    });
  }
  const [css, template] = await staticPayloadAssets;
  return { css, template, cacheHit };
}

export function invalidateStaticPayloadAssets() {
  staticPayloadAssets = null;
}

export async function loadPayload(themeDir) {
  const startedAt = performance.now();
  const [staticAssets, loaded] = await Promise.all([
    loadStaticPayloadAssets(),
    loadTheme(themeDir),
  ]);
  const { css, template } = staticAssets;
  const { art, extension, theme } = loaded;
  const styleRevision = createHash("sha256")
    .update(css)
    .digest("hex")
    .slice(0, 20);
  const artMetadata = readImageMetadata(art, extension);
  if (!artMetadata) {
    throw new Error(
      "Theme image metadata is invalid or exceeds the 16384px / 50MP safety limit",
    );
  }
  const artKey = createHash("sha256").update(art).digest("hex").slice(0, 20);
  theme.artMetadata = artMetadata;
  theme.artKey = artKey;
  const mime =
    extension === ".jpg" || extension === ".jpeg"
      ? "image/jpeg"
      : extension === ".webp"
        ? "image/webp"
        : "image/png";
  const artDataUrl = `data:${mime};base64,${art.toString("base64")}`;
  const revision = createHash("sha256")
    .update(SKIN_VERSION)
    .update(css)
    .update(template)
    .update(JSON.stringify(theme))
    .digest("hex")
    .slice(0, 20);
  const payload = template
    .replace("__DREAM_SKIN_CSS_JSON__", JSON.stringify(css))
    .replace("__DREAM_SKIN_ART_JSON__", JSON.stringify(artDataUrl))
    .replace("__DREAM_SKIN_THEME_JSON__", JSON.stringify(theme))
    .replace("__DREAM_SKIN_VERSION_JSON__", JSON.stringify(SKIN_VERSION))
    .replace(
      "__DREAM_SKIN_STYLE_REVISION_JSON__",
      JSON.stringify(styleRevision),
    )
    .replace("__DREAM_SKIN_PAYLOAD_REVISION_JSON__", JSON.stringify(revision));
  return {
    imageBytes: art.length,
    payload,
    revision,
    theme,
    timings: {
      buildMs: Number((performance.now() - startedAt).toFixed(3)),
      staticCacheHit: staticAssets.cacheHit,
    },
  };
}
