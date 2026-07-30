import path from "node:path";

import type { AppCommand } from "@prompthub/shared/types";
import { parseAgentDeepLink } from "@prompthub/shared/utils/agent-deep-link";

type CommandSink = (command: AppCommand) => void;

interface AgentDeepLinkRouterOptions {
  maxPending?: number;
}

export interface AgentDeepLinkRouter {
  acceptArgv: (argv: readonly string[]) => boolean;
  acceptUrl: (rawUrl: string) => boolean;
  connect: (sink: CommandSink) => void;
  disconnect: (sink: CommandSink) => void;
  pendingCount: () => number;
}

export function createAgentDeepLinkRouter(
  options: AgentDeepLinkRouterOptions = {},
): AgentDeepLinkRouter {
  const maxPending = options.maxPending ?? 10;
  if (!Number.isInteger(maxPending) || maxPending <= 0) {
    throw new Error("AGENT_DEEP_LINK_ROUTER_INVALID_CAPACITY");
  }

  const pending: AppCommand[] = [];
  let activeSink: CommandSink | null = null;

  const publish = (command: AppCommand) => {
    if (activeSink) {
      activeSink(command);
      return;
    }
    pending.push(command);
    if (pending.length > maxPending) pending.shift();
  };

  const publishInvalid = () => {
    publish({
      type: "agent:import-error",
      errorCode: "AGENT_DEEP_LINK_INVALID",
    });
  };

  return {
    acceptArgv(argv) {
      const candidates = argv.filter(
        (argument) =>
          typeof argument === "string" &&
          argument.toLowerCase().startsWith("prompthub:"),
      );
      if (candidates.length === 0) return false;
      if (candidates.length !== 1) {
        publishInvalid();
        return false;
      }
      return this.acceptUrl(candidates[0]);
    },
    acceptUrl(rawUrl) {
      const result = parseAgentDeepLink(rawUrl);
      if ("command" in result) {
        publish(result.command);
        return true;
      }
      publish({
        type: "agent:import-error",
        errorCode: result.errorCode,
      });
      return false;
    },
    connect(sink) {
      activeSink = sink;
      const buffered = pending.splice(0, pending.length);
      for (const command of buffered) sink(command);
    },
    disconnect(sink) {
      if (activeSink === sink) activeSink = null;
    },
    pendingCount() {
      return pending.length;
    },
  };
}

interface ProtocolClientApp {
  setAsDefaultProtocolClient: (
    scheme: string,
    path?: string,
    args?: string[],
  ) => boolean;
}

interface RegisterAgentDeepLinkClientOptions {
  app: ProtocolClientApp;
  isE2E: boolean;
  isPackaged: boolean;
  execPath: string;
  appEntryPath: string;
}

interface AgentDeepLinkStartupApp extends ProtocolClientApp {
  isPackaged: boolean;
  on: (
    event: "open-url",
    listener: (event: { preventDefault: () => void }, url: string) => void,
  ) => unknown;
}

interface AgentDeepLinkRuntime {
  argv: readonly string[];
  execPath: string;
}

export function registerAgentDeepLinkClient({
  app,
  isE2E,
  isPackaged,
  execPath,
  appEntryPath,
}: RegisterAgentDeepLinkClientOptions): boolean {
  if (isE2E) return false;
  try {
    return isPackaged
      ? app.setAsDefaultProtocolClient("prompthub")
      : app.setAsDefaultProtocolClient("prompthub", execPath, [appEntryPath]);
  } catch {
    return false;
  }
}

export function startAgentDeepLinkRouting(
  app: AgentDeepLinkStartupApp,
  registrationEnabled: boolean,
  isE2E: boolean,
  runtime: AgentDeepLinkRuntime = {
    argv: process.argv,
    execPath: process.execPath,
  },
): AgentDeepLinkRouter {
  const router = createAgentDeepLinkRouter();
  if (registrationEnabled) {
    registerAgentDeepLinkClient({
      app,
      isE2E,
      isPackaged: app.isPackaged,
      execPath: runtime.execPath,
      appEntryPath: path.resolve(runtime.argv[1] || "."),
    });
  }
  app.on("open-url", (event, url) => {
    event.preventDefault();
    router.acceptUrl(url);
  });
  return router;
}
