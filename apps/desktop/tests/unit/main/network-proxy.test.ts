import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { IncomingMessage, RequestOptions } from "http";
import { Readable } from "stream";

const setProxyMock = vi.fn().mockResolvedValue(undefined);

vi.mock("electron", () => ({
  session: {
    defaultSession: {
      setProxy: setProxyMock,
    },
  },
}));

describe("network proxy service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    setProxyMock.mockClear();
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    const mod = await import("../../../src/main/services/network-proxy");
    await mod.applyNetworkProxySettings({ mode: "system" });
    process.env = { ...originalEnv };
  });

  it("applies manual proxy to Electron session, proxy env, and request agents", async () => {
    const mod = await import("../../../src/main/services/network-proxy");

    await mod.applyNetworkProxySettings({
      mode: "manual",
      protocol: "http",
      host: "127.0.0.1",
      port: 7890,
      username: "u",
      password: "p",
      bypass: "<local>,localhost",
    });

    expect(setProxyMock).toHaveBeenLastCalledWith({
      mode: "fixed_servers",
      proxyRules: "http://u:p@127.0.0.1:7890",
      proxyBypassRules: "<local>,localhost",
    });
    expect(process.env.HTTP_PROXY).toBe("http://u:p@127.0.0.1:7890");
    expect(process.env.HTTPS_PROXY).toBe("http://u:p@127.0.0.1:7890");
    expect(
      mod.getHttpRequestAgent("https://api.github.com/repos"),
    ).toBeDefined();
    expect(mod.getHttpRequestAgent("https://localhost/test")).toBeUndefined();
  });

  it("routes SOCKS5 fetch requests through a proxied Node request agent", async () => {
    const originalFetch = globalThis.fetch;
    const fallbackFetch = vi.fn();
    const writeMock = vi.fn();
    const endMock = vi.fn();
    const requestMock = vi.fn(
      (
        _url: URL,
        options: RequestOptions,
        callback: (response: IncomingMessage) => void,
      ) => {
        const response = new Readable({
          read() {
            this.push("ok");
            this.push(null);
          },
        }) as Readable & {
          statusCode?: number;
          statusMessage?: string;
          headers: Record<string, string>;
        };
        response.statusCode = 200;
        response.statusMessage = "OK";
        response.headers = {};
        queueMicrotask(() => callback(response as unknown as IncomingMessage));
        return {
          on: vi.fn(),
          write: writeMock,
          end: endMock,
          destroy: vi.fn(),
        };
      },
    );

    globalThis.fetch = fallbackFetch as unknown as typeof fetch;
    vi.doMock("https", () => ({
      default: { request: requestMock },
      request: requestMock,
    }));

    try {
      const mod = await import("../../../src/main/services/network-proxy");

      await mod.applyNetworkProxySettings({
        mode: "manual",
        protocol: "socks5",
        host: "127.0.0.1",
        port: 7890,
        username: "",
        password: "",
        bypass: "<local>,localhost",
      });

      const response = await mod.fetchWithNetworkProxy(
        "https://example.com/api",
        {
          method: "POST",
          body: "payload",
        },
      );

      expect(await response.text()).toBe("ok");
      expect(fallbackFetch).not.toHaveBeenCalled();
      expect(requestMock).toHaveBeenCalled();
      expect(requestMock.mock.calls[0][1].agent).toBeDefined();
      expect(writeMock).toHaveBeenCalledWith("payload");
      expect(endMock).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      vi.doUnmock("https");
    }
  });

  it("clears inherited proxy environment in direct mode", async () => {
    const mod = await import("../../../src/main/services/network-proxy");
    process.env.HTTP_PROXY = "http://old.proxy:8080";
    process.env.HTTPS_PROXY = "http://old.proxy:8080";
    process.env.ALL_PROXY = "http://old.proxy:8080";
    process.env.http_proxy = "http://old.proxy:8080";

    await mod.applyNetworkProxySettings({ mode: "direct" });

    expect(setProxyMock).toHaveBeenLastCalledWith({ mode: "direct" });
    expect(process.env.HTTP_PROXY).toBeUndefined();
    expect(process.env.HTTPS_PROXY).toBeUndefined();
    expect(process.env.ALL_PROXY).toBeUndefined();
    expect(process.env.http_proxy).toBeUndefined();
  });

  it("restores the inherited proxy environment in system mode", async () => {
    process.env.HTTP_PROXY = "http://system.proxy:8080";
    process.env.HTTPS_PROXY = "http://system.proxy:8080";
    const mod = await import("../../../src/main/services/network-proxy");

    await mod.applyNetworkProxySettings({
      mode: "manual",
      protocol: "http",
      host: "127.0.0.1",
      port: 7890,
    });
    await mod.applyNetworkProxySettings({ mode: "system" });

    expect(setProxyMock).toHaveBeenLastCalledWith({ mode: "system" });
    expect(process.env.HTTP_PROXY).toBe("http://system.proxy:8080");
    expect(process.env.HTTPS_PROXY).toBe("http://system.proxy:8080");
  });
});
