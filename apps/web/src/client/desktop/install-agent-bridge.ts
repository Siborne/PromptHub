import type {
  AgentInventoryResponse,
  AgentProviderProfileExport,
  AgentProviderProfilePublic,
  AgentServiceDomain,
  AgentServiceManifestEntry,
  AgentServiceResult,
  AgentSessionDetail,
  AgentSessionIndexPublicState,
  AgentSessionListResult,
  CreateAgentProviderProfileRequest,
  SkillLocalFileEntry,
  SkillLocalFileTreeEntry,
  UpdateAgentProviderProfileRequest,
} from "@prompthub/shared/types";

interface AgentBridgeHttp {
  get<T>(path: string): Promise<T>;
  body<T>(
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body?: unknown,
  ): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

const providerPlatformIds = new Map<string, string>();

function segment(value: string): string {
  return encodeURIComponent(value);
}

function rememberProviderProfile(
  profile: AgentProviderProfilePublic,
): AgentProviderProfilePublic {
  providerPlatformIds.set(profile.id, profile.platformId);
  return profile;
}

function requireProviderPlatform(profileId: string): string {
  const platformId = providerPlatformIds.get(profileId);
  if (!platformId) throw new Error("Provider profile platform is unavailable");
  return platformId;
}

function providerPath(platformId: string, suffix = ""): string {
  return `/api/agents/${segment(platformId)}/provider-profiles${suffix}`;
}

function createConfigBridge(http: AgentBridgeHttp) {
  return {
    listConfigFiles: (agentId: string) =>
      http.get<SkillLocalFileTreeEntry[]>(
        `/api/agents/${segment(agentId)}/config-files`,
      ),
    readConfigFile: (agentId: string, relativePath: string) =>
      http.body<SkillLocalFileEntry | null>(
        `/api/agents/${segment(agentId)}/config-files/read`,
        "POST",
        { relativePath },
      ),
    writeConfigFile: (
      agentId: string,
      relativePath: string,
      content: string,
      expectedRevision?: string,
    ) =>
      http.body<SkillLocalFileEntry>(
        `/api/agents/${segment(agentId)}/config-files`,
        "PUT",
        { relativePath, content, expectedRevision },
      ),
  };
}

function createProviderCollectionBridge(http: AgentBridgeHttp) {
  return {
    listProviderProfiles: (options?: { platformId?: string }) => {
      const platformId = options?.platformId;
      if (!platformId) {
        return Promise.reject(new Error("Provider platformId is required"));
      }
      return http
        .get<AgentProviderProfilePublic[]>(providerPath(platformId))
        .then((profiles) => profiles.map(rememberProviderProfile));
    },
    createProviderProfile: (request: CreateAgentProviderProfileRequest) =>
      http
        .body<AgentProviderProfilePublic>(
          providerPath(request.profile.platformId),
          "POST",
          request,
        )
        .then(rememberProviderProfile),
  };
}

function createProviderMutationBridge(http: AgentBridgeHttp) {
  return {
    updateProviderProfile: (request: UpdateAgentProviderProfileRequest) => {
      const platformId = requireProviderPlatform(request.id);
      return http
        .body<AgentProviderProfilePublic>(
          providerPath(platformId, `/${segment(request.id)}`),
          "PUT",
          request,
        )
        .then(rememberProviderProfile);
    },
    archiveProviderProfile: (id: string, expectedUpdatedAt: number) => {
      const platformId = requireProviderPlatform(id);
      return http
        .body<AgentProviderProfilePublic>(
          providerPath(platformId, `/${segment(id)}/archive`),
          "POST",
          { expectedUpdatedAt },
        )
        .then(rememberProviderProfile);
    },
    duplicateProviderProfile: (id: string, name: string) => {
      const platformId = requireProviderPlatform(id);
      return http
        .body<AgentProviderProfilePublic>(
          providerPath(platformId, `/${segment(id)}/duplicate`),
          "POST",
          { name },
        )
        .then(rememberProviderProfile);
    },
  };
}

function createProviderReadDeleteBridge(http: AgentBridgeHttp) {
  return {
    exportProviderProfile: (id: string) => {
      const platformId = requireProviderPlatform(id);
      return http.get<AgentProviderProfileExport>(
        providerPath(platformId, `/${segment(id)}/export`),
      );
    },
    deleteProviderProfile: (id: string) => {
      const platformId = requireProviderPlatform(id);
      return http
        .delete<boolean>(providerPath(platformId, `/${segment(id)}`))
        .then(() => providerPlatformIds.delete(id));
    },
  };
}

function createSessionBridge(http: AgentBridgeHttp) {
  return {
    listSessions: (
      agentId: string,
      limit = 50,
      offset = 0,
      search?: string,
    ) => {
      const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (search) query.set("search", search);
      return http.get<AgentSessionListResult>(
        `/api/agents/${segment(agentId)}/sessions?${query.toString()}`,
      );
    },
    readSession: (agentId: string, sessionId: string) =>
      http.get<AgentSessionDetail>(
        `/api/agents/${segment(agentId)}/sessions/${segment(sessionId)}`,
      ),
    getSessionIndexState: (agentId: string) =>
      http.get<AgentSessionIndexPublicState>(
        `/api/agents/${segment(agentId)}/sessions/state`,
      ),
    onSessionIndexProgress: () => () => {},
  };
}

function createServiceBridge(http: AgentBridgeHttp) {
  return {
    getServiceManifest: (agentId: string) =>
      http.get<AgentServiceManifestEntry[]>(
        `/api/agents/${segment(agentId)}/services`,
      ),
    getService: (agentId: string, domain: AgentServiceDomain) =>
      http.get<AgentServiceResult>(
        `/api/agents/${segment(agentId)}/services/${segment(domain)}`,
      ),
  };
}

/** Browser implementation of the Agent preload surface backed by Web routes. */
export function createWebAgentBridge(http: AgentBridgeHttp) {
  return {
    listManaged: () => http.get<AgentInventoryResponse>("/api/agents"),
    ...createConfigBridge(http),
    ...createProviderCollectionBridge(http),
    ...createProviderMutationBridge(http),
    ...createProviderReadDeleteBridge(http),
    ...createSessionBridge(http),
    ...createServiceBridge(http),
  };
}
