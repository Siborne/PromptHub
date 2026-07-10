import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initMobileDatabase: vi.fn(),
  openDatabaseAsync: vi.fn(),
}));

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: mocks.openDatabaseAsync,
}));

vi.mock("./mobileSchema", () => ({
  initMobileDatabase: mocks.initMobileDatabase,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.initMobileDatabase.mockReset();
  mocks.openDatabaseAsync.mockReset();
});

describe("mobile database opening", () => {
  it("opens and initializes one shared asynchronous database", async () => {
    const database = {
      execAsync: vi.fn().mockResolvedValue(undefined),
      getFirstAsync: vi.fn().mockResolvedValue({ user_version: 1 }),
    };
    mocks.openDatabaseAsync.mockResolvedValue(database);
    mocks.initMobileDatabase.mockImplementation(async (adapter) => {
      await adapter.exec("BEGIN");
      await adapter.getFirst("PRAGMA user_version");
    });
    const { getDatabase, initDatabase } = await import("./database");

    const [first, second] = await Promise.all([getDatabase(), getDatabase()]);
    await initDatabase();

    expect(first).toBe(database);
    expect(second).toBe(database);
    expect(mocks.openDatabaseAsync).toHaveBeenCalledOnce();
    expect(database.execAsync).toHaveBeenCalledWith("BEGIN");
    expect(database.getFirstAsync).toHaveBeenCalledWith("PRAGMA user_version");
  });

  it("allows a retry after database opening fails", async () => {
    const database = {
      execAsync: vi.fn(),
      getFirstAsync: vi.fn(),
    };
    mocks.openDatabaseAsync
      .mockRejectedValueOnce(new Error("worker unavailable"))
      .mockResolvedValueOnce(database);
    const { getDatabase } = await import("./database");

    await expect(getDatabase()).rejects.toThrow("worker unavailable");
    await expect(getDatabase()).resolves.toBe(database);

    expect(mocks.openDatabaseAsync).toHaveBeenCalledTimes(2);
    expect(mocks.initMobileDatabase).toHaveBeenCalledOnce();
  });
});
