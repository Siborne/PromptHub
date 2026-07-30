import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppCommand } from "@prompthub/shared/types";
import {
  createAgentDeepLinkRouter,
  registerAgentDeepLinkClient,
  startAgentDeepLinkRouting,
} from "../../../src/main/agent-deep-link-router";

function validLink(name = "Imported"): string {
  return `prompthub://import?payload=${encodeURIComponent(
    JSON.stringify({
      version: 1,
      objectType: "provider-profile",
      value: {
        version: 1,
        profile: {
          platformId: "codex",
          name,
          providerKind: "openai-compatible",
          protocol: "openai-responses",
          endpoint: "https://api.example.com/v1",
          config: {},
          source: "manual",
        },
        modelMappings: [],
        requiresSecret: true,
      },
    }),
  )}`;
}

describe("Agent deep-link main-process router", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("buffers sanitized commands and keeps only the newest bounded entries", () => {
    const router = createAgentDeepLinkRouter({ maxPending: 2 });
    const commands: AppCommand[] = [];

    expect(router.acceptUrl(validLink("First"))).toBe(true);
    expect(router.acceptUrl(validLink("Second"))).toBe(true);
    expect(router.acceptUrl(validLink("Third"))).toBe(true);
    expect(router.pendingCount()).toBe(2);

    router.connect((command) => commands.push(command));
    expect(commands).toHaveLength(2);
    expect(commands.map((command) => command.type)).toEqual([
      "agent:import-provider",
      "agent:import-provider",
    ]);
    expect(
      commands.map((command) =>
        command.type === "agent:import-provider"
          ? command.preview.profile.name
          : null,
      ),
    ).toEqual(["Second", "Third"]);
    expect(router.pendingCount()).toBe(0);
  });

  it("rejects non-positive and non-integer queue capacities", () => {
    expect(() => createAgentDeepLinkRouter({ maxPending: 0 })).toThrow(
      "AGENT_DEEP_LINK_ROUTER_INVALID_CAPACITY",
    );
    expect(() => createAgentDeepLinkRouter({ maxPending: 1.5 })).toThrow(
      "AGENT_DEEP_LINK_ROUTER_INVALID_CAPACITY",
    );
  });

  it("emits only stable error commands and never includes the raw URL", () => {
    const secret = "sk-do-not-forward";
    const router = createAgentDeepLinkRouter();
    const commands: AppCommand[] = [];
    router.connect((command) => commands.push(command));

    expect(
      router.acceptUrl(
        `prompthub://import?payload=${encodeURIComponent(
          JSON.stringify({
            version: 1,
            objectType: "provider-profile",
            apiKey: secret,
            value: {},
          }),
        )}`,
      ),
    ).toBe(false);

    expect(commands).toEqual([
      {
        type: "agent:import-error",
        errorCode: "AGENT_DEEP_LINK_SENSITIVE_VALUE_REJECTED",
      },
    ]);
    expect(JSON.stringify(commands)).not.toContain(secret);
  });

  it("accepts one deep-link argv candidate and rejects ambiguous launches", () => {
    const router = createAgentDeepLinkRouter();
    const commands: AppCommand[] = [];
    router.connect((command) => commands.push(command));

    expect(router.acceptArgv(["PromptHub", "--hidden", validLink()])).toBe(
      true,
    );
    expect(
      router.acceptArgv(["PromptHub", validLink("One"), validLink("Two")]),
    ).toBe(false);
    expect(router.acceptArgv(["PromptHub", "--hidden"])).toBe(false);
    expect(
      router.acceptArgv([
        "PromptHub",
        42 as unknown as string,
        validLink("Typed"),
      ]),
    ).toBe(true);

    expect(commands.map((command) => command.type)).toEqual([
      "agent:import-provider",
      "agent:import-error",
      "agent:import-provider",
    ]);
    expect(commands[1]).toEqual({
      type: "agent:import-error",
      errorCode: "AGENT_DEEP_LINK_INVALID",
    });
  });

  it("disconnects a stale renderer sink without losing later commands", () => {
    const first = vi.fn();
    const second = vi.fn();
    const router = createAgentDeepLinkRouter();

    router.connect(first);
    router.disconnect(second);
    router.acceptUrl(validLink("Still connected"));
    expect(first).toHaveBeenCalledOnce();
    router.disconnect(first);
    router.acceptUrl(validLink());
    expect(first).toHaveBeenCalledOnce();
    expect(router.pendingCount()).toBe(1);

    router.connect(second);
    expect(second).toHaveBeenCalledOnce();
  });
});

describe("Agent deep-link protocol registration", () => {
  it("starts one OS listener and routes its sanitized command", () => {
    const listeners: Array<
      (event: { preventDefault: () => void }, url: string) => void
    > = [];
    const setAsDefaultProtocolClient = vi.fn(() => true);
    const app = {
      isPackaged: false,
      on: vi.fn(
        (
          _event: "open-url",
          listener: (
            event: { preventDefault: () => void },
            url: string,
          ) => void,
        ) => listeners.push(listener),
      ),
      setAsDefaultProtocolClient,
    };
    const router = startAgentDeepLinkRouting(app, true, false, {
      argv: ["electron", "/workspace/apps/desktop"],
      execPath: "/opt/electron",
    });
    const commands: AppCommand[] = [];
    const preventDefault = vi.fn();
    router.connect((command) => commands.push(command));

    listeners[0]({ preventDefault }, validLink());

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(commands[0]?.type).toBe("agent:import-provider");
    expect(setAsDefaultProtocolClient).toHaveBeenCalledWith(
      "prompthub",
      "/opt/electron",
      ["/workspace/apps/desktop"],
    );
  });

  it("keeps URL handling available when protocol registration is disabled", () => {
    const listeners: Array<
      (event: { preventDefault: () => void }, url: string) => void
    > = [];
    const setAsDefaultProtocolClient = vi.fn(() => true);
    const app = {
      isPackaged: true,
      on: vi.fn(
        (
          _event: "open-url",
          listener: (
            event: { preventDefault: () => void },
            url: string,
          ) => void,
        ) => listeners.push(listener),
      ),
      setAsDefaultProtocolClient,
    };
    const router = startAgentDeepLinkRouting(app, false, false);
    const commands: AppCommand[] = [];
    router.connect((command) => commands.push(command));

    listeners[0]({ preventDefault: vi.fn() }, "prompthub://invalid");

    expect(commands).toEqual([
      {
        type: "agent:import-error",
        errorCode: "AGENT_DEEP_LINK_INVALID",
      },
    ]);
    expect(setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it("uses the working directory when development argv has no entry path", () => {
    const setAsDefaultProtocolClient = vi.fn(() => true);
    const app = {
      isPackaged: false,
      on: vi.fn(),
      setAsDefaultProtocolClient,
    };

    startAgentDeepLinkRouting(app, true, false, {
      argv: [],
      execPath: "/opt/electron",
    });

    expect(setAsDefaultProtocolClient).toHaveBeenCalledWith(
      "prompthub",
      "/opt/electron",
      [process.cwd()],
    );
  });

  it("skips E2E and registers packaged builds without app arguments", () => {
    const setAsDefaultProtocolClient = vi.fn(() => true);
    const app = { setAsDefaultProtocolClient };

    expect(
      registerAgentDeepLinkClient({
        app,
        isE2E: true,
        isPackaged: true,
        execPath: "/Applications/PromptHub",
        appEntryPath: "/app/main.js",
      }),
    ).toBe(false);
    expect(setAsDefaultProtocolClient).not.toHaveBeenCalled();

    expect(
      registerAgentDeepLinkClient({
        app,
        isE2E: false,
        isPackaged: true,
        execPath: "/Applications/PromptHub",
        appEntryPath: "/app/main.js",
      }),
    ).toBe(true);
    expect(setAsDefaultProtocolClient).toHaveBeenCalledWith("prompthub");
  });

  it("registers development builds with the exact executable and entry path", () => {
    const setAsDefaultProtocolClient = vi.fn(() => true);
    expect(
      registerAgentDeepLinkClient({
        app: { setAsDefaultProtocolClient },
        isE2E: false,
        isPackaged: false,
        execPath: "/opt/electron",
        appEntryPath: "/workspace/apps/desktop",
      }),
    ).toBe(true);
    expect(setAsDefaultProtocolClient).toHaveBeenCalledWith(
      "prompthub",
      "/opt/electron",
      ["/workspace/apps/desktop"],
    );
  });

  it("fails closed when OS protocol registration throws", () => {
    expect(
      registerAgentDeepLinkClient({
        app: {
          setAsDefaultProtocolClient: () => {
            throw new Error("OS failure");
          },
        },
        isE2E: false,
        isPackaged: true,
        execPath: "/Applications/PromptHub",
        appEntryPath: "/app/main.js",
      }),
    ).toBe(false);
  });
});
