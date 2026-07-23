import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentCodexProvider,
  AgentCodexProviderList,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentProviderModelPanel } from "../../../src/renderer/components/agent/AgentProviderModelPanel";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

import de from "../../../src/renderer/i18n/locales/de.json";
import en from "../../../src/renderer/i18n/locales/en.json";
import es from "../../../src/renderer/i18n/locales/es.json";
import fr from "../../../src/renderer/i18n/locales/fr.json";
import ja from "../../../src/renderer/i18n/locales/ja.json";
import zhTW from "../../../src/renderer/i18n/locales/zh-TW.json";
import zh from "../../../src/renderer/i18n/locales/zh.json";

function createAgent(id: string, name: string): ManagedAgentSummary {
  return {
    id,
    name,
    icon: "Terminal",
    isCustom: false,
    isConfigured: true,
    isDetected: true,
    isPinned: false,
    status: "installed",
    paths: {
      root: `~/.${id}`,
      skills: `~/.${id}/skills`,
      configFiles: [`~/.${id}/config.toml`],
      configFileRelativePaths: ["config.toml"],
    },
    capabilities: {
      overview: { status: "supported" },
      provider: { status: "supported" },
      appearance: { status: "supported" },
      assets: { status: "supported" },
      configFiles: { status: "supported" },
      sessions: { status: "supported" },
      usage: { status: "supported" },
      maintenance: { status: "supported" },
    },
  };
}

const codexAgent = createAgent("codex", "Codex");
const claudeAgent = createAgent("claude", "Claude Code");

function createProvider(
  overrides: Partial<AgentCodexProvider> = {},
): AgentCodexProvider {
  return {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    wireApi: "chat",
    envKey: null,
    keySource: "managed",
    hasKey: true,
    isActive: true,
    profileModel: "deepseek-chat",
    ...overrides,
  };
}

const groqProvider = createProvider({
  id: "groq",
  name: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  wireApi: "responses",
  envKey: "GROQ_API_KEY",
  keySource: "env",
  hasKey: false,
  isActive: false,
  profileModel: null,
});

const ollamaProvider = createProvider({
  id: "ollama-local",
  name: "Ollama Local",
  baseUrl: "http://localhost:11434/v1",
  envKey: null,
  keySource: "none",
  hasKey: false,
  isActive: false,
  profileModel: null,
});

function createList(
  providers: AgentCodexProvider[] = [createProvider(), groqProvider],
): AgentCodexProviderList {
  return {
    agentId: "codex",
    activeProvider:
      providers.find((provider) => provider.isActive)?.id ?? "openai",
    defaultModel: "deepseek-chat",
    providers,
  };
}

async function renderPanel(agent: ManagedAgentSummary = codexAgent) {
  const view = await renderWithI18n(<AgentProviderModelPanel agent={agent} />);
  // Wait for the async getModelConfig load to settle before querying.
  await screen.findByRole("navigation", { name: "Providers" });
  return view;
}

function getProviderList() {
  return within(screen.getByRole("navigation", { name: "Providers" }));
}

async function selectProvider(name: string) {
  // List entries include readiness badges in their accessible name, so match
  // the provider name as a substring instead of an exact accessible name.
  fireEvent.click(
    await getProviderList().findByRole("button", {
      name: new RegExp(name),
    }),
  );
}

describe("AgentProviderModelPanel master-detail", () => {
  beforeEach(() => {
    installWindowMocks();
  });

  it("renders the built-in entry and third-party providers in the list for codex", async () => {
    const listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.listProviders = listProviders;

    await renderPanel(codexAgent);

    const list = getProviderList();
    expect(
      await list.findByRole("button", { name: /OpenAI subscription/ }),
    ).toBeVisible();
    expect(list.getByText("Built-in")).toBeVisible();
    expect(
      await list.findByRole("button", { name: /DeepSeek/ }),
    ).toBeVisible();
    expect(list.getByRole("button", { name: /Groq/ })).toBeVisible();
    // The active third-party provider carries the default badge in the list.
    expect(list.getByText("Default")).toBeVisible();
    expect(list.getByText("Key managed by PromptHub")).toBeVisible();
    expect(list.getByText("Env var GROQ_API_KEY")).toBeVisible();
    expect(listProviders).toHaveBeenCalledWith("codex");
  });

  it("does not call listProviders and renders only the built-in entry for non-codex agents", async () => {
    const listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.listProviders = listProviders;

    await renderPanel(claudeAgent);

    const list = getProviderList();
    expect(
      await list.findByRole("button", { name: /Platform default/ }),
    ).toBeVisible();
    expect(list.queryByRole("button", { name: /DeepSeek/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add provider" }),
    ).not.toBeInTheDocument();
    expect(listProviders).not.toHaveBeenCalled();
    // The built-in detail shows the native configuration and model selection.
    expect(await screen.findByText("Model selection")).toBeVisible();
    expect(screen.getByText("Native model configuration")).toBeVisible();
  });

  it("selects the active third-party provider by default and shows its detail", async () => {
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());

    await renderPanel();

    expect(
      await screen.findByText("https://api.deepseek.com/v1"),
    ).toBeVisible();
    expect(screen.getByText("deepseek-chat")).toBeVisible();
    expect(
      screen.getByText(
        "Switch a session to this provider with codex --profile deepseek.",
      ),
    ).toBeVisible();
    // Model selection belongs to the built-in entry, not a third-party detail.
    expect(screen.queryByText("Model selection")).not.toBeInTheDocument();
  });

  it("switches the detail pane when clicking list entries", async () => {
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());

    await renderPanel();
    await screen.findByText("https://api.deepseek.com/v1");

    await selectProvider("Groq");
    expect(
      await screen.findByText("https://api.groq.com/openai/v1"),
    ).toBeVisible();
    expect(screen.getByText("Responses")).toBeVisible();
    // The env-key readiness shows in both the list entry and the detail pane.
    expect(
      screen.getAllByText("Env var GROQ_API_KEY").length,
    ).toBeGreaterThan(0);

    await selectProvider("OpenAI subscription");
    expect(await screen.findByText("Model selection")).toBeVisible();
    expect(screen.getByText("Native model configuration")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Save model" }),
    ).toBeInTheDocument();
  });

  it("shows the no-key readiness state in the detail", async () => {
    window.api.agent.listProviders = vi
      .fn()
      .mockResolvedValue(createList([createProvider(), ollamaProvider]));

    await renderPanel();
    await selectProvider("Ollama Local");

    expect(
      await screen.findByText("http://localhost:11434/v1"),
    ).toBeVisible();
    expect(screen.getAllByText("No key configured").length).toBeGreaterThan(0);
  });

  it("opens the add provider dialog from the list footer", async () => {
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add provider" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Add provider" }),
    ).toBeInTheDocument();
  });

  it("creates a provider with a write-only managed API key", async () => {
    const upsertProvider = vi.fn().mockResolvedValue(createList());
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.upsertProvider = upsertProvider;

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add provider" }),
    );

    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "groq" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Groq" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.groq.com/openai/v1" },
    });
    fireEvent.click(screen.getByLabelText("Responses API"));
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "gsk_secret_123" },
    });
    fireEvent.change(screen.getByLabelText("Profile model (optional)"), {
      target: { value: "llama-3.3-70b" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save provider" }));

    await waitFor(() =>
      expect(upsertProvider).toHaveBeenCalledWith({
        agentId: "codex",
        providerId: "groq",
        name: "Groq",
        baseUrl: "https://api.groq.com/openai/v1",
        wireApi: "responses",
        envKey: null,
        apiKey: "gsk_secret_123",
        profileModel: "llama-3.3-70b",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add provider" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("submits env-key auth without an API key", async () => {
    const upsertProvider = vi.fn().mockResolvedValue(createList());
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.upsertProvider = upsertProvider;

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add provider" }),
    );

    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "groq" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Groq" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.groq.com/openai/v1" },
    });
    fireEvent.click(screen.getByLabelText("Environment variable reference"));
    fireEvent.change(screen.getByLabelText("Environment variable"), {
      target: { value: "GROQ_API_KEY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save provider" }));

    await waitFor(() => expect(upsertProvider).toHaveBeenCalledTimes(1));
    const input = upsertProvider.mock.calls[0][0] as Record<string, unknown>;
    expect(input).toMatchObject({
      agentId: "codex",
      providerId: "groq",
      name: "Groq",
      wireApi: "chat",
      envKey: "GROQ_API_KEY",
      profileModel: null,
    });
    expect(input).not.toHaveProperty("apiKey");
  });

  it("blocks submission and shows validation errors when required fields are missing", async () => {
    const upsertProvider = vi.fn();
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.upsertProvider = upsertProvider;

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add provider" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save provider" }));

    expect(await screen.findByText("Provider ID is required.")).toBeVisible();
    expect(screen.getByText("Name is required.")).toBeVisible();
    expect(screen.getByText("Base URL is required.")).toBeVisible();
    expect(
      screen.getByText(
        "Enter an API key or switch to an environment variable.",
      ),
    ).toBeVisible();
    expect(upsertProvider).not.toHaveBeenCalled();
  });

  it("shows IPC errors inside the dialog when saving fails", async () => {
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.upsertProvider = vi
      .fn()
      .mockRejectedValue(new Error("provider id already exists"));

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Add provider" }),
    );
    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "deepseek" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Duplicate" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://api.deepseek.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save provider" }));

    expect(await screen.findByText("provider id already exists")).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Add provider" }),
    ).toBeInTheDocument();
  });

  it("edits the selected provider without resending the key when the key field is left empty", async () => {
    const upsertProvider = vi.fn().mockResolvedValue(createList());
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.upsertProvider = upsertProvider;

    await renderPanel();
    // DeepSeek is the active provider and selected by default.
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit DeepSeek" }),
    );

    const idInput = screen.getByLabelText("Provider ID");
    expect(idInput).toBeDisabled();
    expect(idInput).toHaveValue("deepseek");
    expect(screen.getByLabelText("API key")).toHaveAttribute(
      "placeholder",
      "Leave empty to keep the current key",
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "DeepSeek V3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save provider" }));

    await waitFor(() => expect(upsertProvider).toHaveBeenCalledTimes(1));
    const input = upsertProvider.mock.calls[0][0] as Record<string, unknown>;
    expect(input).toMatchObject({
      agentId: "codex",
      providerId: "deepseek",
      name: "DeepSeek V3",
      baseUrl: "https://api.deepseek.com/v1",
      wireApi: "chat",
      envKey: null,
      profileModel: "deepseek-chat",
    });
    expect(input).not.toHaveProperty("apiKey");
  });

  it("deletes the selected provider after confirmation", async () => {
    const removeProvider = vi
      .fn()
      .mockResolvedValue(createList([createProvider()]));
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.removeProvider = removeProvider;

    await renderPanel();
    await selectProvider("Groq");
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Groq" }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete provider",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(removeProvider).toHaveBeenCalledWith("codex", "groq"),
    );
    await waitFor(() =>
      expect(
        getProviderList().queryByRole("button", { name: /Groq/ }),
      ).toBeNull(),
    );
  });

  it("shows the switch-default guidance when deleting the active provider fails", async () => {
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.removeProvider = vi
      .fn()
      .mockRejectedValue(
        new Error("active-provider: cannot remove the active provider"),
      );

    await renderPanel();
    // DeepSeek is the active provider and selected by default.
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete DeepSeek" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete provider",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText(
        "This provider is the current default. Set another provider or OpenAI as the default first.",
      ),
    ).toBeVisible();
  });

  it("sets the selected provider as default", async () => {
    const setDefaultProvider = vi.fn().mockResolvedValue(
      createList([
        createProvider({ isActive: false }),
        createProvider({
          id: "groq",
          name: "Groq",
          keySource: "env",
          envKey: "GROQ_API_KEY",
          hasKey: false,
          isActive: true,
          profileModel: null,
        }),
      ]),
    );
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.setDefaultProvider = setDefaultProvider;

    await renderPanel();
    await selectProvider("Groq");
    fireEvent.click(
      await screen.findByRole("button", { name: "Set Groq as default" }),
    );

    await waitFor(() =>
      expect(setDefaultProvider).toHaveBeenCalledWith("codex", "groq"),
    );
  });

  it("restores the OpenAI default from the active provider detail", async () => {
    const setDefaultProvider = vi
      .fn()
      .mockResolvedValue(
        createList([createProvider({ isActive: false }), groqProvider]),
      );
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.setDefaultProvider = setDefaultProvider;

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Restore OpenAI default" }),
    );

    await waitFor(() =>
      expect(setDefaultProvider).toHaveBeenCalledWith("codex", "openai"),
    );
  });

  it("shows model count and latency when the connectivity test succeeds", async () => {
    window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
    window.api.agent.testProvider = vi.fn().mockResolvedValue({
      status: "ok",
      latencyMs: 123,
      modelCount: 42,
    });

    await renderPanel();
    fireEvent.click(
      await screen.findByRole("button", { name: "Test DeepSeek" }),
    );

    expect(await screen.findByText("42 models · 123ms")).toBeVisible();
    expect(window.api.agent.testProvider).toHaveBeenCalledWith(
      "codex",
      "deepseek",
    );
  });

  it.each([
    ["auth-error", "Authentication failed — check the API key."],
    ["network-error", "Network error — the endpoint is unreachable."],
    ["timeout", "Request timed out."],
    ["http-error", "The endpoint returned an HTTP error."],
    ["invalid-url", "The base URL is invalid."],
    ["no-credentials", "No credentials configured for this provider."],
  ] as const)(
    "shows the %s category when the connectivity test fails",
    async (status, message) => {
      window.api.agent.listProviders = vi.fn().mockResolvedValue(createList());
      window.api.agent.testProvider = vi.fn().mockResolvedValue({
        status,
        latencyMs: null,
        modelCount: null,
      });

      await renderPanel();
      fireEvent.click(
        await screen.findByRole("button", { name: "Test DeepSeek" }),
      );

      expect(await screen.findByText(message)).toBeVisible();
    },
  );
});

describe("agents.providers i18n", () => {
  function flattenKeys(source: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(source).flatMap(([key, value]) => {
      const next = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return flattenKeys(value as Record<string, unknown>, next);
      }
      return [next];
    });
  }

  it.each(["providers", "providerDetail"] as const)(
    "keeps agents.%s keys aligned across all seven locales",
    (section) => {
      const expected = flattenKeys(
        (en.agents as Record<string, unknown>)[section] as Record<
          string,
          unknown
        >,
      );
      const locales = { zh, "zh-TW": zhTW, ja, fr, de, es } as const;
      for (const [locale, messages] of Object.entries(locales)) {
        const actual = new Set(
          flattenKeys(
            (messages.agents as Record<string, unknown>)[section] as Record<
              string,
              unknown
            >,
          ),
        );
        for (const key of expected) {
          expect(
            actual.has(key),
            `${locale} missing agents.${section}.${key}`,
          ).toBe(true);
        }
        expect(
          actual.size,
          `${locale} has extra agents.${section} keys`,
        ).toBe(expected.length);
      }
    },
  );
});
