import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  AgentProviderModelMapping,
  AgentProviderProfile,
} from "@prompthub/shared/types/agent";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAgentDeviceConfigDocument,
  materializeAgentProviderResourceBundle,
  parseAgentDeviceConfigDocument,
  readAgentProviderResourceBundle,
} from "../src/agent-resource-schema";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-agent-bundle-"),
  );
  roots.push(value);
  return value;
}

function profile(): AgentProviderProfile {
  return {
    id: "profile-1",
    platformId: "codex",
    name: "OpenAI",
    providerKind: "openai",
    protocol: "openai-responses",
    endpoint: "https://api.openai.com/v1",
    config: { reasoningEffort: "high" },
    secretRef: "agent-provider:profile-1",
    source: "manual",
    archived: false,
    createdAt: Date.parse("2026-08-11T00:00:00.000Z"),
    updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
  };
}

function mapping(): AgentProviderModelMapping {
  return {
    id: "mapping-1",
    providerProfileId: "profile-1",
    routeKey: "primary",
    modelId: "gpt-5",
    parameters: { temperature: 0.2 },
  };
}

afterEach(() => {
  for (const value of roots.splice(0))
    fs.rmSync(value, { recursive: true, force: true });
});

describe("Agent canonical resource schema", () => {
  it("replaces profile metadata with an independent resource revision", () => {
    const base = root();
    const bundlePath = path.join(base, "profile");
    materializeAgentProviderResourceBundle({
      bundlePath,
      profile: profile(),
      modelMappings: [mapping()],
    });
    const updated = {
      ...profile(),
      name: "OpenAI Primary",
      updatedAt: Date.parse("2026-08-11T02:00:00.000Z"),
    };

    const manifest = materializeAgentProviderResourceBundle({
      bundlePath,
      profile: updated,
      modelMappings: [mapping()],
      writePolicy: { mode: "replace" },
    });

    expect(manifest.revision).toBe(2);
    expect(readAgentProviderResourceBundle(bundlePath).profile.name).toBe(
      "OpenAI Primary",
    );
  });

  it("round-trips a provider profile and mappings without persisting device secret refs", () => {
    const base = root();
    const bundlePath = path.join(base, "profile");
    materializeAgentProviderResourceBundle({
      bundlePath,
      profile: profile(),
      modelMappings: [mapping()],
    });

    const stored = fs.readFileSync(path.join(bundlePath, "agent.json"), "utf8");
    expect(stored).not.toContain("agent-provider:profile-1");
    const restored = readAgentProviderResourceBundle(bundlePath);
    expect(restored.profile).toEqual({
      ...profile(),
      secretRef: "agent-provider:profile-1",
    });
    expect(restored.requiresSecret).toBe(true);
    expect(restored.modelMappings).toEqual([mapping()]);
  });

  it("keeps custom roots and built-in overrides in device configuration", () => {
    const document = createAgentDeviceConfigDocument({
      deviceId: "device-1",
      builtinAgentOverrides: {
        codex: { rootPath: "/Users/example/.codex-custom" },
      },
      customAgents: [
        {
          id: "custom-agent",
          name: "Custom",
          rootPath: "/Users/example/.custom-agent",
          enabled: true,
          skillsRelativePath: "skills",
        },
      ],
      disabledPlatformIds: ["gemini"],
      agentIdentityPreferences: {
        codex: { name: "codex", icon: "chatgpt" },
      },
    });
    expect(
      parseAgentDeviceConfigDocument(JSON.stringify(document), {
        expectedDeviceId: "device-1",
      }),
    ).toEqual(document);
  });

  it("rejects secret-like public config, foreign mappings, and tampering", () => {
    const base = root();
    expect(() =>
      materializeAgentProviderResourceBundle({
        bundlePath: path.join(base, "secret"),
        profile: { ...profile(), config: { apiKey: "sk-secret" } },
        modelMappings: [mapping()],
      }),
    ).toThrow(/PUBLIC_CONFIG_INVALID|secret|sensitive|apiKey/iu);

    expect(() =>
      materializeAgentProviderResourceBundle({
        bundlePath: path.join(base, "foreign"),
        profile: profile(),
        modelMappings: [{ ...mapping(), providerProfileId: "other" }],
      }),
    ).toThrow(/does not belong/u);

    const bundlePath = path.join(base, "tampered");
    materializeAgentProviderResourceBundle({
      bundlePath,
      profile: profile(),
      modelMappings: [mapping()],
    });
    fs.appendFileSync(path.join(bundlePath, "agent.json"), " ");
    expect(() => readAgentProviderResourceBundle(bundlePath)).toThrow(
      /size mismatch/u,
    );
  });
});
