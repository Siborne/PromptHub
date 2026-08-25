import {
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "@prompthub/core";
import {
  closePromptHub,
  launchPromptHub,
  sendAppCommand,
  setAppSettings,
} from "./helpers/electron";

const SERVER_NAME = "agent-mcp-lifecycle";
const DISPLAY_NAME = "Agent MCP Lifecycle";
const UPDATED_DISPLAY_NAME = "Agent MCP Lifecycle Updated";

async function openMcpLibrary(app: ElectronApplication, page: Page) {
  await sendAppCommand(app, { type: "asset:create", asset: "mcp" });
  const dialog = page.getByRole("dialog", { name: "New MCP" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible();
}

test("creates, reads, updates, restarts, and deletes a non-secret MCP server", async () => {
  test.setTimeout(90_000);

  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-agent-mcp-e2e-"),
  );
  writeRuntimeLayoutState(userDataDir);
  writeCanonicalStorageAuthority(userDataDir, {
    consistencyId: "b".repeat(64),
    operationId: "agent-mcp-lifecycle-e2e",
  });
  const homeDir = path.join(userDataDir, "home");
  const emptyBinDir = path.join(homeDir, "empty-bin");
  fs.mkdirSync(emptyBinDir, { recursive: true });

  const launchOptions = {
    userDataDir,
    env: { HOME: homeDir, PATH: emptyBinDir, USERPROFILE: homeDir },
  };
  let activeApp: ElectronApplication | null = null;

  try {
    let launched = await launchPromptHub(null, launchOptions);
    activeApp = launched.app;
    let { page } = launched;
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAppSettings(page, {
      language: "en",
      minimizeOnLaunch: false,
      autoCheckUpdate: false,
    });

    await sendAppCommand(activeApp, { type: "asset:create", asset: "mcp" });
    const createDialog = page.getByRole("dialog", { name: "New MCP" });
    await createDialog.getByRole("button", { name: /Manual setup/ }).click();
    await createDialog.getByLabel("Name", { exact: true }).fill(SERVER_NAME);
    await createDialog.getByLabel("Display Name").fill(DISPLAY_NAME);
    await createDialog.getByLabel("Command").fill("node");
    await createDialog.getByLabel("Args").fill("server.js\n--alpha");
    await createDialog.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText("MCP saved", { exact: true }).last(),
    ).toBeVisible();
    await expect(createDialog).not.toBeVisible();

    let library = await page.evaluate(() => window.api.mcp.getLibrary());
    expect(library.servers).toHaveLength(1);
    const serverId = library.servers[0].id;
    expect(library.servers[0]).toMatchObject({
      id: serverId,
      name: SERVER_NAME,
      displayName: DISPLAY_NAME,
      command: "node",
      args: ["server.js", "--alpha"],
      env: {},
      envRefs: {},
    });

    const bundlePath = path.join(userDataDir, "data", "mcp", serverId);
    expect(fs.existsSync(path.join(bundlePath, "server.json"))).toBe(true);
    expect(fs.existsSync(path.join(bundlePath, "manifest.json"))).toBe(true);

    await page.getByTestId(`mcp-server-card-${serverId}`).click();
    await page.getByRole("button", { name: "Edit MCP" }).click();
    const editor = page.getByTestId("mcp-server-form");
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(
      SERVER_NAME,
    );
    await expect(editor.getByLabel("Display Name")).toHaveValue(DISPLAY_NAME);
    await expect(editor.getByLabel("Command")).toHaveValue("node");
    await expect(editor.getByLabel("Args")).toHaveValue("server.js\n--alpha");

    await editor.getByLabel("Display Name").fill(UPDATED_DISPLAY_NAME);
    await editor.getByLabel("Args").fill("server.js\n--beta");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(async () => {
        const current = await page.evaluate(() => window.api.mcp.getLibrary());
        return current.servers[0]?.displayName;
      })
      .toBe(UPDATED_DISPLAY_NAME);

    library = await page.evaluate(() => window.api.mcp.getLibrary());
    expect(library.servers[0]).toMatchObject({
      id: serverId,
      name: SERVER_NAME,
      displayName: UPDATED_DISPLAY_NAME,
      args: ["server.js", "--beta"],
    });

    await closePromptHub(activeApp, userDataDir, {
      preserveUserDataDir: true,
    });
    activeApp = null;

    launched = await launchPromptHub(null, launchOptions);
    activeApp = launched.app;
    page = launched.page;
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMcpLibrary(activeApp, page);

    library = await page.evaluate(() => window.api.mcp.getLibrary());
    expect(library.servers).toHaveLength(1);
    expect(library.servers[0]).toMatchObject({
      id: serverId,
      displayName: UPDATED_DISPLAY_NAME,
      args: ["server.js", "--beta"],
    });
    await page.getByTestId(`mcp-server-card-${serverId}`).click();
    await page.getByRole("button", { name: "Delete" }).click();
    const deleteDialog = page.getByRole("alertdialog", { name: "Delete MCP" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByText("MCP deleted", { exact: true }).last(),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const current = await page.evaluate(() => window.api.mcp.getLibrary());
        return current.servers.length;
      })
      .toBe(0);
    expect(fs.existsSync(bundlePath)).toBe(false);

    await closePromptHub(activeApp, userDataDir, {
      preserveUserDataDir: true,
    });
    activeApp = null;
    launched = await launchPromptHub(null, launchOptions);
    activeApp = launched.app;
    page = launched.page;
    await expect
      .poll(async () => {
        const current = await page.evaluate(() => window.api.mcp.getLibrary());
        return current.servers.length;
      })
      .toBe(0);
    expect(fs.existsSync(bundlePath)).toBe(false);
  } finally {
    if (activeApp) await closePromptHub(activeApp, userDataDir);
    else if (fs.existsSync(userDataDir))
      fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
