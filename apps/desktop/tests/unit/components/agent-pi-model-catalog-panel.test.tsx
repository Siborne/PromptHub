import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentModelCatalogProvider,
  AgentModelConfiguration,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentPiModelCatalogPanel } from "../../../src/renderer/components/agent/AgentPiModelCatalogPanel";
import de from "../../../src/renderer/i18n/locales/de.json";
import en from "../../../src/renderer/i18n/locales/en.json";
import es from "../../../src/renderer/i18n/locales/es.json";
import fr from "../../../src/renderer/i18n/locales/fr.json";
import ja from "../../../src/renderer/i18n/locales/ja.json";
import zhTw from "../../../src/renderer/i18n/locales/zh-TW.json";
import zh from "../../../src/renderer/i18n/locales/zh.json";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

function piAgent(): ManagedAgentSummary {
  return {
    id: "pi",
    name: "Pi",
    icon: "Pi",
    isCustom: false,
    isConfigured: true,
    isDetected: true,
    isPinned: false,
    status: "installed",
    paths: {
      root: "~/.pi/agent",
      skills: "~/.pi/agent/skills",
      configFiles: ["~/.pi/agent/settings.json"],
      configFileRelativePaths: ["settings.json"],
    },
    capabilities: {
      overview: { status: "supported" },
      provider: { status: "partial" },
      appearance: { status: "planned" },
      assets: { status: "supported" },
      configFiles: { status: "supported" },
      sessions: { status: "supported" },
      usage: { status: "planned" },
      maintenance: { status: "supported" },
    },
  } as ManagedAgentSummary;
}

function catalogProvider(
  overrides: Partial<AgentModelCatalogProvider> = {},
): AgentModelCatalogProvider {
  return {
    id: "kimi-coding",
    models: [
      {
        id: "k3",
        name: "K3",
        reasoning: true,
        contextWindow: 262144,
        source: "built-in",
      },
    ],
    credentialReady: true,
    source: "built-in",
    endpoint: "https://api.kimi.com/coding/v1",
    ...overrides,
  };
}

function modelConfig(
  overrides: Partial<AgentModelConfiguration> = {},
): AgentModelConfiguration {
  return {
    agentId: "pi",
    adapter: "pi-settings-v1",
    status: "configured",
    model: "k3",
    secondaryModel: null,
    fallbackModels: [],
    provider: "kimi-coding",
    endpoint: null,
    availableModels: ["k3"],
    credentialStatus: "platform-managed",
    sourceRelativePath: "settings.json",
    canSetModel: true,
    formattingMayChange: false,
    modelCatalog: [catalogProvider()],
    ...overrides,
  };
}

async function renderPanel() {
  await renderWithI18n(<AgentPiModelCatalogPanel agent={piAgent()} />, {
    settleAsyncEffects: true,
  });
  await screen.findByRole("navigation", { name: "Pi providers" });
}

describe("AgentPiModelCatalogPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(Object.entries({ de, en, es, fr, ja, "zh-TW": zhTw, zh }))(
    "defines every Pi workbench label in %s",
    (_locale, messages) => {
      const labels = messages.agents.piModels;
      expect(labels).toMatchObject({
        thinkingLevel: expect.any(String),
        platformDefault: expect.any(String),
        apiType: expect.any(String),
        endpointLabel: expect.any(String),
        configurationSource: expect.any(String),
        credentialLabel: expect.any(String),
        maxTokens: expect.any(String),
        sourceBuiltIn: expect.any(String),
        sourceCustom: expect.any(String),
        modelsSection: expect.any(String),
        editModel: expect.any(String),
        form: expect.objectContaining({
          editProviderTitle: expect.any(String),
          editModelTitle: expect.any(String),
          maxTokens: expect.any(String),
          reasoning: expect.any(String),
        }),
        credentialSources: {
          auth: expect.any(String),
          environment: expect.any(String),
          "provider-config": expect.any(String),
          missing: expect.any(String),
        },
      });
    },
  );

  it("lists every provider on the left with default and credential state", async () => {
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider(),
                catalogProvider({
                  id: "deepseek",
                  credentialReady: false,
                  models: [{ id: "deepseek-v4-flash", source: "built-in" }],
                }),
              ],
            }),
          ),
        },
      },
    });

    await renderPanel();

    const nav = screen.getByRole("navigation", { name: "Pi providers" });
    expect(within(nav).getByText("kimi-coding")).toBeVisible();
    expect(within(nav).getByText("deepseek")).toBeVisible();
    expect(screen.getAllByText("1 models").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Credential configured")).toBeInTheDocument();
    expect(screen.getByLabelText("Missing credential")).toBeInTheDocument();
  });

  it("shows the selected provider's models and sets the default", async () => {
    const setModelConfig = vi.fn().mockResolvedValue(modelConfig());
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider({
                  models: [
                    { id: "k3", source: "built-in" },
                    { id: "kimi-for-coding", source: "built-in" },
                  ],
                }),
              ],
            }),
          ),
          setModelConfig,
        },
      },
    });

    await renderPanel();

    expect(screen.getByText("k3")).toBeVisible();
    expect(screen.getByText("kimi-for-coding")).toBeVisible();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Set as default" })[0],
    );
    await waitFor(() =>
      expect(setModelConfig).toHaveBeenCalledWith({
        agentId: "pi",
        model: "kimi-coding/kimi-for-coding",
      }),
    );
  });

  it("edits a custom provider endpoint and protocol", async () => {
    const updatePiProvider = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              provider: "foxcode",
              model: "gpt-old",
              modelCatalog: [
                catalogProvider({
                  id: "foxcode",
                  source: "custom",
                  api: "openai-completions",
                  endpoint: "https://old.example/v1",
                  models: [{ id: "gpt-old", source: "custom" }],
                }),
              ],
            }),
          ),
          updatePiProvider,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit custom provider" });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://new.example/v1" },
    });
    fireEvent.change(screen.getByLabelText("API type"), {
      target: { value: "openai-responses" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updatePiProvider).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "foxcode",
        baseUrl: "https://new.example/v1",
        api: "openai-responses",
      }),
    );
  });

  it("edits a custom model context window, output tokens, and reasoning", async () => {
    const updatePiModel = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              provider: "foxcode",
              model: "gpt-old",
              modelCatalog: [
                catalogProvider({
                  id: "foxcode",
                  source: "custom",
                  models: [
                    {
                      id: "gpt-old",
                      name: "Old",
                      contextWindow: 128000,
                      source: "custom",
                    },
                  ],
                }),
              ],
            }),
          ),
          updatePiModel,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Edit model" }));
    await screen.findByRole("dialog", { name: "Edit custom model" });
    fireEvent.change(screen.getByLabelText("Context window (optional)"), {
      target: { value: "400000" },
    });
    fireEvent.change(screen.getByLabelText("Max output tokens (optional)"), {
      target: { value: "128000" },
    });
    fireEvent.click(screen.getByLabelText("Reasoning model"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updatePiModel).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "foxcode",
        model: {
          originalId: "gpt-old",
          id: "gpt-old",
          name: "Old",
          contextWindow: 400000,
          maxTokens: 128000,
          reasoning: true,
        },
      }),
    );
  });

  it("adds a custom provider with a managed credential", async () => {
    const addPiProvider = vi.fn().mockResolvedValue({ backupPath: null });
    const setPiCredential = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi
            .fn()
            .mockResolvedValue(
              modelConfig({ modelCatalog: [catalogProvider()] }),
            ),
          addPiProvider,
          setPiCredential,
        },
      },
    });

    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Add custom provider",
    });
    expect(dialog).toBeVisible();

    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "ollama" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "http://localhost:11434/v1" },
    });
    fireEvent.change(screen.getByLabelText("First model ID"), {
      target: { value: "llama3.1:8b" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(addPiProvider).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "ollama",
        baseUrl: "http://localhost:11434/v1",
        api: "openai-completions",
        models: [{ id: "llama3.1:8b" }],
        credential: { mode: "managed", secret: "sk-test" },
      }),
    );
    expect(setPiCredential).toHaveBeenCalledWith({
      agentId: "pi",
      providerId: "ollama",
      secret: "sk-test",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add custom provider" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("supports environment-variable credential mode without a secret", async () => {
    const addPiProvider = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(modelConfig()),
          addPiProvider,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    await screen.findByRole("dialog", { name: "Add custom provider" });

    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "my-google" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://generativelanguage.googleapis.com/v1beta" },
    });
    fireEvent.change(screen.getByLabelText("First model ID"), {
      target: { value: "gemma-4-31b-it" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Environment variable" }),
    );
    fireEvent.change(screen.getByLabelText("Environment variable name"), {
      target: { value: "GEMINI_API_KEY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(addPiProvider).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "my-google",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        api: "openai-completions",
        apiKeyRef: "$GEMINI_API_KEY",
        models: [{ id: "gemma-4-31b-it" }],
      }),
    );
  });

  it("blocks submission until required fields are valid", async () => {
    const addPiProvider = vi.fn();
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(modelConfig()),
          addPiProvider,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    await screen.findByRole("dialog", { name: "Add custom provider" });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findAllByText("Required")).not.toHaveLength(0);
    expect(addPiProvider).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Add custom provider" }),
    ).toBeVisible();
  });

  it("removes a custom model after confirmation", async () => {
    const removePiModel = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider({
                  source: "custom",
                  models: [{ id: "llama3.1:8b", source: "custom" }],
                }),
              ],
              provider: "other",
              model: "other-model",
            }),
          ),
          removePiModel,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Remove model" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("llama3.1:8b");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(removePiModel).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "kimi-coding",
        modelId: "llama3.1:8b",
      }),
    );
  });

  it("shows a bounded error banner when loading fails", async () => {
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi
            .fn()
            .mockRejectedValue(new Error("AGENT_PI_MODELS_LOAD_FAILED")),
        },
      },
    });

    await renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Operation failed",
    );
  });

  it("adds a model with optional fields to the selected provider", async () => {
    const addPiModel = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(modelConfig()),
          addPiModel,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    const dialog = await screen.findByRole("dialog", { name: "Add model" });
    expect(dialog).toBeVisible();

    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "qwen2.5-coder:7b" },
    });
    fireEvent.change(screen.getByLabelText("Display name (optional)"), {
      target: { value: "Qwen Coder" },
    });
    fireEvent.change(screen.getByLabelText("Context window (optional)"), {
      target: { value: "128000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(addPiModel).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "kimi-coding",
        model: {
          id: "qwen2.5-coder:7b",
          name: "Qwen Coder",
          contextWindow: 128000,
        },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add model" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("validates the add-model form and supports cancel", async () => {
    const addPiModel = vi.fn();
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(modelConfig()),
          addPiModel,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    await screen.findByRole("dialog", { name: "Add model" });

    fireEvent.change(screen.getByLabelText("Context window (optional)"), {
      target: { value: "-5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Required")).toBeVisible();
    expect(await screen.findByText("Enter a positive integer")).toBeVisible();
    expect(addPiModel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add model" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("sets a credential from the provider header when missing", async () => {
    const setPiCredential = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [catalogProvider({ credentialReady: false })],
            }),
          ),
          setPiCredential,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Set credential" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Set provider credential",
    });
    expect(dialog).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Save credential" }));
    expect(await screen.findByText("Required")).toBeVisible();
    expect(setPiCredential).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-new-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save credential" }));
    await waitFor(() =>
      expect(setPiCredential).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "kimi-coding",
        secret: "sk-new-key",
      }),
    );
  });

  it("removes a custom provider after confirmation", async () => {
    const removePiProvider = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [catalogProvider({ source: "custom" })],
            }),
          ),
          removePiProvider,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Remove provider" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("kimi-coding");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(removePiProvider).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "kimi-coding",
      }),
    );
  });

  it("surfaces a bounded error when a mutation fails", async () => {
    const setModelConfig = vi
      .fn()
      .mockRejectedValue(new Error("AGENT_PI_MODEL_ID_INVALID"));
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider({
                  models: [
                    { id: "k3", source: "built-in" },
                    { id: "other-model", source: "built-in" },
                  ],
                }),
              ],
            }),
          ),
          setModelConfig,
        },
      },
    });

    await renderPanel();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Set as default" })[0],
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Operation failed",
    );
  });

  it("renders small context windows and the empty provider state", async () => {
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider({
                  models: [
                    { id: "tiny", contextWindow: 512, source: "built-in" },
                  ],
                }),
                catalogProvider({ id: "empty-provider", models: [] }),
              ],
            }),
          ),
        },
      },
    });

    await renderPanel();
    expect(screen.getByText("512 context")).toBeVisible();

    fireEvent.click(screen.getByText("empty-provider"));
    expect(
      await screen.findByText(
        "No models yet. Add one to make this provider usable.",
      ),
    ).toBeVisible();
  });

  it("falls back to a generic error code for non-agent failures", async () => {
    const setModelConfig = vi.fn().mockRejectedValue(new Error("boom"));
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider({
                  models: [
                    { id: "k3", source: "built-in" },
                    { id: "other-model", source: "built-in" },
                  ],
                }),
              ],
            }),
          ),
          setModelConfig,
        },
      },
    });

    await renderPanel();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Set as default" })[0],
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Operation failed",
    );
  });

  it("rejects an invalid environment variable name in env mode", async () => {
    const addPiProvider = vi.fn();
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(modelConfig()),
          addPiProvider,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    await screen.findByRole("dialog", { name: "Add custom provider" });
    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "env-provider" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "http://localhost:1/v1" },
    });
    fireEvent.change(screen.getByLabelText("First model ID"), {
      target: { value: "m" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Environment variable" }),
    );
    fireEvent.change(screen.getByLabelText("Environment variable name"), {
      target: { value: "1BAD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(
      await screen.findByText("Invalid environment variable name"),
    ).toBeVisible();
    expect(addPiProvider).not.toHaveBeenCalled();
  });

  it("adds a model without optional name and context fields", async () => {
    const addPiModel = vi.fn().mockResolvedValue({ backupPath: null });
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(modelConfig()),
          addPiModel,
        },
      },
    });

    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    await screen.findByRole("dialog", { name: "Add model" });
    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "plain-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(addPiModel).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "kimi-coding",
        model: { id: "plain-model" },
      }),
    );
  });

  it("covers remaining branches: api select, modal close, non-Error failure, null endpoint, M context", async () => {
    const addPiProvider = vi.fn().mockResolvedValue({ backupPath: null });
    const setModelConfig = vi.fn().mockRejectedValue("string-failure");
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [
                catalogProvider({
                  endpoint: null,
                  models: [
                    { id: "k3", source: "built-in" },
                    {
                      id: "huge",
                      contextWindow: 1_048_576,
                      source: "built-in",
                    },
                    { id: "other-model", source: "built-in" },
                  ],
                }),
              ],
            }),
          ),
          addPiProvider,
          setModelConfig,
        },
      },
    });

    await renderPanel();
    expect(screen.getByText("Platform default endpoint")).toBeVisible();
    expect(screen.getByText("1.0M context")).toBeVisible();

    // Non-Error rejection still shows the bounded banner.
    fireEvent.click(
      screen.getAllByRole("button", { name: "Set as default" })[0],
    );
    expect(await screen.findByRole("alert")).toBeVisible();

    // API select drives the request payload.
    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    await screen.findByRole("dialog", { name: "Add custom provider" });
    fireEvent.change(screen.getByLabelText("API type"), {
      target: { value: "anthropic-messages" },
    });
    fireEvent.change(screen.getByLabelText("Provider ID"), {
      target: { value: "claude-local" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "http://localhost:8080/v1" },
    });
    fireEvent.change(screen.getByLabelText("First model ID"), {
      target: { value: "claude-custom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(addPiProvider).toHaveBeenCalledWith({
        agentId: "pi",
        providerId: "claude-local",
        baseUrl: "http://localhost:8080/v1",
        api: "anthropic-messages",
        models: [{ id: "claude-custom" }],
      }),
    );

    // Modal close button closes without side effects.
    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Add custom provider",
    });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add custom provider" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes add-model and credential dialogs without side effects", async () => {
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              modelCatalog: [catalogProvider({ credentialReady: false })],
            }),
          ),
        },
      },
    });

    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    const addModelDialog = await screen.findByRole("dialog", {
      name: "Add model",
    });
    fireEvent.keyDown(addModelDialog, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add model" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Set credential" }));
    const credentialDialog = await screen.findByRole("dialog", {
      name: "Set provider credential",
    });
    fireEvent.keyDown(credentialDialog, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Set provider credential" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders an unconfigured model state without a current marker", async () => {
    installWindowMocks({
      api: {
        agent: {
          getModelConfig: vi.fn().mockResolvedValue(
            modelConfig({
              model: null,
              provider: null,
              status: "not-configured",
            }),
          ),
        },
      },
    });

    await renderPanel();
    expect(screen.getByText("k3")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Set as default" }),
    ).toBeVisible();
  });
});
