/**
 * @vitest-environment node
 */
import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const httpRequest = vi.hoisted(() => vi.fn());
const httpsRequest = vi.hoisted(() => vi.fn());
const isBlockedHostname = vi.hoisted(() => vi.fn(() => false));
const resolvePublicAddress = vi.hoisted(() =>
  vi.fn(async () => ({ address: "203.0.113.10", family: 4 as const })),
);

vi.mock("http", () => ({
  default: { request: httpRequest },
  request: httpRequest,
}));
vi.mock("https", () => ({
  default: { request: httpsRequest },
  request: httpsRequest,
}));
vi.mock("../../../src/main/services/skill-installer-remote", () => ({
  isBlockedHostname,
  resolvePublicAddress,
}));
vi.mock("../../../src/main/services/network-proxy", () => ({
  getHttpRequestAgent: () => undefined,
}));

import {
  downloadRemoteImage,
  inferImageExtension,
  isValidExternalImageUrl,
} from "../../../src/main/services/remote-image-download";

interface ResponseOptions {
  statusCode?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
  responseError?: Error;
}

function createResponse(options: ResponseOptions = {}) {
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
    resume: ReturnType<typeof vi.fn>;
    destroy: (error: Error) => void;
    start: () => void;
  };
  response.statusCode = options.statusCode ?? 200;
  response.headers = options.headers ?? { "content-type": "image/png" };
  response.resume = vi.fn();
  response.destroy = (error) => response.emit("error", error);
  response.start = () => {
    process.nextTick(() => {
      if (options.responseError) {
        response.emit("error", options.responseError);
        return;
      }
      for (const chunk of options.chunks ?? [Buffer.from("image")]) {
        response.emit("data", chunk);
      }
      response.emit("end");
    });
  };
  return response;
}

function requestFor(response: ReturnType<typeof createResponse>) {
  return (_options: unknown, callback: (value: typeof response) => void) => {
    const request = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: (error: Error) => void;
    };
    request.end = () => {
      callback(response);
      response.start();
    };
    request.destroy = (error) => request.emit("error", error);
    return request;
  };
}

describe("remote image download policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBlockedHostname.mockReturnValue(false);
    resolvePublicAddress.mockResolvedValue({
      address: "203.0.113.10",
      family: 4,
    });
  });

  it("validates public HTTP URLs and rejects unsafe sources", async () => {
    await expect(
      isValidExternalImageUrl("https://cdn.example.com/a.png"),
    ).resolves.toBe(true);
    isBlockedHostname.mockReturnValueOnce(true);
    await expect(
      isValidExternalImageUrl("http://localhost/a.png"),
    ).resolves.toBe(false);
    resolvePublicAddress.mockRejectedValueOnce(new Error("private address"));
    await expect(
      isValidExternalImageUrl("https://internal.example/a.png"),
    ).resolves.toBe(false);
    await expect(isValidExternalImageUrl("file:///tmp/a.png")).resolves.toBe(
      false,
    );
    await expect(isValidExternalImageUrl("not a URL")).resolves.toBe(false);
  });

  it("derives supported extensions from the final URL or MIME type", () => {
    expect(inferImageExtension("https://cdn.example.com/a.webp")).toBe(".webp");
    expect(
      inferImageExtension(
        "https://cdn.example.com/output",
        "image/jpeg; charset=binary",
      ),
    ).toBe(".jpg");
    expect(
      inferImageExtension("https://cdn.example.com/output", "text/html"),
    ).toBeNull();
  });

  it("downloads HTTP and HTTPS images with resolved public addresses", async () => {
    httpsRequest.mockImplementation(
      requestFor(createResponse({ chunks: [Buffer.from("secure")] })),
    );
    httpRequest.mockImplementation(
      requestFor(createResponse({ chunks: [Buffer.from("plain")] })),
    );

    await expect(
      downloadRemoteImage("https://cdn.example.com/a.png"),
    ).resolves.toMatchObject({
      buffer: Buffer.from("secure"),
      finalUrl: "https://cdn.example.com/a.png",
      contentType: "image/png",
    });
    await expect(
      downloadRemoteImage("http://cdn.example.com/a.png"),
    ).resolves.toMatchObject({
      buffer: Buffer.from("plain"),
    });
    await expect(
      downloadRemoteImage("https://cdn.example.com:8443/a.png"),
    ).resolves.toMatchObject({ buffer: Buffer.from("secure") });
    expect(httpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: "203.0.113.10",
        servername: "cdn.example.com",
        path: "/a.png",
      }),
      expect.any(Function),
    );
  });

  it("follows bounded redirects and rejects invalid redirect targets", async () => {
    httpsRequest
      .mockImplementationOnce(
        requestFor(
          createResponse({ statusCode: 302, headers: { location: "/b.png" } }),
        ),
      )
      .mockImplementationOnce(
        requestFor(createResponse({ chunks: [Buffer.from("redirected")] })),
      );

    await expect(
      downloadRemoteImage("https://cdn.example.com/a.png"),
    ).resolves.toMatchObject({
      buffer: Buffer.from("redirected"),
      finalUrl: "https://cdn.example.com/b.png",
    });
    await expect(
      downloadRemoteImage("https://cdn.example.com/a.png", 6),
    ).rejects.toThrow(/too many redirects/i);
    await expect(downloadRemoteImage("file:///tmp/a.png")).rejects.toThrow(
      /invalid or blocked url/i,
    );
    isBlockedHostname.mockReturnValueOnce(true);
    await expect(
      downloadRemoteImage("https://localhost/a.png"),
    ).rejects.toThrow(/invalid or blocked url/i);
  });

  it.each([
    ["HTTP failure", createResponse({ statusCode: 503 }), /HTTP 503/i],
    [
      "non-image response",
      createResponse({ headers: { "content-type": "text/html" } }),
      /not an image/i,
    ],
    [
      "declared oversize",
      createResponse({
        headers: {
          "content-type": "image/png",
          "content-length": String(10 * 1024 * 1024 + 1),
        },
      }),
      /size limit/i,
    ],
    [
      "streamed oversize",
      createResponse({ chunks: [Buffer.alloc(10 * 1024 * 1024 + 1)] }),
      /size limit/i,
    ],
    [
      "response error",
      createResponse({ responseError: new Error("response broke") }),
      /response broke/i,
    ],
  ])("rejects %s", async (_name, response, expected) => {
    httpsRequest.mockImplementation(requestFor(response));
    await expect(
      downloadRemoteImage("https://cdn.example.com/a.png"),
    ).rejects.toThrow(expected);
  });

  it("rejects request timeouts and transport failures", async () => {
    httpsRequest.mockImplementationOnce(() => {
      const request = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error: Error) => void;
      };
      request.end = () => request.emit("timeout");
      request.destroy = (error) => request.emit("error", error);
      return request;
    });
    await expect(
      downloadRemoteImage("https://cdn.example.com/a.png"),
    ).rejects.toThrow(/timed out/i);

    httpsRequest.mockImplementationOnce(() => {
      const request = new EventEmitter() as EventEmitter & {
        end: () => void;
        destroy: (error: Error) => void;
      };
      request.end = () => request.emit("error", new Error("transport broke"));
      request.destroy = () => undefined;
      return request;
    });
    await expect(
      downloadRemoteImage("https://cdn.example.com/a.png"),
    ).rejects.toThrow(/transport broke/i);
  });
});
