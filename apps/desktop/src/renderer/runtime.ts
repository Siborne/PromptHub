export interface PromptHubRuntimeCapabilities {
  appUpdate: boolean;
  dataRecovery: boolean;
  desktopWindowControls: boolean;
  skillDistribution: boolean;
  skillFileEditing: boolean;
  skillLocalScan: boolean;
  skillPlatformIntegration: boolean;
  skillStore: boolean;
}

export interface PromptHubWebContext {
  mode: "self-hosted";
  origin: string;
  username?: string;
  registrationAllowed?: boolean;
  initialized?: boolean;
}

type WebRuntimeWindow = Window &
  typeof globalThis & {
    __PROMPTHUB_WEB__?: boolean;
    __PROMPTHUB_WEB_CONTEXT__?: PromptHubWebContext;
    __PROMPTHUB_WEB_LOGOUT__?: (() => Promise<void>) | (() => void);
  };

function getRuntimeWindow(): WebRuntimeWindow | undefined {
  return typeof window === "undefined"
    ? undefined
    : (window as WebRuntimeWindow);
}

export function isWebRuntime(): boolean {
  return getRuntimeWindow()?.__PROMPTHUB_WEB__ === true;
}

export function getRuntimeCapabilities(): PromptHubRuntimeCapabilities {
  if (isWebRuntime()) {
    return {
      appUpdate: false,
      dataRecovery: false,
      desktopWindowControls: false,
      skillDistribution: false,
      skillFileEditing: false,
      skillLocalScan: false,
      skillPlatformIntegration: false,
      skillStore: false,
    };
  }

  return {
    appUpdate: true,
    dataRecovery: true,
    desktopWindowControls: true,
    skillDistribution: true,
    skillFileEditing: true,
    skillLocalScan: true,
    skillPlatformIntegration: true,
    skillStore: true,
  };
}

export function getWebContext(): PromptHubWebContext | undefined {
  if (!isWebRuntime()) {
    return undefined;
  }

  return getRuntimeWindow()?.__PROMPTHUB_WEB_CONTEXT__;
}

export async function logoutWebSession(): Promise<void> {
  const logout = getRuntimeWindow()?.__PROMPTHUB_WEB_LOGOUT__;
  if (typeof logout === "function") {
    await logout();
  }
}
