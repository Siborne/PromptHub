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
const MAX_AGENT_DEVICE_BYTES = 8 * 1024 * 1024;

export interface CanonicalAgentDeviceSettings {
  builtinAgentOverrides: Record<string, BuiltinAgentOverrideConfig>;
  customAgents: CustomAgentConfig[];
  disabledPlatformIds: string[];
  agentIdentityPreferences: AgentIdentityPreferences;
}

function configPath(): string {
  return path.join(getConfigDir(), "devices", "agents.json");
}

export function resolveCanonicalAgentDeviceId(): string {
  return `device-${getRuntimeStorageContext().rootIdentity.slice(0, 32)}`;
}

function readStoredDocument(filePath: string): AgentDeviceConfigDocument {
  const stats = fs.lstatSync(filePath);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size > MAX_AGENT_DEVICE_BYTES
  ) {
    throw new Error("Canonical Agent device configuration is invalid");
  }
  const content = fs.readFileSync(filePath, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new Error("Canonical Agent device configuration is invalid", {
      cause: error,
    });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Canonical Agent device configuration is invalid");
  }
  const deviceId = (value as Record<string, unknown>).deviceId;
  if (typeof deviceId !== "string") {
    throw new Error("Canonical Agent device configuration is invalid");
  }
  return parseAgentDeviceConfigDocument(content, {
    expectedDeviceId: deviceId,
  });
}

export function readCanonicalAgentDeviceConfig(): AgentDeviceConfigDocument | null {
  recoverCanonicalEntryPublication(getUserDataPath(), OPERATION_KEY);
  const filePath = configPath();
  if (!fs.existsSync(filePath)) return null;
  const document = readStoredDocument(filePath);
  if (document.deviceId === resolveCanonicalAgentDeviceId()) {
    return document;
  }
  return publishCanonicalAgentDeviceConfig({
    builtinAgentOverrides: document.builtinAgentOverrides,
    customAgents: document.customAgents,
    disabledPlatformIds: document.disabledPlatformIds,
    agentIdentityPreferences: document.agentIdentityPreferences,
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
