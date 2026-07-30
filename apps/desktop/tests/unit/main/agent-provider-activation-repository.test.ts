/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import type {
  AgentProviderProfile,
  AgentProviderSnapshot,
  CreateAgentProviderSnapshotInput,
} from "@prompthub/shared";
import { createAgentProviderActivationRepository } from "../../../src/main/services/agent-provider-activation-repository";

const profile: AgentProviderProfile = {
  id: "profile-1",
  platformId: "codex",
  name: "Work",
  providerKind: "custom",
  protocol: "responses",
  endpoint: "https://gateway.example.com/v1",
  config: {},
  secretRef: "provider:profile-1",
  source: "manual",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
};

function verifiedSnapshot(
  redactedSnapshot: Record<string, unknown>,
): AgentProviderSnapshot {
  return {
    id: "snapshot-1",
    platformId: "codex",
    providerProfileId: "profile-1",
    nativeDigest: "digest-1",
    redactedSnapshot,
    backupRef: "/tmp/backup",
    operation: "activate",
    result: "verified",
    createdAt: 1,
  };
}

function database(snapshot: AgentProviderSnapshot | null = null): {
  getProfileById: ReturnType<typeof vi.fn>;
  listModelMappings: ReturnType<typeof vi.fn>;
  getLatestVerifiedSnapshot: ReturnType<typeof vi.fn>;
  createSnapshot: ReturnType<typeof vi.fn>;
} {
  return {
    getProfileById: vi.fn().mockReturnValue(profile),
    listModelMappings: vi.fn().mockReturnValue([
      {
        id: "mapping-primary",
        providerProfileId: "profile-1",
        routeKey: "primary",
        modelId: "gpt-5.4",
        parameters: {},
      },
    ]),
    getLatestVerifiedSnapshot: vi.fn().mockReturnValue(snapshot),
    createSnapshot: vi
      .fn()
      .mockImplementation((input: CreateAgentProviderSnapshotInput) => ({
        id: "snapshot-recorded",
        providerProfileId: input.providerProfileId ?? null,
        backupRef: input.backupRef ?? null,
        createdAt: 2,
        ...input,
      })),
  };
}

describe("Agent provider activation repository", () => {
  it("delegates profiles and snapshots to the provider database", async () => {
    const db = database(
      verifiedSnapshot({
        adapterVersion: "1",
        values: {
          model: "gpt-5.4",
          flags: [true, null, { effort: 3 }],
        },
      }),
    );
    const repository = createAgentProviderActivationRepository(db);

    await expect(repository.getProfile("profile-1")).resolves.toBe(profile);
    await expect(repository.listModelMappings("profile-1")).resolves.toEqual([
      expect.objectContaining({
        routeKey: "primary",
        modelId: "gpt-5.4",
      }),
    ]);
    await expect(repository.getBaseline("codex")).resolves.toEqual({
      platformId: "codex",
      adapterVersion: "1",
      nativeDigest: "digest-1",
      values: {
        model: "gpt-5.4",
        flags: [true, null, { effort: 3 }],
      },
    });

    const input: CreateAgentProviderSnapshotInput = {
      platformId: "codex",
      providerProfileId: "profile-1",
      nativeDigest: "digest-2",
      redactedSnapshot: { adapterVersion: "1", values: {} },
      operation: "activate",
      result: "verified",
    };
    await expect(repository.recordSnapshot(input)).resolves.toMatchObject({
      id: "snapshot-recorded",
      nativeDigest: "digest-2",
    });
    expect(db.createSnapshot).toHaveBeenCalledWith(input);
  });

  it("returns null when no verified baseline exists", async () => {
    const repository = createAgentProviderActivationRepository(database());
    await expect(repository.getBaseline("codex")).resolves.toBeNull();
  });

  it("accepts JSON-compatible records with a null prototype", async () => {
    const values = Object.assign(
      Object.create(null) as Record<string, unknown>,
      {
        model: "gpt-5.4",
      },
    );
    const repository = createAgentProviderActivationRepository(
      database(verifiedSnapshot({ adapterVersion: "1", values })),
    );

    await expect(repository.getBaseline("codex")).resolves.toMatchObject({
      values: { model: "gpt-5.4" },
    });
  });

  it("rejects malformed, sensitive, or oversized baseline snapshots", async () => {
    const invalidSnapshots = [
      {},
      { adapterVersion: "", values: {} },
      { adapterVersion: "1", values: null },
      { adapterVersion: "1", values: [] },
      { adapterVersion: "1", values: { apiKey: "secret-token" } },
      { adapterVersion: "1", values: { apiToken: "secret-token" } },
      { adapterVersion: "1", values: { privateKey: "secret-token" } },
      {
        adapterVersion: "1",
        values: { nested: { authorization: "Bearer secret-token" } },
      },
      {
        adapterVersion: "1",
        values: { invalid: undefined },
      },
    ];
    for (const redacted of invalidSnapshots) {
      const repository = createAgentProviderActivationRepository(
        database(verifiedSnapshot(redacted as Record<string, unknown>)),
      );
      await expect(repository.getBaseline("codex")).rejects.toThrow(
        "AGENT_PROVIDER_BASELINE_INVALID",
      );
    }

    let deep: Record<string, unknown> = { value: true };
    for (let index = 0; index < 20; index += 1) {
      deep = { nested: deep };
    }
    await expect(
      createAgentProviderActivationRepository(
        database(verifiedSnapshot({ adapterVersion: "1", values: deep })),
      ).getBaseline("codex"),
    ).rejects.toThrow("AGENT_PROVIDER_BASELINE_INVALID");
  });
});
