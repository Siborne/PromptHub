import fs from "node:fs/promises";
import {
  buildCliManagedAgentInventory,
  normalizeAgentIdentityPreferences,
  type AgentManagementSettings,
} from "@prompthub/core";
import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";
import type {
  AgentCapabilityKey,
  AgentInventoryCapabilities,
  AgentInventoryItem,
  AgentInventoryResponse,
  ManagedAgentCapability,
  Settings,
} from "@prompthub/shared/types";

const PATH_CACHE_TTL_MS = 5_000;
const PATH_CACHE_MAX_ENTRIES = 256;
interface CachedPathState {
  expiresAt: number;
  exists: boolean;
}

type PathProbe = (candidate: string) => Promise<boolean>;

async function probePath(candidate: string): Promise<boolean> {
  return fs
    .access(candidate)
    .then(() => true)
    .catch(() => false);
}

class PathExistenceCache {
  private readonly entries = new Map<string, CachedPathState>();

  constructor(private readonly probe: PathProbe) {}

  async exists(candidate: string): Promise<boolean> {
    const cached = this.entries.get(candidate);
    if (cached && cached.expiresAt > Date.now()) return cached.exists;

    const exists = await this.probe(candidate);
    this.entries.delete(candidate);
    this.entries.set(candidate, {
      exists,
      expiresAt: Date.now() + PATH_CACHE_TTL_MS,
    });
    this.trim();
    return exists;
  }

  private trim(): void {
    while (this.entries.size > PATH_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }
}

function toManagementSettings(settings: Settings): AgentManagementSettings {
  return {
    builtinAgentOverrides: settings.builtinAgentOverrides ?? {},
    customAgents: Array.isArray(settings.customAgents)
      ? settings.customAgents
      : [],
    disabledPlatformIds: Array.isArray(settings.disabledPlatformIds)
      ? settings.disabledPlatformIds
      : [],
    agentIdentityPreferences: normalizeAgentIdentityPreferences(
      settings.agentIdentityPreferences,
    ),
  };
}

function webAgentCapabilities(
  serverHost: boolean,
): Record<AgentCapabilityKey, ManagedAgentCapability> {
  const partial = {
    status: "partial",
    reason: "self-hosted-web-service",
  } as const;
  const supported = {
    status: "supported",
    reason: "self-hosted-web-service",
  } as const;
  const unavailable = {
    status: "unsupported",
    reason: "server-host-access-unavailable",
  } as const;
  return {
    overview: supported,
    assets: supported,
    provider: partial,
    appearance: serverHost ? partial : unavailable,
    configFiles: serverHost ? partial : unavailable,
    sessions: serverHost ? partial : unavailable,
    usage: partial,
    maintenance: supported,
  };
}

function webCapabilities(hostDetection: boolean): AgentInventoryCapabilities {
  return {
    inventory: true,
    settings: true,
    hostDetection,
    filesystemMutation: false,
    configFiles: hostDetection,
    providers: true,
    sessions: hostDetection,
    launch: false,
    maintenance: true,
  };
}

function toWebAgent(
  agent: AgentInventoryItem,
  serverHost: boolean,
): AgentInventoryItem {
  return {
    ...agent,
    launchable: false,
    capabilities: webAgentCapabilities(serverHost),
  };
}

export class AgentInventoryService {
  private readonly pathCache: PathExistenceCache;

  constructor(pathProbe: PathProbe = probePath) {
    this.pathCache = new PathExistenceCache(pathProbe);
  }

  async list(
    settings: Settings,
    inspectServerHost: boolean,
  ): Promise<AgentInventoryResponse> {
    const agents = await buildCliManagedAgentInventory(
      SKILL_PLATFORMS,
      toManagementSettings(settings),
      {
        includeDisabled: true,
        pathExists: inspectServerHost
          ? (candidate) => this.pathCache.exists(candidate)
          : async () => false,
      },
    );

    return {
      target: inspectServerHost ? "server-host" : "logical-only",
      agents: agents.map((agent) => toWebAgent(agent, inspectServerHost)),
      capabilities: webCapabilities(inspectServerHost),
    };
  }
}
