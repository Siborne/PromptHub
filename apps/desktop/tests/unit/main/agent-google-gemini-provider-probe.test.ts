/**
 * @vitest-environment node
 */
import { EventEmitter, once } from "node:events";
import {
  Agent,
  createServer,
  type ClientRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  testGoogleGeminiProviderConnection,
  testGoogleGeminiProviderModel,
} from "../../../src/main/services/agent-google-gemini-provider-probe";

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
    endpoint: `http://127.0.0.1:${address.port}`,
  };
}

function connectionInput(
  endpoint: string | null,
  overrides: Partial<
    Parameters<typeof testGoogleGeminiProviderConnection>[0]
  > = {},
) {
  return {
    endpoint,
    credential: "main-only-gemini-key",
    model: "gemini-3-flash-preview",
    protocol: "google-generative-ai" as const,
    ...overrides,
  };
}

function modelInput(
  endpoint: string | null,
  overrides: Partial<Parameters<typeof testGoogleGeminiProviderModel>[0]> = {},
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

describe("Google Gemini Provider connection test", () => {
  it("enumerates native Gemini models with API-key auth", async () => {
    let requestPath = "";
    let apiKey = "";
    const { endpoint } = await listen((request, response) => {
      requestPath = request.url ?? "";
      apiKey = String(request.headers["x-goog-api-key"] ?? "");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          models: [
            { name: "models/gemini-3-flash-preview" },
            null,
            [],
            {},
            { name: 7 },
            { name: "models/gemini-2.5-pro" },
          ],
        }),
      );
    });

    const result = await testGoogleGeminiProviderConnection(
      connectionInput(endpoint),
      { requestAgent: null },
    );

    expect(requestPath).toBe("/v1beta/models");
    expect(apiKey).toBe("main-only-gemini-key");
    expect(result).toMatchObject({
      status: "ok",
      protocol: "google-generative-ai",
      modelCount: 2,
      modelAvailable: true,
      retryCount: 0,
    });
    expect(result.endpointOrigin).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(JSON.stringify(result)).not.toContain("main-only-gemini-key");

    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput(endpoint, { model: "models/gemini-2.5-pro" }),
      ),
    ).resolves.toMatchObject({ status: "ok", modelAvailable: true });
  });

  it("reports missing models and validates inputs before opening a request", async () => {
    const { endpoint } = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ models: [{ name: "models/other" }] }));
    });
    await expect(
      testGoogleGeminiProviderConnection(connectionInput(endpoint)),
    ).resolves.toMatchObject({
      status: "model-not-found",
      modelCount: 1,
      modelAvailable: false,
    });
    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput(endpoint, { model: null }),
      ),
    ).resolves.toMatchObject({ status: "ok", modelAvailable: null });
    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput(endpoint, { credential: null }),
      ),
    ).resolves.toMatchObject({
      status: "no-credentials",
      totalMs: 0,
      endpointOrigin: null,
    });
    for (const invalid of [
      null,
      "not a URL",
      "file:///tmp/provider",
      "https://user:pass@example.com",
      "https://example.com?key=secret",
      "http://remote.example.com",
    ]) {
      await expect(
        testGoogleGeminiProviderConnection(connectionInput(invalid)),
      ).resolves.toMatchObject({ status: "invalid-endpoint" });
    }
    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput("https://provider.example"),
        {
          lookupHost: async () => [{ address: "192.168.1.5", family: 4 }],
        },
      ),
    ).resolves.toMatchObject({ status: "blocked-address" });
    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput("https://provider.example"),
        {
          lookupHost: async () => {
            throw new Error("DNS failed");
          },
        },
      ),
    ).resolves.toMatchObject({ status: "network-error" });
  });

  it("classifies HTTP, malformed responses, size limits, timeouts, and socket failures", async () => {
    const cases = [
      [401, "bad key", "auth-error"],
      [403, "forbidden", "auth-error"],
      [302, "redirect", "http-error"],
      [500, "unavailable", "http-error"],
    ] as const;
    for (const [statusCode, body, status] of cases) {
      const { endpoint } = await listen((_request, response) => {
        response.writeHead(statusCode);
        response.end(body);
      });
      await expect(
        testGoogleGeminiProviderConnection(connectionInput(endpoint)),
      ).resolves.toMatchObject({
        status,
        errorCode: `http-${statusCode}`,
      });
    }

    for (const body of ['{"unexpected":true}', "null", "{broken"]) {
      const { endpoint } = await listen((_request, response) => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(body);
      });
      await expect(
        testGoogleGeminiProviderConnection(connectionInput(endpoint)),
      ).resolves.toMatchObject({ status: "protocol-error" });
    }

    const oversized = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ models: [{ name: `models/${"x".repeat(512)}` }] }),
      );
    });
    await expect(
      testGoogleGeminiProviderConnection(connectionInput(oversized.endpoint), {
        maxBytes: 64,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "response-too-large" });
    const declaredOversized = await listen((_request, response) => {
      response.writeHead(200, { "content-length": "1024" });
      response.end('{"models":[]}');
    });
    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput(declaredOversized.endpoint),
        {
          maxBytes: 64,
          requestAgent: new Agent(),
        },
      ),
    ).resolves.toMatchObject({ status: "response-too-large" });

    const timeout = await listen(() => undefined);
    await expect(
      testGoogleGeminiProviderConnection(connectionInput(timeout.endpoint), {
        timeoutMs: 10,
        requestAgent: null,
      }),
    ).resolves.toMatchObject({ status: "timeout" });
    await expect(
      testGoogleGeminiProviderConnection(
        connectionInput("http://127.0.0.1:1"),
        { requestAgent: null },
      ),
    ).resolves.toMatchObject({ status: "network-error" });

    const syntheticRequest = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      destroy: vi.fn(),
    }) as unknown as ClientRequest;
    await expect(
      testGoogleGeminiProviderConnection(connectionInput("http://localhost"), {
        requestImpl: () => {
          process.nextTick(() => syntheticRequest.emit("timeout"));
          return syntheticRequest;
        },
      }),
    ).resolves.toMatchObject({ status: "timeout" });
  });
});

describe("Google Gemini Provider model test", () => {
  it("streams generateContent output, usage, and a redacted bounded preview", async () => {
    let requestPath = "";
    let apiKey = "";
    let body = "";
    const { endpoint } = await listen((request, response) => {
      requestPath = request.url ?? "";
      apiKey = String(request.headers["x-goog-api-key"] ?? "");
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write(
          'data: {"candidates":[{"content":{"parts":[{"text":"main-only-gemini-key\\u0001-OK"}]}}],"usageMetadata":{"promptTokenCount":4}}\n\n',
        );
        response.end(
          'data: {"candidates":[{"content":{"parts":[{"text":"!"}]}}],"usageMetadata":{"candidatesTokenCount":2}}\n\n',
        );
      });
    });

    const result = await testGoogleGeminiProviderModel(modelInput(endpoint), {
      maxPreviewChars: 24,
      requestAgent: null,
    });

    expect(requestPath).toBe(
      "/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse",
    );
    expect(apiKey).toBe("main-only-gemini-key");
    expect(JSON.parse(body)).toEqual({
      contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
      generationConfig: { maxOutputTokens: 8 },
    });
    expect(result).toMatchObject({
      status: "ok",
      retryCount: 0,
      inputTokens: 4,
      outputTokens: 2,
      outputPreview: "[redacted]-OK!",
    });
    expect(result.firstTokenMs).toEqual(expect.any(Number));
    expect(JSON.stringify(result)).not.toContain("main-only-gemini-key");
    expect(result.outputPreview).not.toMatch(/[\u0000-\u001f\u007f]/);
  });

  it("ignores malformed stream events but rejects a successful stream with no text", async () => {
    const valid = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        [
          "event: message",
          "data: not-json",
          "data: null",
          'data: {"usageMetadata":{"promptTokenCount":-1,"candidatesTokenCount":1.5}}',
          'data: {"candidates":[null,{"content":{"parts":[{"text":"OK"}]}}]}',
          "",
        ].join("\n"),
      );
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(valid.endpoint)),
    ).resolves.toMatchObject({
      status: "ok",
      outputPreview: "OK",
      inputTokens: null,
      outputTokens: null,
    });

    const noText = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end('data: {"candidates":[]}\n\n');
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(noText.endpoint), {
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "protocol-error" });

    const finalBufferedEvent = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        'data: {"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}',
      );
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(finalBufferedEvent.endpoint), {
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "ok", outputPreview: "OK" });
  });

  it("classifies API errors and retries at most one transient failure", async () => {
    const cases = [
      [400, "API key not valid", "auth-error"],
      [403, "permission denied", "auth-error"],
      [404, "model gemini-x is not found", "model-not-found"],
      [429, "resource exhausted", "rate-limited"],
      [400, "quota exceeded", "quota-error"],
      [418, "teapot", "http-error"],
    ] as const;
    for (const [statusCode, body, status] of cases) {
      const { endpoint } = await listen((_request, response) => {
        response.writeHead(statusCode);
        response.end(body);
      });
      await expect(
        testGoogleGeminiProviderModel(modelInput(endpoint), {
          maxRetries: 0,
        }),
      ).resolves.toMatchObject({
        status,
        errorCode: `http-${statusCode}`,
      });
    }

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
        'data: {"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}\n\n',
      );
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(recovered.endpoint), {
        maxRetries: 99,
        retryDelayMs: 0,
      }),
    ).resolves.toMatchObject({ status: "ok", retryCount: 1 });
    expect(attempts).toBe(2);
  });

  it("fails closed for missing inputs, unsafe targets, and cancellation", async () => {
    const cancelled = new AbortController();
    cancelled.abort("cancelled");
    await expect(
      testGoogleGeminiProviderModel(
        modelInput("https://provider.example", {
          signal: cancelled.signal,
        }),
      ),
    ).resolves.toMatchObject({ status: "cancelled", totalMs: 0 });
    await expect(
      testGoogleGeminiProviderModel(
        modelInput("https://provider.example", { credential: null }),
      ),
    ).resolves.toMatchObject({ status: "no-credentials", totalMs: 0 });
    for (const input of [
      modelInput(null),
      modelInput("not a URL"),
      modelInput("https://provider.example", { model: null }),
      modelInput("https://provider.example", { model: "../unsafe" }),
    ]) {
      await expect(testGoogleGeminiProviderModel(input)).resolves.toMatchObject(
        { status: "invalid-endpoint" },
      );
    }
    await expect(
      testGoogleGeminiProviderModel(modelInput("https://provider.example"), {
        lookupHost: async () => [{ address: "10.0.0.5", family: 4 }],
      }),
    ).resolves.toMatchObject({ status: "blocked-address" });

    const controller = new AbortController();
    const cancellable = await listen(() => undefined);
    const running = testGoogleGeminiProviderModel(
      modelInput(cancellable.endpoint, { signal: controller.signal }),
      {
        connectTimeoutMs: 100,
        totalTimeoutMs: 100,
        maxRetries: 0,
      },
    );
    await once(cancellable.server, "request");
    controller.abort("cancelled");
    await expect(running).resolves.toMatchObject({ status: "cancelled" });
  });

  it("enforces response, connect, first-token, and total limits", async () => {
    const oversized = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(`data: ${"x".repeat(512)}\n\n`);
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(oversized.endpoint), {
        maxBytes: 64,
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "response-too-large" });

    const oversizedError = await listen((_request, response) => {
      response.writeHead(503);
      response.end("x".repeat(512));
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(oversizedError.endpoint), {
        maxBytes: 64,
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "response-too-large" });

    const firstToken = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.flushHeaders();
    });
    await expect(
      testGoogleGeminiProviderModel(modelInput(firstToken.endpoint), {
        firstTokenTimeoutMs: 10,
        totalTimeoutMs: 100,
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "first-token-timeout" });

    const connect = await listen(() => undefined);
    await expect(
      testGoogleGeminiProviderModel(modelInput(connect.endpoint), {
        connectTimeoutMs: 10,
        totalTimeoutMs: 100,
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "connect-timeout" });
    await expect(
      testGoogleGeminiProviderModel(modelInput(connect.endpoint), {
        connectTimeoutMs: 100,
        totalTimeoutMs: 10,
        maxRetries: 0,
      }),
    ).resolves.toMatchObject({ status: "total-timeout" });

    const retryController = new AbortController();
    const retrying = await listen((_request, response) => {
      response.writeHead(503);
      response.end("retry");
    });
    const retryResult = testGoogleGeminiProviderModel(
      modelInput(retrying.endpoint, { signal: retryController.signal }),
      {
        retryDelayMs: 1_000,
        totalTimeoutMs: 2_000,
      },
    );
    await once(retrying.server, "request");
    await new Promise<void>((resolve) => setImmediate(resolve));
    retryController.abort("cancelled");
    await expect(retryResult).resolves.toMatchObject({ status: "cancelled" });
  });
});
