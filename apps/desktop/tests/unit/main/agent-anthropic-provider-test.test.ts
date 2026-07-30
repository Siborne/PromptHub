/**
 * @vitest-environment node
 */
import { EventEmitter, once } from "node:events";
import {
  Agent as HttpAgent,
  createServer,
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  testAnthropicProviderConnection,
  testAnthropicProviderModel,
} from "../../../src/main/services/agent-anthropic-provider-probe";

const servers: Server[] = [];

async function listen(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ server: Server; endpoint: string }> {
  const server = createServer(handler);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address");
  }
  return {
    server,
    endpoint: `http://127.0.0.1:${address.port}/v1`,
  };
}

function connectionInput(
  endpoint: string | null,
  overrides: Partial<
    Parameters<typeof testAnthropicProviderConnection>[0]
  > = {},
) {
  return {
    endpoint,
    credential: "main-only-secret",
    credentialKind: "api-key" as const,
    model: "claude-sonnet-4",
    protocol: "anthropic-messages" as const,
    ...overrides,
  };
}

function modelInput(
  endpoint: string | null,
  overrides: Partial<Parameters<typeof testAnthropicProviderModel>[0]> = {},
) {
  return {
    ...connectionInput(endpoint),
    signal: new AbortController().signal,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => {
      server.closeAllConnections?.();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    }),
  );
});

describe("Anthropic Provider connection test", () => {
  it("enumerates models through the Anthropic API-key contract", async () => {
    let path = "";
    let apiKey = "";
    let version = "";
    const { endpoint } = await listen((request, response) => {
      path = request.url ?? "";
      apiKey = String(request.headers["x-api-key"] ?? "");
      version = String(request.headers["anthropic-version"] ?? "");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          data: [
            { id: "claude-sonnet-4" },
            null,
            [],
            {},
            { id: 7 },
            { id: "claude-haiku-4" },
          ],
        }),
      );
    });

    const result = await testAnthropicProviderConnection(
      connectionInput(endpoint),
      { requestAgent: null },
    );

    expect(path).toBe("/v1/models");
    expect(apiKey).toBe("main-only-secret");
    expect(version).toBe("2023-06-01");
    expect(result).toMatchObject({
      status: "ok",
      protocol: "anthropic-messages",
      modelCount: 2,
      modelAvailable: true,
      retryCount: 0,
    });
    expect(result.endpointOrigin).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(JSON.stringify(result)).not.toContain("main-only-secret");

    await expect(
      testAnthropicProviderConnection(
        connectionInput(endpoint.replace(/\/v1$/, "")),
        { requestAgent: new HttpAgent() },
      ),
    ).resolves.toMatchObject({ status: "ok" });
  });

  it("supports bearer-token gateways and reports missing models", async () => {
    let authorization = "";
    const { endpoint } = await listen((request, response) => {
      authorization = request.headers.authorization ?? "";
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "claude-haiku-4" }] }));
    });

    const result = await testAnthropicProviderConnection(
      connectionInput(endpoint, {
        credentialKind: "auth-token",
      }),
      { requestAgent: null },
    );

    expect(authorization).toBe("Bearer main-only-secret");
    expect(result).toMatchObject({
      status: "model-not-found",
      modelCount: 1,
      modelAvailable: false,
    });

    await expect(
      testAnthropicProviderConnection(
        connectionInput(endpoint, {
          credentialKind: "auth-token",
          model: null,
        }),
      ),
    ).resolves.toMatchObject({
      status: "ok",
      modelAvailable: null,
    });
  });

  it("fails closed before requests for invalid inputs and unsafe targets", async () => {
    await expect(
      testAnthropicProviderConnection(
        connectionInput("https://provider.example/v1", {
          credential: null,
        }),
      ),
    ).resolves.toMatchObject({
      status: "no-credentials",
      totalMs: 0,
      endpointOrigin: null,
    });
    for (const endpoint of [
      null,
      "not a URL",
      "file:///tmp/provider",
      "https://user:pass@provider.example/v1",
      "https://provider.example/v1?token=secret",
    ]) {
      await expect(
        testAnthropicProviderConnection(connectionInput(endpoint)),
      ).resolves.toMatchObject({ status: "invalid-endpoint" });
    }
    await expect(
      testAnthropicProviderConnection(
        connectionInput("https://provider.example/v1"),
        {
          lookupHost: async () => [{ address: "192.168.1.20", family: 4 }],
        },
      ),
    ).resolves.toMatchObject({ status: "blocked-address" });
    await expect(
      testAnthropicProviderConnection(
        connectionInput("https://provider.example/v1"),
        {
          lookupHost: async () => {
            throw new Error("DNS unavailable");
          },
        },
      ),
    ).resolves.toMatchObject({ status: "network-error" });
  });

  it("classifies HTTP, malformed JSON, body-size, timeout, and socket failures", async () => {
    const auth = await listen((_request, response) => {
      response.writeHead(401);
      response.end("rejected");
    });
    const httpError = await listen((_request, response) => {
      response.writeHead(503);
      response.end("unavailable");
    });
    const malformed = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"unexpected":true}');
    });
    const primitive = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("null");
    });
    const invalidJson = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{not-json");
    });
    const oversizedHeader = await listen((_request, response) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "content-length": "512",
      });
      response.end('{"data":[]}');
    });
    const oversizedStream = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "x".repeat(512) }] }));
    });
    const timeout = await listen(() => undefined);

    await expect(
      testAnthropicProviderConnection(connectionInput(auth.endpoint)),
    ).resolves.toMatchObject({
      status: "auth-error",
      errorCode: "http-401",
    });
    await expect(
      testAnthropicProviderConnection(connectionInput(httpError.endpoint)),
    ).resolves.toMatchObject({
      status: "http-error",
      errorCode: "http-503",
    });
    await expect(
      testAnthropicProviderConnection(connectionInput(malformed.endpoint)),
    ).resolves.toMatchObject({ status: "protocol-error" });
    for (const endpoint of [primitive.endpoint, invalidJson.endpoint]) {
      await expect(
        testAnthropicProviderConnection(connectionInput(endpoint)),
      ).resolves.toMatchObject({ status: "protocol-error" });
    }
    for (const endpoint of [
      oversizedHeader.endpoint,
      oversizedStream.endpoint,
    ]) {
      await expect(
        testAnthropicProviderConnection(connectionInput(endpoint), {
          maxBytes: 64,
          requestAgent: null,
        }),
      ).resolves.toMatchObject({ status: "response-too-large" });
    }
    await expect(
      testAnthropicProviderConnection(connectionInput(timeout.endpoint), {
        timeoutMs: 10,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "timeout" });
    await expect(
      testAnthropicProviderConnection(
        connectionInput("http://127.0.0.1:1/v1"),
        { requestAgent: null },
      ),
    ).resolves.toMatchObject({ status: "network-error" });

    const syntheticRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      destroy: vi.fn(),
    }) as unknown as ClientRequest;
    await expect(
      testAnthropicProviderConnection(connectionInput("http://localhost/v1"), {
        requestImpl: () => {
          process.nextTick(() => syntheticRequest.emit("timeout"));
          return syntheticRequest;
        },
      }),
    ).resolves.toMatchObject({ status: "timeout" });

    const statuslessResponse = Object.assign(new EventEmitter(), {
      statusCode: undefined,
      headers: {},
      resume: vi.fn(),
    }) as unknown as IncomingMessage;
    let statuslessListener: ((response: IncomingMessage) => void) | undefined;
    const statuslessRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(() =>
        process.nextTick(() => {
          statuslessListener?.(statuslessResponse);
        }),
      ),
      destroy: vi.fn(),
    }) as unknown as ClientRequest;
    await expect(
      testAnthropicProviderConnection(
        connectionInput("https://provider.example/v1"),
        {
          lookupHost: async () => [{ address: "8.8.8.8", family: 4 }],
          requestImpl: (_options, listener) => {
            statuslessListener = listener;
            return statuslessRequest;
          },
        },
      ),
    ).resolves.toMatchObject({
      status: "http-error",
      errorCode: "http-0",
    });

    const tlsTarget = await listen(() => undefined);
    await expect(
      testAnthropicProviderConnection(
        connectionInput(tlsTarget.endpoint.replace("http:", "https:")),
        { timeoutMs: 50, requestAgent: null },
      ),
    ).resolves.toMatchObject({ status: "network-error" });
  });
});

describe("Anthropic Provider model test", () => {
  it("streams Messages API output, usage, and a redacted bounded preview", async () => {
    let path = "";
    let apiKey = "";
    let body = "";
    const { endpoint } = await listen((request, response) => {
      path = request.url ?? "";
      apiKey = String(request.headers["x-api-key"] ?? "");
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write(
          'data: {"type":"message_start","message":{"usage":{"input_tokens":3}}}\n\n',
        );
        response.write(
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"main-only-secret\\u0001-OK"}}\n\n',
        );
        response.write(
          'data: {"type":"message_delta","usage":{"output_tokens":2}}\n\n',
        );
        response.end('data: {"type":"message_stop"}\n\n');
      });
    });

    const result = await testAnthropicProviderModel(modelInput(endpoint), {
      maxPreviewChars: 20,
      requestAgent: null,
    });

    expect(path).toBe("/v1/messages");
    expect(apiKey).toBe("main-only-secret");
    expect(JSON.parse(body)).toEqual({
      model: "claude-sonnet-4",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      stream: true,
      max_tokens: 8,
    });
    expect(result).toMatchObject({
      status: "ok",
      retryCount: 0,
      inputTokens: 3,
      outputTokens: 2,
      outputPreview: "[redacted]-OK",
    });
    expect(result.firstTokenMs).toEqual(expect.any(Number));
    expect(JSON.stringify(result)).not.toContain("main-only-secret");
    expect(result.outputPreview).not.toMatch(/[\u0000-\u001f\u007f]/);
  });

  it("supports bearer auth and a valid stream that ends without message_stop", async () => {
    let authorization = "";
    const { endpoint } = await listen((request, response) => {
      authorization = request.headers.authorization ?? "";
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        [
          "event: content_block_delta",
          "data: not-json",
          "data: null",
          'data: {"type":"message_start","message":{"usage":{"input_tokens":-1}}}',
          'data: {"type":"message_delta","usage":{"output_tokens":1.5}}',
          'data: {"type":"content_block_delta","delta":null}',
          'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","text":"hidden"}}',
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}',
        ].join("\n"),
      );
    });

    const result = await testAnthropicProviderModel(
      modelInput(endpoint, { credentialKind: "auth-token" }),
      { requestAgent: null },
    );

    expect(authorization).toBe("Bearer main-only-secret");
    expect(result).toMatchObject({
      status: "ok",
      outputPreview: "OK",
      inputTokens: null,
      outputTokens: null,
    });

    const emptyPreview = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        [
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"   "}}',
          'data: {"type":"message_stop"}',
          "",
        ].join("\n"),
      );
    });
    await expect(
      testAnthropicProviderModel(modelInput(emptyPreview.endpoint)),
    ).resolves.toMatchObject({ status: "ok", outputPreview: null });
  });

  it("fails closed for missing inputs, cancellation, blocked targets, and DNS errors", async () => {
    const cancelled = new AbortController();
    cancelled.abort("cancelled");
    await expect(
      testAnthropicProviderModel(
        modelInput("https://provider.example/v1", {
          signal: cancelled.signal,
        }),
      ),
    ).resolves.toMatchObject({ status: "cancelled", totalMs: 0 });
    await expect(
      testAnthropicProviderModel(
        modelInput("https://provider.example/v1", { credential: null }),
      ),
    ).resolves.toMatchObject({ status: "no-credentials", totalMs: 0 });
    for (const input of [
      modelInput(null),
      modelInput("not a URL"),
      modelInput("https://provider.example/v1", { model: null }),
    ]) {
      await expect(testAnthropicProviderModel(input)).resolves.toMatchObject({
        status: "invalid-endpoint",
      });
    }
    await expect(
      testAnthropicProviderModel(modelInput("https://provider.example/v1"), {
        lookupHost: async () => [{ address: "10.0.0.5", family: 4 }],
      }),
    ).resolves.toMatchObject({ status: "blocked-address" });
    await expect(
      testAnthropicProviderModel(modelInput("https://provider.example/v1"), {
        lookupHost: async () => {
          throw new Error("DNS unavailable");
        },
      }),
    ).resolves.toMatchObject({ status: "network-error" });
  });

  it("classifies auth, quota, model, rate-limit, and generic HTTP failures", async () => {
    const cases = [
      [401, "bad key", "auth-error"],
      [403, "forbidden", "auth-error"],
      [402, "payment required", "quota-error"],
      [400, "insufficient_quota", "quota-error"],
      [404, "configured model does not exist", "model-not-found"],
      [429, "rate limit", "rate-limited"],
      [418, "teapot", "http-error"],
    ] as const;

    for (const [statusCode, body, expected] of cases) {
      const { endpoint } = await listen((_request, response) => {
        response.writeHead(statusCode);
        response.end(body);
      });
      await expect(
        testAnthropicProviderModel(modelInput(endpoint), {
          maxRetries: 0,
          requestAgent: null,
        }),
      ).resolves.toMatchObject({
        status: expected,
        errorCode: `http-${statusCode}`,
      });
    }
  });

  it("retries one transient failure and stops after the bounded retry", async () => {
    let attempts = 0;
    const recovered = await listen((_request, response) => {
      attempts += 1;
      if (attempts === 1) {
        response.writeHead(503);
        response.end("unavailable");
        return;
      }
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}\n\n',
      );
    });
    await expect(
      testAnthropicProviderModel(modelInput(recovered.endpoint), {
        maxRetries: 99,
        retryDelayMs: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "ok", retryCount: 1 });
    expect(attempts).toBe(2);

    let failedAttempts = 0;
    const unavailable = await listen((_request, response) => {
      failedAttempts += 1;
      response.writeHead(503);
      response.end("unavailable");
    });
    await expect(
      testAnthropicProviderModel(modelInput(unavailable.endpoint), {
        maxRetries: 99,
        retryDelayMs: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "http-error", retryCount: 1 });
    expect(failedAttempts).toBe(2);

    const retryController = new AbortController();
    let retryDelayStarted!: () => void;
    const retryDelayReady = new Promise<void>((resolve) => {
      retryDelayStarted = resolve;
    });
    const delayed = await listen((_request, response) => {
      response.writeHead(503);
      response.end("unavailable");
    });
    const running = testAnthropicProviderModel(
      modelInput(delayed.endpoint, { signal: retryController.signal }),
      {
        maxRetries: 1,
        requestAgent: null,
        get retryDelayMs() {
          retryDelayStarted();
          return undefined;
        },
      },
    );
    await retryDelayReady;
    retryController.abort("cancelled");
    await expect(running).resolves.toMatchObject({
      status: "cancelled",
      retryCount: 0,
    });

    const preWaitController = new AbortController();
    const abortedBeforeWait = testAnthropicProviderModel(
      modelInput(delayed.endpoint, { signal: preWaitController.signal }),
      {
        maxRetries: 1,
        requestAgent: null,
        get retryDelayMs() {
          preWaitController.abort("cancelled");
          return 0;
        },
      },
    );
    await expect(abortedBeforeWait).resolves.toMatchObject({
      status: "cancelled",
      retryCount: 0,
    });
  });

  it("enforces stream size, protocol, connect, first-token, and total limits", async () => {
    const oversized = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(`data: ${"x".repeat(512)}\n\n`);
    });
    const oversizedError = await listen((_request, response) => {
      response.writeHead(500);
      response.end("x".repeat(512));
    });
    const noToken = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end('data: {"type":"message_stop"}\n\n');
    });
    const noTokenAtEnd = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end("data: null");
    });
    const firstTokenTimeout = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.flushHeaders();
    });
    const connectTimeout = await listen(() => undefined);
    const totalTimeout = await listen(() => undefined);

    await expect(
      testAnthropicProviderModel(modelInput(oversized.endpoint), {
        maxBytes: 64,
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "response-too-large" });
    await expect(
      testAnthropicProviderModel(modelInput(oversizedError.endpoint), {
        maxBytes: 64,
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "response-too-large" });
    await expect(
      testAnthropicProviderModel(modelInput(noToken.endpoint), {
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "protocol-error" });
    await expect(
      testAnthropicProviderModel(modelInput(noTokenAtEnd.endpoint), {
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "protocol-error" });
    await expect(
      testAnthropicProviderModel(modelInput(firstTokenTimeout.endpoint), {
        firstTokenTimeoutMs: 10,
        totalTimeoutMs: 100,
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "first-token-timeout" });
    await expect(
      testAnthropicProviderModel(modelInput(connectTimeout.endpoint), {
        connectTimeoutMs: 10,
        totalTimeoutMs: 100,
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "connect-timeout" });
    await expect(
      testAnthropicProviderModel(modelInput(totalTimeout.endpoint), {
        connectTimeoutMs: 100,
        firstTokenTimeoutMs: 100,
        totalTimeoutMs: 10,
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "total-timeout" });
  });

  it("cancels an in-flight request and classifies interrupted streams", async () => {
    const controller = new AbortController();
    const cancellable = await listen(() => undefined);
    const running = testAnthropicProviderModel(
      modelInput(cancellable.endpoint, { signal: controller.signal }),
      {
        connectTimeoutMs: 100,
        totalTimeoutMs: 100,
        maxRetries: 0,
        requestAgent: null,
      },
    );
    await once(cancellable.server, "request");
    controller.abort("cancelled");
    await expect(running).resolves.toMatchObject({ status: "cancelled" });

    const responseController = new AbortController();
    let responseReceived!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      responseReceived = resolve;
    });
    const cancellableResponse = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.flushHeaders();
    });
    const responseRunning = testAnthropicProviderModel(
      modelInput(cancellableResponse.endpoint, {
        signal: responseController.signal,
      }),
      {
        firstTokenTimeoutMs: 100,
        totalTimeoutMs: 100,
        maxRetries: 0,
        requestAgent: null,
        requestImpl: (requestOptions, listener) =>
          httpRequest(requestOptions, (response) => {
            listener(response);
            responseReceived();
          }),
      },
    );
    await responseReady;
    responseController.abort("cancelled");
    await expect(responseRunning).resolves.toMatchObject({
      status: "cancelled",
    });

    const interrupted = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}\n\n',
      );
      response.socket?.destroy();
    });
    await expect(
      testAnthropicProviderModel(modelInput(interrupted.endpoint), {
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "network-error" });
    await expect(
      testAnthropicProviderModel(modelInput("http://127.0.0.1:1/v1"), {
        maxRetries: 0,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "network-error" });

    const statuslessIncoming = Object.assign(new EventEmitter(), {
      statusCode: undefined,
      headers: {},
      destroy: vi.fn(),
    }) as unknown as IncomingMessage;
    let statuslessModelListener:
      | ((response: IncomingMessage) => void)
      | undefined;
    const statuslessModelRequest = Object.assign(new EventEmitter(), {
      write: vi.fn(),
      end: vi.fn(() =>
        process.nextTick(() => {
          statuslessModelListener?.(statuslessIncoming);
          statuslessIncoming.emit("end");
        }),
      ),
      destroy: vi.fn(),
    }) as unknown as ClientRequest;
    await expect(
      testAnthropicProviderModel(modelInput("http://localhost"), {
        maxRetries: 0,
        requestImpl: (_options, listener) => {
          statuslessModelListener = listener;
          return statuslessModelRequest;
        },
      }),
    ).resolves.toMatchObject({
      status: "http-error",
      errorCode: "http-0",
    });

    const tlsModelTarget = await listen(() => undefined);
    await expect(
      testAnthropicProviderModel(
        modelInput(tlsModelTarget.endpoint.replace("http:", "https:")),
        {
          connectTimeoutMs: 50,
          totalTimeoutMs: 100,
          maxRetries: 0,
          requestAgent: null,
        },
      ),
    ).resolves.toMatchObject({ status: "network-error" });
  });
});
