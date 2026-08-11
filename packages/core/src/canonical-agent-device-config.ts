import fs from "node:fs";
import path from "node:path";

import type {
  AgentIdentityPreferences,
  BuiltinAgentOverrideConfig,
  CustomAgentConfig,
} from "@prompthub/shared/types";

import {
  createAgentDeviceConfigDocument,
  parseAgentDeviceConfigDocument,
  type AgentDeviceConfigDocument,
} from "./agent-resource-schema";
import {
  publishCanonicalEntries,
  recoverCanonicalEntryPublication,
} from "./canonical-entry-publication";
import {
  getConfigDir,
  getRuntimeStorageContext,
  getUserDataPath,
} from "./runtime-paths";

const OPERATION_KEY = "agent-device-config";
const MAX_RENDERER_DEVICE_BYTES = 1024 * 1024;

export interface CanonicalAgentDeviceSettings {
  builtinAgentOverrides: Record<string, BuiltinAgentOverrideConfig>;
  customAgents: CustomAgentConfig[];
  disabledPlatformIds: string[];
  agentIdentityPreferences: AgentIdentityPreferences;
}

function configPath(): string {
  return path.join(getConfigDir(), "devices", "agents.json");
}

function rendererDevicePath(): string {
  return path.join(getConfigDir(), "devices", "renderer.json");
}

function readRendererDeviceId(): string | null {
  const filePath = rendererDevicePath();
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.lstatSync(filePath);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size > MAX_RENDERER_DEVICE_BYTES
  ) {
    throw new Error("Renderer device configuration is invalid");
  }
  const value: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Renderer device configuration is invalid");
  }
  const deviceId = Reflect.get(value, "selfHostedDeviceId");
  return typeof deviceId === "string" && deviceId.trim()
    ? deviceId.trim()
    : null;
}

export function resolveCanonicalAgentDeviceId(): string {
  return (
    readRendererDeviceId() ??
    `device-${getRuntimeStorageContext().rootIdentity.slice(0, 32)}`
  );
}

export function readCanonicalAgentDeviceConfig(): AgentDeviceConfigDocument | null {
  recoverCanonicalEntryPublication(getUserDataPath(), OPERATION_KEY);
  const filePath = configPath();
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error("Canonical Agent device configuration is invalid");
  }
  return parseAgentDeviceConfigDocument(fs.readFileSync(filePath, "utf8"), {
    expectedDeviceId: resolveCanonicalAgentDeviceId(),
  });
}

export function publishCanonicalAgentDeviceConfig(
  settings: CanonicalAgentDeviceSettings,
  commit?: () => void,
): AgentDeviceConfigDocument {
  const document = createAgentDeviceConfigDocument({
    deviceId: resolveCanonicalAgentDeviceId(),
    ...settings,
  });
  const targetPath = configPath();
  publishCanonicalEntries({
    rootPath: getUserDataPath(),
    operationKey: OPERATION_KEY,
    entries: [
      {
        targetPath,
        prepare(stagePath) {
          fs.mkdirSync(path.dirname(stagePath), {
            recursive: true,
            mode: 0o700,
          });
          fs.writeFileSync(
            stagePath,
            `${JSON.stringify(document, null, 2)}\n`,
            {
              encoding: "utf8",
              mode: 0o600,
              flag: "wx",
            },
          );
        },
      },
    ],
    verify() {
      parseAgentDeviceConfigDocument(fs.readFileSync(targetPath, "utf8"), {
        expectedDeviceId: document.deviceId,
      });
    },
    commit,
  });
  return document;
}

export function ensureCanonicalAgentDeviceConfig(
  fallback: CanonicalAgentDeviceSettings,
): AgentDeviceConfigDocument {
  return (
    readCanonicalAgentDeviceConfig() ??
    publishCanonicalAgentDeviceConfig(fallback)
  );
}
