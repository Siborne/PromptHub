const PRIMARY_SETTINGS_KEY = "prompthub-settings";
const LEGACY_SETTINGS_KEY = "settings-storage";

export interface AIConfigSnapshot {
  aiProviders?: any[];
  aiModels?: any[];
  scenarioModelDefaults?: Record<string, string>;
  modelRouteDefaults?: Record<string, string>;
  aiProvider?: string;
  aiApiProtocol?: string;
  aiApiKey?: string;
  aiApiUrl?: string;
  aiModel?: string;
}

export interface SettingsStateSnapshot {
  state?: any;
  settingsUpdatedAt?: string;
}

export const SENSITIVE_SETTINGS_FIELDS = [
  "webdavUsername",
  "webdavPassword",
  "webdavEncryptionPassword",
  "selfHostedSyncUsername",
  "selfHostedSyncPassword",
  "s3AccessKeyId",
  "s3SecretAccessKey",
  "s3EncryptionPassword",
  "aiApiKey",
  "aiProviders",
  "aiModels",
  "githubToken",
  "networkProxy",
] as const;

function readStoredSettings():
  | {
      key: string;
      data: { state?: any; version?: number };
    }
  | undefined {
  try {
    const primary = localStorage.getItem(PRIMARY_SETTINGS_KEY);
    const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
    const raw = primary || legacy;
    if (!raw) return undefined;

    return {
      key: primary ? PRIMARY_SETTINGS_KEY : LEGACY_SETTINGS_KEY,
      data: JSON.parse(raw),
    };
  } catch (error) {
    console.warn("Failed to read stored settings:", error);
    return undefined;
  }
}

function buildAiConfigSnapshot(
  state: any,
  options?: { includeRootApiKey?: boolean },
): AIConfigSnapshot | undefined {
  try {
    const filteredProviders = (state.aiProviders || []).map((provider: any) => {
      const { apiKey, ...rest } = provider || {};
      return rest;
    });
    const filteredModels = (state.aiModels || []).map((model: any) => {
      const { apiKey, ...rest } = model || {};
      return rest;
    });

    return {
      aiProviders: filteredProviders,
      aiModels: filteredModels,
      scenarioModelDefaults: state.scenarioModelDefaults || {},
      modelRouteDefaults: state.modelRouteDefaults || {},
      aiProvider: state.aiProvider,
      aiApiProtocol: state.aiApiProtocol,
      ...(options?.includeRootApiKey ? { aiApiKey: state.aiApiKey } : {}),
      aiApiUrl: state.aiApiUrl,
      aiModel: state.aiModel,
    };
  } catch (error) {
    console.warn("Failed to build AI config snapshot:", error);
    return undefined;
  }
}

export function getAiConfigSnapshot(options?: {
  includeRootApiKey?: boolean;
}): AIConfigSnapshot | undefined {
  const stored = readStoredSettings();
  const state = stored?.data?.state;
  return state ? buildAiConfigSnapshot(state, options) : undefined;
}

export async function getCanonicalAiConfigSnapshot(options?: {
  includeRootApiKey?: boolean;
}): Promise<AIConfigSnapshot | undefined> {
  const canonicalApi = window.api?.settings?.rendererPersistence;
  if (!canonicalApi) return getAiConfigSnapshot(options);
  const state = await canonicalApi.get();
  return buildAiConfigSnapshot(state?.settings, options);
}

export function getSettingsStateSnapshot(options?: {
  excludeFields?: readonly string[];
  updatedAt?: string;
}): SettingsStateSnapshot | undefined {
  const stored = readStoredSettings();
  const state = stored?.data?.state;
  if (!state) return undefined;

  try {
    const filteredState = { ...state };
    for (const field of options?.excludeFields || []) {
      delete filteredState[field];
    }

    return {
      state: filteredState,
      settingsUpdatedAt: options?.updatedAt ?? state.settingsUpdatedAt,
    };
  } catch (error) {
    console.warn("Failed to build settings snapshot:", error);
    return undefined;
  }
}

export async function getCanonicalSettingsStateSnapshot(options?: {
  excludeFields?: readonly string[];
  updatedAt?: string;
}): Promise<SettingsStateSnapshot | undefined> {
  const canonicalApi = window.api?.settings?.rendererPersistence;
  if (!canonicalApi) return getSettingsStateSnapshot(options);
  const canonical = await canonicalApi.get();
  if (!canonical?.settings) return undefined;
  const filteredState = { ...canonical.settings };
  for (const field of options?.excludeFields || []) delete filteredState[field];
  return {
    state: filteredState,
    settingsUpdatedAt:
      options?.updatedAt ?? canonical.settings.settingsUpdatedAt,
  };
}

function mergeCanonicalAIEntries(
  current: unknown,
  incoming: any[] | undefined,
): any[] | undefined {
  if (!incoming) return undefined;
  const currentById = new Map(
    (Array.isArray(current) ? current : []).flatMap((entry: any) =>
      typeof entry?.id === "string" ? [[entry.id, entry] as const] : [],
    ),
  );
  return incoming.map((entry: any) => {
    const { apiKey: _apiKey, ...safeEntry } = entry || {};
    const local = currentById.get(safeEntry.id);
    return typeof local?.apiKey === "string" && local.apiKey
      ? { ...safeEntry, apiKey: local.apiKey }
      : safeEntry;
  });
}

export async function restoreAiConfigSnapshot(
  aiConfig: AIConfigSnapshot | undefined,
): Promise<void> {
  if (!aiConfig) return;

  const canonicalApi = window.api?.settings?.rendererPersistence;
  if (canonicalApi) {
    const current = await canonicalApi.get();
    const currentSettings = current?.settings ?? {};
    const aiProviders = mergeCanonicalAIEntries(
      currentSettings.aiProviders,
      aiConfig.aiProviders,
    );
    const aiModels = mergeCanonicalAIEntries(
      currentSettings.aiModels,
      aiConfig.aiModels,
    );
    await canonicalApi.replaceSettings({
      ...currentSettings,
      ...(aiProviders ? { aiProviders } : {}),
      ...(aiModels ? { aiModels } : {}),
      ...(aiConfig.scenarioModelDefaults
        ? { scenarioModelDefaults: aiConfig.scenarioModelDefaults }
        : {}),
      ...(aiConfig.modelRouteDefaults
        ? { modelRouteDefaults: aiConfig.modelRouteDefaults }
        : {}),
      ...(aiConfig.aiProvider ? { aiProvider: aiConfig.aiProvider } : {}),
      ...(aiConfig.aiApiProtocol
        ? { aiApiProtocol: aiConfig.aiApiProtocol }
        : {}),
      ...(aiConfig.aiApiKey ? { aiApiKey: aiConfig.aiApiKey } : {}),
      ...(aiConfig.aiApiUrl ? { aiApiUrl: aiConfig.aiApiUrl } : {}),
      ...(aiConfig.aiModel ? { aiModel: aiConfig.aiModel } : {}),
    });
    return;
  }

  try {
    const stored = readStoredSettings();
    const targetKey = stored?.key || PRIMARY_SETTINGS_KEY;
    const data = stored?.data || { state: {} };
    if (!data.state) data.state = {};

    if (aiConfig.aiProviders) {
      data.state.aiProviders = aiConfig.aiProviders.map((provider: any) => {
        const { apiKey: _apiKey, ...safeProvider } = provider || {};
        return safeProvider;
      });
    }
    if (aiConfig.aiModels) {
      data.state.aiModels = aiConfig.aiModels.map((model: any) => {
        const { apiKey: _apiKey, ...safeModel } = model || {};
        return safeModel;
      });
    }
    if (aiConfig.scenarioModelDefaults) {
      data.state.scenarioModelDefaults = aiConfig.scenarioModelDefaults;
    }
    if (aiConfig.modelRouteDefaults) {
      data.state.modelRouteDefaults = aiConfig.modelRouteDefaults;
    }
    if (aiConfig.aiProvider) data.state.aiProvider = aiConfig.aiProvider;
    if (aiConfig.aiApiProtocol)
      data.state.aiApiProtocol = aiConfig.aiApiProtocol;
    if (aiConfig.aiApiUrl) data.state.aiApiUrl = aiConfig.aiApiUrl;
    if (aiConfig.aiModel) data.state.aiModel = aiConfig.aiModel;

    localStorage.setItem(targetKey, JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to restore AI config snapshot:", error);
  }
}

export async function restoreSettingsStateSnapshot(
  snapshot: SettingsStateSnapshot | undefined,
  options?: { preserveLocalFields?: readonly string[] },
): Promise<void> {
  if (!snapshot?.state) return;

  const canonicalApi = window.api?.settings?.rendererPersistence;
  if (canonicalApi) {
    const current = await canonicalApi.get();
    const nextState = { ...snapshot.state };
    for (const field of options?.preserveLocalFields || []) {
      if (current?.settings?.[field] !== undefined) {
        nextState[field] = current.settings[field];
      }
    }
    await canonicalApi.replaceSettings(nextState);
    return;
  }

  try {
    const stored = readStoredSettings();
    const targetKey = stored?.key || PRIMARY_SETTINGS_KEY;
    const currentState = stored?.data?.state || {};
    const nextState = { ...snapshot.state };

    for (const field of options?.preserveLocalFields || []) {
      if (currentState[field] !== undefined) {
        nextState[field] = currentState[field];
      }
    }

    localStorage.setItem(
      targetKey,
      JSON.stringify({
        ...(stored?.data || {}),
        state: nextState,
      }),
    );
  } catch (error) {
    console.warn("Failed to restore settings state snapshot:", error);
  }
}
