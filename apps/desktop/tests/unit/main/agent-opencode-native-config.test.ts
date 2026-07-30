/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  parseOpenCodeAuth,
  parseOpenCodeConfig,
  projectOpenCodeState,
  renderOpenCodeAuth,
  renderOpenCodeConfig,
} from "../../../src/main/services/agent-opencode-native-config";

describe("OpenCode native config codec", () => {
  it("rejects malformed and non-object config and auth documents", () => {
    expect(() => parseOpenCodeConfig("[]")).toThrow(
      "AGENT_OPENCODE_PROVIDER_CONFIG_INVALID",
    );
    expect(() => parseOpenCodeConfig("{")).toThrow(
      "AGENT_OPENCODE_PROVIDER_CONFIG_INVALID",
    );
    expect(() => parseOpenCodeAuth("{")).toThrow(
      "AGENT_OPENCODE_PROVIDER_AUTH_INVALID",
    );
    expect(() => parseOpenCodeAuth("[]")).toThrow(
      "AGENT_OPENCODE_PROVIDER_AUTH_INVALID",
    );
  });

  it("projects incomplete and legacy shapes without inventing ownership", () => {
    expect(projectOpenCodeState({}, {})).toMatchObject({
      providerId: null,
      model: null,
      authOwnership: "missing",
      credentialStatus: "missing",
      authorizationHeaderConflict: false,
    });
    expect(
      projectOpenCodeState(
        {
          model: "model-without-provider",
          small_model: "other/small",
        },
        {},
      ),
    ).toMatchObject({
      providerId: null,
      model: "model-without-provider",
      secondaryModel: "other/small",
    });
    expect(
      projectOpenCodeState(
        {
          model: "provider/",
          small_model: "other/small",
        },
        {},
      ),
    ).toMatchObject({
      providerId: null,
      model: "provider/",
    });
    expect(
      projectOpenCodeState(
        {
          model: "provider/main",
          small_model: "other/small",
          provider: {
            provider: {
              npm: " ",
              headers: { Authorization: "private" },
            },
          },
        },
        { provider: { type: "future-auth" } },
      ),
    ).toMatchObject({
      providerId: "provider",
      packageName: null,
      secondaryModel: "other/small",
      authOwnership: "missing",
      authorizationHeaderConflict: true,
    });
  });

  it("detects provider option headers and direct model headers", () => {
    expect(
      projectOpenCodeState(
        {
          model: "provider/main",
          provider: {
            provider: {
              options: {
                headers: { authorization: "private" },
              },
            },
          },
        },
        { provider: { type: "api" } },
      ),
    ).toMatchObject({
      authOwnership: "api",
      credentialStatus: "platform-managed",
      authorizationHeaderConflict: true,
    });
    expect(
      projectOpenCodeState(
        {
          model: "provider/main",
          provider: {
            provider: {
              models: {
                main: { headers: { AUTHORIZATION: "private" } },
              },
            },
          },
        },
        {},
      ).authorizationHeaderConflict,
    ).toBe(true);
  });

  it("renders a fresh direct provider without a secondary model", () => {
    const rendered = renderOpenCodeConfig(
      null,
      {},
      {
        providerId: "gateway",
        packageName: "@ai-sdk/openai",
        endpoint: "https://gateway.example/v1",
        name: "Gateway",
        model: "gpt-main",
        secondaryModel: null,
      },
    );
    expect(parseOpenCodeConfig(rendered)).toMatchObject({
      model: "gateway/gpt-main",
      provider: {
        gateway: {
          npm: "@ai-sdk/openai",
          models: { "gpt-main": { name: "gpt-main" } },
        },
      },
    });
    expect(parseOpenCodeConfig(rendered)).not.toHaveProperty("small_model");
    expect(rendered.endsWith("\n")).toBe(true);
  });

  it("preserves useful model metadata and replaces a blank display name", () => {
    const original = JSON.stringify({
      provider: {
        gateway: {
          models: {
            "gpt-main": { name: " ", limit: { context: 10 } },
          },
        },
      },
    });
    const rendered = renderOpenCodeConfig(
      original,
      parseOpenCodeConfig(original),
      {
        providerId: "gateway",
        packageName: "@ai-sdk/openai-compatible",
        endpoint: "https://gateway.example/v1",
        name: "Gateway",
        model: "gpt-main",
        secondaryModel: "gpt-small",
      },
    );
    expect(parseOpenCodeConfig(rendered)).toMatchObject({
      provider: {
        gateway: {
          models: {
            "gpt-main": {
              name: "gpt-main",
              limit: { context: 10 },
            },
            "gpt-small": { name: "gpt-small" },
          },
        },
      },
      small_model: "gateway/gpt-small",
    });
  });

  it("renders API auth while preserving unrelated native entries", () => {
    expect(
      parseOpenCodeAuth(
        renderOpenCodeAuth(
          { native: { type: "oauth", refresh: "keep" } },
          "gateway",
          "main-only",
        ),
      ),
    ).toEqual({
      native: { type: "oauth", refresh: "keep" },
      gateway: { type: "api", key: "main-only" },
    });
  });
});
