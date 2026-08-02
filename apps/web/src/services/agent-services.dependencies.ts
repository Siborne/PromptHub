import fs from "node:fs/promises";
import path from "node:path";
import {
  AgentProviderProfileService,
  createAgentSecretStore,
  createAgentUserConfigFileService,
  createEncryptedConfigBackup,
  type AgentUserConfigFileService,
} from "@prompthub/core";
import { AgentProviderProfileDB, AgentSessionIndexDB } from "@prompthub/db";
import type {
  AgentInventoryItem,
  AgentServiceItem,
} from "@prompthub/shared/types";
import { getServerDatabase } from "../database.js";
import { getBackupsDir, getConfigDir, getDataDir } from "../runtime-paths.js";
import { readAgentAssetsSnapshot } from "./agent-assets-sync.js";
import { createAgentConfigEncryption } from "./agent-config-encryption.js";
import { AgentServicesService } from "./agent-services.service.js";
import { WebAgentSessionsService } from "./agent-sessions.service.js";
import { exportRuleBackupRecords } from "./rule.service.js";
import { SkillService } from "./skill.service.js";

const MAX_DIRECTORY_ITEMS = 200;
const MAX_DIRECTORY_VISITS = 1_000;
const MAX_DEFINITION_DEPTH = 8;
const MAX_DEFINITION_VISITS = 1_000;
const FILE_PROBE_CONCURRENCY = 16;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export async function inspectDeclaredConfigFiles(
  agent: AgentInventoryItem,
): Promise<AgentServiceItem[]> {
  const files = agent.paths.configFiles.slice(0, MAX_DIRECTORY_ITEMS);
  const results = new Array<AgentServiceItem>(files.length);
  let nextIndex = 0;
  async function probeNext(): Promise<void> {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const file = files[index];
      const id =
        agent.paths.configFileRelativePaths[index] ?? path.basename(file);
      try {
        const stat = await fs.lstat(file);
        const state =
          stat.isFile() && !stat.isSymbolicLink() ? "available" : "blocked";
        results[index] = { id, label: id, state };
      } catch {
        results[index] = { id, label: id, state: "missing" };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FILE_PROBE_CONCURRENCY, files.length) }, () =>
      probeNext(),
    ),
  );
  return results;
}

export async function listManagedDirectories(
  root: string,
  state: string,
): Promise<AgentServiceItem[]> {
  const directory = await fs.opendir(root).catch(() => null);
  if (!directory) return [];
  const items: AgentServiceItem[] = [];
  let visited = 0;
  for await (const entry of directory) {
    visited += 1;
    if (
      entry.isDirectory() &&
      !entry.isSymbolicLink() &&
      SAFE_ID_PATTERN.test(entry.name)
    ) {
      items.push({ id: entry.name, label: entry.name, state });
    }
    if (
      items.length >= MAX_DIRECTORY_ITEMS ||
      visited >= MAX_DIRECTORY_VISITS
    ) {
      break;
    }
  }
  return items;
}

async function listAppearance(
  agent: AgentInventoryItem,
): Promise<AgentServiceItem[]> {
  const themeRoot = path.join(
    getDataDir(),
    "agent-appearance",
    "themes",
    agent.id,
  );
  const petRoot = path.join(agent.paths.root, "pets");
  const [themes, pets] = await Promise.all([
    listManagedDirectories(themeRoot, "theme"),
    listManagedDirectories(petRoot, "pet"),
  ]);
  return [...themes, ...pets].slice(0, MAX_DIRECTORY_ITEMS);
}

interface DefinitionScanTarget {
  absolutePath: string;
  depth: number;
  kind: "command" | "subagent";
  relativePath: string;
}

function isSafeDefinitionName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("\0")
  );
}

async function scanDefinitionTarget(
  target: DefinitionScanTarget,
  budget: number,
): Promise<{
  directories: DefinitionScanTarget[];
  items: AgentServiceItem[];
  visited: number;
}> {
  const directories: DefinitionScanTarget[] = [];
  const items: AgentServiceItem[] = [];
  let visited = 0;
  const directory = await fs.opendir(target.absolutePath).catch(() => null);
  if (!directory) return { directories, items, visited };
  for await (const entry of directory) {
    if (visited >= budget) break;
    visited += 1;
    if (entry.isSymbolicLink() || !isSafeDefinitionName(entry.name)) continue;
    const relativePath = target.relativePath
      ? `${target.relativePath}/${entry.name}`
      : entry.name;
    if (entry.isDirectory() && target.kind === "command") {
      directories.push({
        ...target,
        absolutePath: path.join(target.absolutePath, entry.name),
        depth: target.depth + 1,
        relativePath,
      });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      items.push({
        id: `${target.kind}:${relativePath}`,
        label: relativePath.replace(/\.md$/iu, ""),
        description: target.kind,
        state: "available",
      });
    }
  }
  return { directories, items, visited };
}

export async function listDefinitions(
  agent: AgentInventoryItem,
): Promise<AgentServiceItem[]> {
  if (agent.id !== "qwen") return [];
  const queue: DefinitionScanTarget[] = [
    {
      absolutePath: path.join(agent.paths.root, "agents"),
      depth: 0,
      kind: "subagent",
      relativePath: "",
    },
    {
      absolutePath: path.join(agent.paths.root, "commands"),
      depth: 0,
      kind: "command",
      relativePath: "",
    },
  ];
  const items: AgentServiceItem[] = [];
  let visited = 0;
  while (queue.length > 0 && items.length < MAX_DIRECTORY_ITEMS) {
    const target = queue.shift()!;
    if (target.depth > MAX_DEFINITION_DEPTH) continue;
    const scanned = await scanDefinitionTarget(
      target,
      MAX_DEFINITION_VISITS - visited,
    );
    visited += scanned.visited;
    items.push(...scanned.items);
    if (visited >= MAX_DEFINITION_VISITS) break;
    queue.push(...scanned.directories);
  }
  return items.slice(0, MAX_DIRECTORY_ITEMS);
}

export function listIndexedSessions(
  sessions: AgentSessionIndexDB,
  agent: AgentInventoryItem,
): AgentServiceItem[] {
  const items: AgentServiceItem[] = [];
  for (const source of sessions.listSources({ platformId: agent.id })) {
    const remaining = MAX_DIRECTORY_ITEMS - items.length;
    if (remaining < 1) break;
    const page = sessions.listSessions({
      sourceId: source.id,
      limit: remaining,
      offset: 0,
      statuses: ["present"],
    });
    items.push(
      ...page.items.map((session) => ({
        id: session.id,
        label: session.title,
        ...(session.redactedPreview
          ? { description: session.redactedPreview }
          : {}),
        state: session.sourceStatus,
      })),
    );
  }
  return items;
}

export function createDefaultAgentServicesService(): AgentServicesService {
  const database = getServerDatabase();
  const skills = new SkillService();
  const providers = new AgentProviderProfileDB(database);
  const sessions = new AgentSessionIndexDB(database);
  return new AgentServicesService({
    listSkills: (actor) => skills.list(actor, "all"),
    listRules: (userId) => exportRuleBackupRecords(userId),
    readAgentAssets: readAgentAssetsSnapshot,
    listProviderProfiles: (platformId) =>
      providers.listProfiles({ platformId }).map((profile) => ({
        id: profile.id,
        name: profile.name,
        providerKind: profile.providerKind,
      })),
    inspectConfigFiles: inspectDeclaredConfigFiles,
    listAppearance,
    listDefinitions,
    listSessions: (agent) => listIndexedSessions(sessions, agent),
  });
}

export function createDefaultAgentConfigFilesService(): AgentUserConfigFileService {
  const encryption = createAgentConfigEncryption(process.env.AGENT_SECRET_KEY);
  const backupRoot = path.join(getBackupsDir(), "agent-config");
  return createAgentUserConfigFileService({
    createBackup: ({ agentId, sourcePath, content }) =>
      createEncryptedConfigBackup({
        agentId,
        backupRoot,
        content,
        encryption,
        sourcePath,
      }),
  });
}

export function createDefaultAgentProviderProfilesService(): AgentProviderProfileService {
  const database = getServerDatabase();
  const encryption = createAgentConfigEncryption(process.env.AGENT_SECRET_KEY);
  return new AgentProviderProfileService(
    new AgentProviderProfileDB(database),
    createAgentSecretStore({
      filePath: path.join(getConfigDir(), "agent-secrets.json"),
      encryption,
    }),
  );
}

export function createDefaultWebAgentSessionsService(): WebAgentSessionsService {
  return new WebAgentSessionsService(
    new AgentSessionIndexDB(getServerDatabase()),
  );
}
