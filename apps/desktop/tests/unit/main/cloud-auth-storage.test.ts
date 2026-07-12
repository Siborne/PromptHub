import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createCloudCredentialStore,
  type CloudStorageEncryption,
} from "../../../src/main/services/cloud-auth-storage";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

function createEncryption(
  available = true,
): CloudStorageEncryption {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
    decryptString: (value) =>
      Buffer.from(value).toString("utf8").replace(/^encrypted:/, ""),
  };
}

async function createStore(encryption = createEncryption()) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-cloud-"));
  temporaryDirectories.push(directory);
  return {
    directory,
    store: createCloudCredentialStore({
      userDataPath: directory,
      encryption,
    }),
  };
}

describe("cloud credential storage", () => {
  it("round-trips encrypted credentials without writing the token as plaintext", async () => {
    const { directory, store } = await createStore();

    await store.write({
      baseUrl: "https://api.prompthub.cloud",
      token: "desktop-session-token",
    });

    const raw = await fs.readFile(
      path.join(directory, "cloud-auth.json"),
      "utf8",
    );
    expect(raw).not.toContain("desktop-session-token");
    await expect(store.read()).resolves.toEqual({
      baseUrl: "https://api.prompthub.cloud",
      token: "desktop-session-token",
    });

    await store.clear();
    await expect(store.read()).resolves.toBeNull();
  });

  it("refuses to persist credentials when OS secure storage is unavailable", async () => {
    const { store } = await createStore(createEncryption(false));

    await expect(
      store.write({ baseUrl: "https://api.prompthub.cloud", token: "token" }),
    ).rejects.toThrow("CLOUD_AUTH_SECURE_STORAGE_UNAVAILABLE");
  });
});
