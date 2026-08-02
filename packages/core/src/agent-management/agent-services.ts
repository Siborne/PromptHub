import type {
  AgentInventoryItem,
  AgentServiceDomain,
  AgentServiceItem,
  AgentServiceManifestEntry,
  AgentServiceResult,
} from "@prompthub/shared/types";
import { AGENT_SERVICE_DOMAINS } from "@prompthub/shared/types";

const MAX_SERVICE_ITEMS = 200;
const PARTIAL_SERVICE_DOMAINS = new Set<AgentServiceDomain>([
  "provider",
  "appearance",
  "configFiles",
  "sessions",
  "usage",
]);

export interface AgentServiceActor {
  userId: string;
  role: "admin" | "user";
}

interface NamedRecord {
  id: string;
  name: string;
  description?: string | null;
}

interface McpRecord {
  id: string;
  displayName?: string;
  name?: string;
}

interface ProviderRecord {
  id: string;
  name: string;
  providerKind: string;
}

interface AgentAssetsRecord {
  mcpLibrary?: { servers?: McpRecord[] };
  pluginLibrary?: { plugins?: McpRecord[] };
}

export interface AgentServicesDependencies {
  listSkills(actor: AgentServiceActor): NamedRecord[];
  listRules(userId: string): NamedRecord[];
  readAgentAssets(userId: string): AgentAssetsRecord;
  listProviderProfiles(platformId: string): ProviderRecord[];
  inspectConfigFiles(agent: AgentInventoryItem): Promise<AgentServiceItem[]>;
  listAppearance(agent: AgentInventoryItem): Promise<AgentServiceItem[]>;
  listDefinitions(agent: AgentInventoryItem): Promise<AgentServiceItem[]>;
  listSessions(agent: AgentInventoryItem): AgentServiceItem[];
}

function item(record: NamedRecord, state = "available"): AgentServiceItem {
  return {
    id: record.id,
    label: record.name,
    ...(record.description ? { description: record.description } : {}),
    state,
  };
}

function boundedResult(
  agentId: string,
  domain: AgentServiceDomain,
  items: AgentServiceItem[],
  actions: AgentServiceResult["actions"],
  status: AgentServiceResult["status"] = "available",
  reason?: string,
): AgentServiceResult {
  return {
    agentId,
    domain,
    status,
    items: items.slice(0, MAX_SERVICE_ITEMS),
    total: items.length,
    truncated: items.length > MAX_SERVICE_ITEMS,
    actions,
    ...(reason ? { reason } : {}),
  };
}

function pendingResult(
  agentId: string,
  domain: AgentServiceDomain,
): AgentServiceResult {
  return boundedResult(
    agentId,
    domain,
    [],
    { inspect: "unavailable" },
    "partial",
    "self-hosted-adapter-pending",
  );
}

function isDomainApplicable(
  agent: AgentInventoryItem,
  domain: AgentServiceDomain,
): boolean {
  return domain !== "definitions" || agent.id === "qwen";
}

export class AgentServicesService {
  constructor(private readonly dependencies: AgentServicesDependencies) {}

  async getManifest(
    _actor: AgentServiceActor,
    agent: AgentInventoryItem,
  ): Promise<AgentServiceManifestEntry[]> {
    return AGENT_SERVICE_DOMAINS.filter((domain) =>
      isDomainApplicable(agent, domain),
    ).map((domain) => ({
      domain,
      serviceAvailable: true,
      status: PARTIAL_SERVICE_DOMAINS.has(domain) ? "partial" : "available",
    }));
  }

  async get(
    actor: AgentServiceActor,
    agent: AgentInventoryItem,
    domain: AgentServiceDomain,
  ): Promise<AgentServiceResult> {
    if (!isDomainApplicable(agent, domain))
      return pendingResult(agent.id, domain);
    if (domain === "skills") return this.skills(actor, agent.id);
    if (domain === "mcp") return this.mcp(actor.userId, agent.id);
    if (domain === "plugins") return this.plugins(actor.userId, agent.id);
    if (domain === "rules") return this.rules(actor.userId, agent.id);
    if (domain === "definitions") return this.definitions(actor, agent);
    if (domain === "provider") return this.providers(agent.id);
    if (domain === "appearance") return this.appearance(actor, agent);
    if (domain === "configFiles") return this.configFiles(actor, agent);
    if (domain === "sessions") return this.sessions(agent);
    if (domain === "maintenance") return this.maintenance(agent);
    return pendingResult(agent.id, domain);
  }

  private skills(
    actor: AgentServiceActor,
    agentId: string,
  ): AgentServiceResult {
    const items = this.dependencies
      .listSkills(actor)
      .map((entry) => item(entry));
    return boundedResult(agentId, "skills", items, {
      browse: "available",
      install: "unavailable",
    });
  }

  private mcp(userId: string, agentId: string): AgentServiceResult {
    const servers =
      this.dependencies.readAgentAssets(userId).mcpLibrary?.servers ?? [];
    const items = servers.map((server) =>
      item({
        id: server.id,
        name: server.displayName || server.name || server.id,
      }),
    );
    return boundedResult(agentId, "mcp", items, {
      browse: "available",
      distribute: "unavailable",
    });
  }

  private plugins(userId: string, agentId: string): AgentServiceResult {
    const plugins =
      this.dependencies.readAgentAssets(userId).pluginLibrary?.plugins ?? [];
    const items = plugins.map((plugin) =>
      item({
        id: plugin.id,
        name: plugin.displayName || plugin.name || plugin.id,
      }),
    );
    return boundedResult(agentId, "plugins", items, {
      browse: "available",
      distribute: "unavailable",
    });
  }

  private rules(userId: string, agentId: string): AgentServiceResult {
    const items = this.dependencies
      .listRules(userId)
      .map((entry) => item(entry));
    return boundedResult(agentId, "rules", items, {
      browse: "available",
      edit: "available",
      distribute: "unavailable",
    });
  }

  private providers(agentId: string): AgentServiceResult {
    const items = this.dependencies
      .listProviderProfiles(agentId)
      .map((profile) =>
        item({
          id: profile.id,
          name: profile.name,
          description: profile.providerKind,
        }),
      );
    return boundedResult(agentId, "provider", items, {
      browse: "available",
      manage: "available",
      activate: "unavailable",
    });
  }

  private async definitions(
    actor: AgentServiceActor,
    agent: AgentInventoryItem,
  ): Promise<AgentServiceResult> {
    if (actor.role !== "admin") return pendingResult(agent.id, "definitions");
    const items = await this.dependencies.listDefinitions(agent);
    return boundedResult(agent.id, "definitions", items, {
      browse: "available",
      edit: "unavailable",
    });
  }

  private async appearance(
    actor: AgentServiceActor,
    agent: AgentInventoryItem,
  ): Promise<AgentServiceResult> {
    if (actor.role !== "admin") return pendingResult(agent.id, "appearance");
    const items = await this.dependencies.listAppearance(agent);
    return boundedResult(agent.id, "appearance", items, {
      browse: "available",
      apply: "unavailable",
    });
  }

  private async configFiles(
    actor: AgentServiceActor,
    agent: AgentInventoryItem,
  ): Promise<AgentServiceResult> {
    if (actor.role !== "admin") return pendingResult(agent.id, "configFiles");
    const items = await this.dependencies.inspectConfigFiles(agent);
    return boundedResult(agent.id, "configFiles", items, {
      browse: "available",
      edit: "available",
    });
  }

  private sessions(agent: AgentInventoryItem): AgentServiceResult {
    const items = this.dependencies.listSessions(agent);
    return boundedResult(agent.id, "sessions", items, {
      browse: "available",
      resume: "unavailable",
      export: "unavailable",
    });
  }

  private maintenance(agent: AgentInventoryItem): AgentServiceResult {
    return boundedResult(
      agent.id,
      "maintenance",
      [
        {
          id: "root",
          label: "Agent runtime root",
          state: agent.isDetected ? "available" : "missing",
        },
      ],
      {
        inspect: "available",
        launch: "unavailable",
        update: "unavailable",
      },
    );
  }
}
