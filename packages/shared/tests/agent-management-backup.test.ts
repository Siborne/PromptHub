import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAgentManagementBackup } from "@prompthub/shared/utils/agent-management-backup";

function validBackup() {
  return {
    version: 1,
    providerProfiles: [
      {
        id: "profile-1",
        profile: {
          platformId: "claude",
          name: "Work",
          providerKind: "anthropic-compatible",
          protocol: "messages",
          endpoint: "https://api.example.com/v1",
          config: { region: "global" },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "claude-sonnet-4",
            parameters: { temperature: 0.2 },
          },
        ],
        requiresSecret: true,
        archived: false,
        createdAt: 100,
        updatedAt: 200,
      },
    ],
    snapshots: [
      {
        id: "snapshot-1",
        platformId: "claude",
        providerProfileId: "profile-1",
        nativeDigest: "sha256:abc",
        redactedSnapshot: { model: "claude-sonnet-4" },
        operation: "activate",
        result: "verified",
        createdAt: 300,
      },
    ],
  } as const;
}

describe("Agent management portable backup validation", () => {
  it("accepts a bounded, secret-free provider and snapshot bundle", () => {
    const parsed = parseAgentManagementBackup(validBackup());

    assert.deepEqual(parsed, validBackup());
    assert.equal(
      JSON.stringify(parsed).includes("agent-provider:profile-1"),
      false,
    );
  });

  it("rejects credentials, internal backup references, and unknown fields", () => {
    const invalidValues = [
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...validBackup().providerProfiles[0],
            secretRef: "agent-provider:profile-1",
          },
        ],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...validBackup().providerProfiles[0],
            profile: {
              ...validBackup().providerProfiles[0].profile,
              config: { accessToken: "literal-secret" },
            },
          },
        ],
      },
      {
        ...validBackup(),
        snapshots: [
          {
            ...validBackup().snapshots[0],
            backupRef: "/device/local/config.enc",
          },
        ],
      },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseAgentManagementBackup(value),
        /AGENT_MANAGEMENT_BACKUP_INVALID/,
      );
    }
  });

  it("rejects malformed versions, duplicate identities, and broken references", () => {
    const profile = validBackup().providerProfiles[0];
    const invalidValues = [
      { ...validBackup(), version: 2 },
      {
        ...validBackup(),
        providerProfiles: [profile, profile],
      },
      {
        ...validBackup(),
        providerProfiles: [
          profile,
          {
            ...profile,
            id: "profile-2",
            profile: {
              ...profile.profile,
              name: "work",
            },
          },
        ],
      },
      {
        ...validBackup(),
        snapshots: [
          {
            ...validBackup().snapshots[0],
            providerProfileId: "missing-profile",
          },
        ],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...profile,
            updatedAt: 99,
          },
        ],
      },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseAgentManagementBackup(value),
        /AGENT_MANAGEMENT_BACKUP_INVALID/,
      );
    }
  });

  it("enforces bounded profile, mapping, snapshot, and string counts", () => {
    const profile = validBackup().providerProfiles[0];
    const invalidValues = [
      {
        ...validBackup(),
        providerProfiles: Array.from({ length: 1_001 }, (_, index) => ({
          ...profile,
          id: `profile-${index}`,
          profile: {
            ...profile.profile,
            name: `Profile ${index}`,
          },
        })),
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...profile,
            modelMappings: Array.from({ length: 101 }, (_, index) => ({
              routeKey: `route-${index}`,
              modelId: "model",
              parameters: {},
            })),
          },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...profile,
            profile: {
              ...profile.profile,
              name: "x".repeat(513),
            },
          },
        ],
      },
      {
        ...validBackup(),
        providerProfiles: [],
        snapshots: Array.from({ length: 5_001 }, (_, index) => ({
          ...validBackup().snapshots[0],
          id: `snapshot-${index}`,
          providerProfileId: null,
        })),
      },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseAgentManagementBackup(value),
        /AGENT_MANAGEMENT_BACKUP_INVALID/,
      );
    }
  });

  it("rejects every malformed profile and mapping boundary", () => {
    const profile = validBackup().providerProfiles[0];
    const profileInput = profile.profile;
    const mapping = profile.modelMappings[0];
    const invalidValues: unknown[] = [
      null,
      [],
      new Date(),
      { ...validBackup(), unknown: true },
      { ...validBackup(), providerProfiles: null },
      { ...validBackup(), snapshots: null },
      { ...validBackup(), providerProfiles: [null], snapshots: [] },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, unknown: true }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, modelMappings: null }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, requiresSecret: "yes" }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, archived: 0 }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, id: "-invalid" }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, id: "x".repeat(129) }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, createdAt: "now" }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, createdAt: 1.5 }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, createdAt: -1 }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, profile: null }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          { ...profile, profile: { ...profileInput, unknown: true } },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          { ...profile, profile: { ...profileInput, source: "unknown" } },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...profile,
            profile: { ...profileInput, endpoint: "file:///tmp/provider" },
          },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          { ...profile, profile: { ...profileInput, platformId: 1 } },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          { ...profile, profile: { ...profileInput, name: " " } },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [{ ...profile, modelMappings: [null] }],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          { ...profile, modelMappings: [{ ...mapping, unknown: true }] },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...profile,
            modelMappings: [mapping, { ...mapping, modelId: "duplicate" }],
          },
        ],
        snapshots: [],
      },
      {
        ...validBackup(),
        providerProfiles: [
          {
            ...profile,
            modelMappings: [{ ...mapping, parameters: { apiKey: "secret" } }],
          },
        ],
        snapshots: [],
      },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseAgentManagementBackup(value),
        /AGENT_MANAGEMENT_BACKUP_INVALID/,
      );
    }
  });

  it("rejects malformed snapshots and accepts archived duplicate names", () => {
    const profile = validBackup().providerProfiles[0];
    const snapshot = validBackup().snapshots[0];
    const validArchivedDuplicate = {
      ...validBackup(),
      providerProfiles: [
        profile,
        {
          ...profile,
          id: "profile-archived",
          archived: true,
        },
      ],
      snapshots: [{ ...snapshot, providerProfileId: null }],
    };
    assert.equal(
      parseAgentManagementBackup(validArchivedDuplicate).providerProfiles
        .length,
      2,
    );

    const invalidValues = [
      { ...validBackup(), snapshots: [null] },
      { ...validBackup(), snapshots: [{ ...snapshot, unknown: true }] },
      { ...validBackup(), snapshots: [{ ...snapshot, operation: "delete" }] },
      { ...validBackup(), snapshots: [{ ...snapshot, result: "unknown" }] },
      {
        ...validBackup(),
        snapshots: [{ ...snapshot, providerProfileId: 42 }],
      },
      { ...validBackup(), snapshots: [{ ...snapshot, id: "-invalid" }] },
      {
        ...validBackup(),
        snapshots: [snapshot, { ...snapshot, providerProfileId: null }],
      },
      {
        ...validBackup(),
        snapshots: [{ ...snapshot, redactedSnapshot: { token: "secret" } }],
      },
      { ...validBackup(), snapshots: [{ ...snapshot, createdAt: -1 }] },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseAgentManagementBackup(value),
        /AGENT_MANAGEMENT_BACKUP_INVALID/,
      );
    }
  });

  it("accepts bounded session preferences while keeping legacy bundles valid", () => {
    const legacy = parseAgentManagementBackup(validBackup());
    assert.equal("sessionSourcePreferences" in legacy, false);

    const withPreferences = {
      ...validBackup(),
      sessionSourcePreferences: [
        {
          platformId: "claude",
          adapterId: "claude-jsonl-v1",
          enabled: true,
        },
        {
          platformId: "gemini",
          adapterId: "gemini-json-v1",
          enabled: false,
        },
      ],
    };
    assert.deepEqual(
      parseAgentManagementBackup(withPreferences),
      withPreferences,
    );
    assert.equal(JSON.stringify(withPreferences).includes("/Users/"), false);
  });

  it("rejects malformed, duplicate, oversized, or path-bearing session preferences", () => {
    const preference = {
      platformId: "claude",
      adapterId: "claude-jsonl-v1",
      enabled: true,
    };
    const invalidValues = [
      { ...validBackup(), sessionSourcePreferences: null },
      { ...validBackup(), sessionSourcePreferences: [null] },
      {
        ...validBackup(),
        sessionSourcePreferences: [{ ...preference, enabled: 1 }],
      },
      {
        ...validBackup(),
        sessionSourcePreferences: [
          { ...preference, rootPath: "/Users/source" },
        ],
      },
      {
        ...validBackup(),
        sessionSourcePreferences: [preference, preference],
      },
      {
        ...validBackup(),
        sessionSourcePreferences: Array.from({ length: 129 }, (_, index) => ({
          platformId: `platform-${index}`,
          adapterId: "adapter-v1",
          enabled: true,
        })),
      },
      {
        ...validBackup(),
        sessionSourcePreferences: [
          { ...preference, platformId: "x".repeat(129) },
        ],
      },
      {
        ...validBackup(),
        sessionSourcePreferences: [
          { ...preference, adapterId: "../unsafe-adapter" },
        ],
      },
    ];

    for (const value of invalidValues) {
      assert.throws(
        () => parseAgentManagementBackup(value),
        /AGENT_MANAGEMENT_BACKUP_INVALID/,
      );
    }
  });
});
