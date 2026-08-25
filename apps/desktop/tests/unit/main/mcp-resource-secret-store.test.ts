/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCanonicalMcpResourceSecretStore,
  createMcpResourceSecretStore,
} from "../../../src/main/services/mcp-resource-secret-store";

describe("MCP canonical resource secret store", () => {
  const roots: string[] = [];
  const encryption = {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`cipher:${value}`, "utf8"),
    decryptString: (value: Buffer) =>
      value.toString("utf8").replace(/^cipher:/, ""),
  };

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture() {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-mcp-secrets-"),
    );
    roots.push(root);
    const filePath = path.join(root, "secrets", "mcp-resource-secrets.json");
    return {
      filePath,
      store: createMcpResourceSecretStore({ filePath, encryption }),
    };
  }

  it("atomically upserts extracted secrets without persisting plaintext", async () => {
    const { filePath, store } = fixture();
    await store.writeMany([
      {
        ref: "mcp.server.v000001.env.token",
        field: "env",
        key: "TOKEN",
        value: "secret-a",
        version: 1,
      },
      {
        ref: "mcp.server.v000001.headers.auth",
        field: "headers",
        key: "Authorization",
        value: "secret-b",
        version: 1,
      },
    ]);

    const raw = fs.readFileSync(filePath, "utf8");
    expect(raw).not.toContain("secret-a");
    expect(raw).not.toContain("secret-b");
    expect(await store.read("mcp.server.v000001.env.token")).toBe("secret-a");
    expect(await store.read("mcp.server.v000001.headers.auth")).toBe(
      "secret-b",
    );
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it("fails before publication when device encryption is unavailable", async () => {
    const { filePath } = fixture();
    const store = createMcpResourceSecretStore({
      filePath,
      encryption: {
        ...encryption,
        isEncryptionAvailable: () => false,
      },
    });

    await expect(
      store.writeMany([
        {
          ref: "mcp.server.v000001.env.token",
          field: "env",
          key: "TOKEN",
          value: "secret",
          version: 1,
        },
      ]),
    ).rejects.toThrow("MCP_RESOURCE_SECRET_STORE_UNAVAILABLE");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("allows an empty canonical update when no secret needs encryption", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-mcp-secrets-"),
    );
    roots.push(root);
    const filePath = path.join(root, "secrets", "mcp-resource-secrets.json");
    const stagePath = path.join(root, "secrets", ".stage.json");
    const store = createCanonicalMcpResourceSecretStore({
      filePath,
      encryption: {
        ...encryption,
        isEncryptionAvailable: () => false,
      },
    });

    expect(() =>
      store.prepareUpdate(stagePath, {
        secrets: [],
        retainRefs: new Set(),
      }),
    ).not.toThrow();
    expect(JSON.parse(fs.readFileSync(stagePath, "utf8"))).toEqual({
      kind: "prompthub-mcp-resource-secret-store",
      version: 1,
      secrets: {},
    });
  });

  it("rejects conflicting values for one immutable secret reference", async () => {
    const { filePath, store } = fixture();
    await store.writeMany([
      {
        ref: "mcp.server.v000001.env.token",
        field: "env",
        key: "TOKEN",
        value: "secret-a",
        version: 1,
      },
    ]);

    await expect(
      store.writeMany([
        {
          ref: "mcp.server.v000001.env.token",
          field: "env",
          key: "TOKEN",
          value: "secret-b",
          version: 1,
        },
      ]),
    ).rejects.toThrow("MCP_RESOURCE_SECRET_STORE_CONFLICT");
    expect(await store.read("mcp.server.v000001.env.token")).toBe("secret-a");
    expect(fs.readFileSync(filePath, "utf8")).not.toContain("secret-b");
  });

  it("prepares a filtered encrypted replacement for the canonical transaction", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-mcp-secrets-"),
    );
    roots.push(root);
    const filePath = path.join(root, "secrets", "mcp-resource-secrets.json");
    const stagePath = path.join(root, "secrets", ".stage.json");
    const store = createCanonicalMcpResourceSecretStore({
      filePath,
      encryption,
    });
    store.prepareUpdate(stagePath, {
      retainRefs: new Set(["keep"]),
      secrets: [
        {
          ref: "keep",
          field: "env",
          key: "TOKEN",
          value: "secret-a",
          version: 1,
        },
      ],
    });
    fs.renameSync(stagePath, filePath);

    const secondStage = path.join(root, "secrets", ".stage-2.json");
    store.prepareUpdate(secondStage, {
      retainRefs: new Set(["new"]),
      secrets: [
        {
          ref: "new",
          field: "headers",
          key: "Authorization",
          value: "secret-b",
          version: 2,
        },
      ],
    });
    fs.renameSync(secondStage, filePath);

    expect(store.read("keep")).toBeNull();
    expect(store.read("new")).toBe("secret-b");
    expect(fs.readFileSync(filePath, "utf8")).not.toContain("secret-b");
  });
});
