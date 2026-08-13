import { ipcMain } from "electron";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type {
  AgentProviderActivateRequest,
  AgentProviderActivationExecutionResult,
  AgentProviderActivationPlan,
  AgentProviderAdapterContext,
  AgentProviderConnectionTestResult,
  AgentProviderFieldResolution,
  AgentProviderImportCurrentRequest,
  AgentProviderImportPreview,
  AgentProviderModelTestRequest,
  AgentProviderModelTestResult,
  AgentProviderPreviewRequest,
} from "@prompthub/shared";

interface AgentProviderActivationOperations {
  testCurrentConnection(input: {
    context: AgentProviderAdapterContext;
  }): Promise<AgentProviderConnectionTestResult>;
  testCurrentModel(
    input: { context: AgentProviderAdapterContext },
    signal: AbortSignal,
  ): Promise<AgentProviderModelTestResult>;
  testConnection(input: {
    context: AgentProviderAdapterContext;
    profileId: string;
  }): Promise<AgentProviderConnectionTestResult>;
  testModel(
    input: {
      context: AgentProviderAdapterContext;
      profileId: string;
    },
    signal: AbortSignal,
  ): Promise<AgentProviderModelTestResult>;
  importCurrent(input: {
    context: AgentProviderAdapterContext;
  }): Promise<AgentProviderImportPreview>;
  preview(input: {
    context: AgentProviderAdapterContext;
    profileId: string;
  }): Promise<AgentProviderActivationPlan>;
  activate(input: {
    context: AgentProviderAdapterContext;
    profileId: string;
    expectedCurrentDigest: string;
    resolutions?: AgentProviderFieldResolution[];
  }): Promise<AgentProviderActivationExecutionResult>;
}

type ResolveAgentProviderContext = (
  agentId: string,
) => AgentProviderAdapterContext;

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return value.trim();
}

function readImportRequest(value: unknown): AgentProviderImportCurrentRequest {
  const request = requireRecord(value);
  return { agentId: requireText(request.agentId) };
}

function readPreviewRequest(value: unknown): AgentProviderPreviewRequest {
  const request = requireRecord(value);
  return {
    agentId: requireText(request.agentId),
    profileId: requireText(request.profileId),
  };
}

function readModelTestRequest(value: unknown): AgentProviderModelTestRequest {
  const request = requireRecord(value);
  const requestId = requireText(request.requestId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestId)) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return {
    agentId: requireText(request.agentId),
    profileId: requireText(request.profileId),
    requestId,
  };
}

function readCurrentModelTestRequest(value: unknown): {
  agentId: string;
  requestId: string;
} {
  const request = requireRecord(value);
  const requestId = requireText(request.requestId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestId)) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return {
    agentId: requireText(request.agentId),
    requestId,
  };
}

function readModelTestCancelRequest(value: unknown): { requestId: string } {
  const request = requireRecord(value);
  const requestId = requireText(request.requestId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestId)) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return { requestId };
}

function senderId(event: unknown): number {
  const sender = requireRecord(requireRecord(event).sender);
  if (!Number.isInteger(sender.id) || Number(sender.id) < 0) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return Number(sender.id);
}

function bindSenderDestroyed(
  event: unknown,
  onDestroyed: () => void,
): () => void {
  const sender = requireRecord(requireRecord(event).sender);
  if (typeof sender.once !== "function") return () => undefined;
  sender.once.call(sender, "destroyed", onDestroyed);
  return () => {
    if (typeof sender.removeListener === "function") {
      sender.removeListener.call(sender, "destroyed", onDestroyed);
    }
  };
}

function readResolutions(value: unknown): AgentProviderFieldResolution[] {
  if (!Array.isArray(value)) {
    throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
  }
  return value.map((candidate) => {
    const resolution = requireRecord(candidate);
    const field = requireText(resolution.field);
    if (
      resolution.action !== "preserve-current" &&
      resolution.action !== "use-profile"
    ) {
      throw new Error("AGENT_PROVIDER_REQUEST_INVALID");
    }
    return { field, action: resolution.action };
  });
}

function readActivateRequest(value: unknown): AgentProviderActivateRequest {
  const request = requireRecord(value);
  return {
    agentId: requireText(request.agentId),
    profileId: requireText(request.profileId),
    expectedCurrentDigest: requireText(request.expectedCurrentDigest),
    ...(request.resolutions === undefined
      ? {}
      : { resolutions: readResolutions(request.resolutions) }),
  };
}

function toIpcError(error: unknown): Error {
  if (
    error instanceof Error &&
    /^AGENT_PROVIDER_[A-Z0-9_]+$/.test(error.message)
  ) {
    return new Error(error.message);
  }
  console.error("[agent-provider] operation failed");
  return new Error("AGENT_PROVIDER_OPERATION_FAILED");
}

async function invoke<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toIpcError(error);
  }
}

export function registerAgentProviderActivationIPC(
  service: AgentProviderActivationOperations,
  resolveContext: ResolveAgentProviderContext,
): void {
  const activeModelTests = new Map<string, AbortController>();
  const runModelTest = async <T>(
    event: unknown,
    requestId: string,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    const key = `${senderId(event)}:${requestId}`;
    if (activeModelTests.has(key)) {
      throw new Error("AGENT_PROVIDER_MODEL_TEST_IN_PROGRESS");
    }
    const controller = new AbortController();
    const unbindSenderDestroyed = bindSenderDestroyed(event, () =>
      controller.abort("renderer-destroyed"),
    );
    activeModelTests.set(key, controller);
    try {
      return await operation(controller.signal);
    } finally {
      unbindSenderDestroyed();
      activeModelTests.delete(key);
    }
  };
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_TEST_CURRENT_CONNECTION,
    async (_, input: unknown) =>
      invoke(async () => {
        const request = readImportRequest(input);
        return service.testCurrentConnection({
          context: resolveContext(request.agentId),
        });
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_TEST_CURRENT_MODEL,
    async (event, input: unknown) =>
      invoke(async () => {
        const request = readCurrentModelTestRequest(input);
        return runModelTest(event, request.requestId, (signal) =>
          service.testCurrentModel(
            { context: resolveContext(request.agentId) },
            signal,
          ),
        );
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_TEST_CONNECTION,
    async (_, input: unknown) =>
      invoke(async () => {
        const request = readPreviewRequest(input);
        return service.testConnection({
          context: resolveContext(request.agentId),
          profileId: request.profileId,
        });
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_TEST_MODEL,
    async (event, input: unknown) =>
      invoke(async () => {
        const request = readModelTestRequest(input);
        return runModelTest(event, request.requestId, (signal) =>
          service.testModel(
            {
              context: resolveContext(request.agentId),
              profileId: request.profileId,
            },
            signal,
          ),
        );
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_CANCEL_MODEL_TEST,
    async (event, input: unknown) =>
      invoke(async () => {
        const request = readModelTestCancelRequest(input);
        const key = `${senderId(event)}:${request.requestId}`;
        const controller = activeModelTests.get(key);
        if (!controller) return false;
        controller.abort("cancelled");
        return true;
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_IMPORT_CURRENT,
    async (_, input: unknown) =>
      invoke(async () => {
        const request = readImportRequest(input);
        return service.importCurrent({
          context: resolveContext(request.agentId),
        });
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_PREVIEW,
    async (_, input: unknown) =>
      invoke(async () => {
        const request = readPreviewRequest(input);
        return service.preview({
          context: resolveContext(request.agentId),
          profileId: request.profileId,
        });
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_PROVIDER_ACTIVATE,
    async (_, input: unknown) =>
      invoke(async () => {
        const request = readActivateRequest(input);
        return service.activate({
          context: resolveContext(request.agentId),
          profileId: request.profileId,
          expectedCurrentDigest: request.expectedCurrentDigest,
          ...(request.resolutions ? { resolutions: request.resolutions } : {}),
        });
      }),
  );
}
