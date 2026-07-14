/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  applyMcpMarketTemplate,
  computeInstalledMcpMarketFingerprint,
  computeMcpMarketTemplateFingerprint,
  prepareMcpMarketTemplateUpdate,
  reconcileMcpMarketTemplate,
} from "@prompthub/core/mcp-market-reconciliation";
import type {
  McpMarketTemplate,
  McpServerConfig,
} from "@prompthub/shared/types/mcp";

const template: McpMarketTemplate = {
  id: "registry:review",
  version: "1.0.0",
  name: "review",
  displayName: "Review",
  description: "Review code",
  transport: "stdio",
  command: "npx",
  args: ["review@1"],
  cwd: "/template/cwd",
  env: { REVIEW_TOKEN: "" },
  headers: { Authorization: "" },
  tags: ["review"],
  source: {
    id: "registry",
    label: "Registry",
    url: "https://registry.example.com/catalog.json",
    trustLevel: "community",
  },
};

function createInstalled(): McpServerConfig {
  const server: McpServerConfig = {
    id: "mcp_review",
    name: "review",
    displayName: template.displayName,
    description: template.description,
    transport: template.transport,
    command: template.command,
    args: template.args,
    cwd: "/user/cwd",
    env: { REVIEW_TOKEN: "private-token" },
    headers: { Authorization: "Bearer private" },
    enabled: false,
    isFavorite: true,
    notes: "Personal note",
    tags: ["personal"],
    source: { type: "market", id: template.id, label: "Registry" },
    createdAt: 1,
    updatedAt: 1,
  };
  return applyMcpMarketTemplate(server, template, 1);
}

describe("MCP market reconciliation", () => {
  it("ignores secret values and user-owned state in source fingerprints", () => {
    const installed = createInstalled();
    const changedSecrets = {
      ...installed,
      env: { REVIEW_TOKEN: "another-secret" },
      headers: { Authorization: "Bearer changed" },
      enabled: true,
      notes: "Changed note",
      tags: ["changed"],
    };

    expect(computeInstalledMcpMarketFingerprint(changedSecrets)).toBe(
      computeMcpMarketTemplateFingerprint(template),
    );
  });

  it("distinguishes local-only changes, conflicts, legacy matches, and source mismatch", () => {
    const installed = createInstalled();
    expect(
      reconcileMcpMarketTemplate(
        { ...installed, command: "custom-command" },
        template,
        2,
      ),
    ).toMatchObject({ status: "local-modified", remoteChanged: false });
    expect(
      reconcileMcpMarketTemplate(
        { ...installed, command: "custom-command" },
        { ...template, version: "2.0.0" },
        2,
      ),
    ).toMatchObject({ status: "conflict", remoteChanged: true });
    expect(
      reconcileMcpMarketTemplate(
        installed,
        { ...template, version: "2.0.0" },
        2,
      ),
    ).toMatchObject({ status: "update-available", localModified: false });
    expect(
      reconcileMcpMarketTemplate(
        {
          ...installed,
          source: {
            ...installed.source,
            installedTemplateFingerprint: undefined,
          },
        },
        template,
        2,
      ),
    ).toMatchObject({ status: "up-to-date" });
    expect(
      reconcileMcpMarketTemplate(
        {
          ...installed,
          command: "legacy-command",
          source: {
            ...installed.source,
            installedTemplateFingerprint: undefined,
          },
        },
        template,
        2,
      ),
    ).toMatchObject({ status: "legacy-review" });
    expect(
      reconcileMcpMarketTemplate(
        { ...installed, source: { type: "manual" } },
        template,
        2,
      ),
    ).toMatchObject({ status: "source-mismatch" });
    expect(
      reconcileMcpMarketTemplate(
        {
          ...installed,
          source: { ...installed.source, id: "registry:other" },
        },
        template,
        2,
      ),
    ).toMatchObject({ status: "source-mismatch" });
  });

  it("applies source fields while preserving secrets and PromptHub-owned values", () => {
    const installed = createInstalled();
    const updated = applyMcpMarketTemplate(
      installed,
      {
        ...template,
        version: "2.0.0",
        args: ["review@2"],
        env: { REVIEW_TOKEN: "", REVIEW_MODE: "strict" },
      },
      3,
    );

    expect(updated).toMatchObject({
      id: installed.id,
      name: installed.name,
      args: ["review@2"],
      cwd: "/user/cwd",
      env: { REVIEW_TOKEN: "private-token", REVIEW_MODE: "strict" },
      headers: { Authorization: "Bearer private" },
      enabled: false,
      isFavorite: true,
      notes: "Personal note",
      tags: ["personal"],
      source: {
        installedTemplateVersion: "2.0.0",
        installedTemplateFingerprint: expect.stringMatching(/^sha256:/),
      },
    });
  });

  it("requires explicit force for divergent installs and rejects a different source", () => {
    const installed = createInstalled();
    const local = { ...installed, command: "custom-command" };

    expect(prepareMcpMarketTemplateUpdate(local, template)).toMatchObject({
      errorCode: "MARKET_UPDATE_REVIEW_REQUIRED",
    });
    expect(prepareMcpMarketTemplateUpdate(installed, template)).toMatchObject({
      shouldPersist: false,
      result: { status: "up-to-date" },
    });
    expect(prepareMcpMarketTemplateUpdate(local, template, true)).toMatchObject(
      {
        shouldPersist: true,
        result: { status: "updated", server: { command: "npx" } },
      },
    );
    expect(
      prepareMcpMarketTemplateUpdate(
        { ...installed, source: { type: "manual" } },
        template,
      ),
    ).toMatchObject({ errorCode: "SOURCE_MISMATCH" });
  });

  it("normalizes absent optional template fields and empty secret maps", () => {
    const minimalTemplate: McpMarketTemplate = {
      id: "registry:minimal",
      name: "minimal",
      displayName: "Minimal",
      description: "",
      transport: "stdio",
      tags: [],
    };
    const minimalServer: McpServerConfig = {
      id: "mcp_minimal",
      name: "minimal",
      displayName: "Minimal",
      transport: "stdio",
      enabled: true,
      source: { type: "market", id: minimalTemplate.id },
      createdAt: 1,
      updatedAt: 1,
    };
    const applied = applyMcpMarketTemplate(minimalServer, minimalTemplate);

    expect(computeInstalledMcpMarketFingerprint(minimalServer)).toMatch(
      /^sha256:/,
    );
    expect(applied).toMatchObject({
      displayName: "Minimal",
      env: undefined,
      headers: undefined,
      source: { label: "Minimal", url: undefined },
    });
    expect(computeInstalledMcpMarketFingerprint(applied)).toBe(
      computeMcpMarketTemplateFingerprint(minimalTemplate),
    );
  });
});
