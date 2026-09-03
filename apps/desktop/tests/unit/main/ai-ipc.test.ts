/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

const handlers = new Map<string, (...args: any[]) => any>();
const fetchWithNetworkProxy = vi.hoisted(() => vi.fn());

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    }),
  },
}));

vi.mock("../../../src/main/services/network-proxy", () => ({
  fetchWithNetworkProxy,
}));

describe("AI IPC multipart transport", () => {
  beforeEach(async () => {
    handlers.clear();
    vi.clearAllMocks();
    fetchWithNetworkProxy.mockResolvedValue(
      new Response('{"data":[]}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { registerAIIPC } = await import("../../../src/main/ipc/ai.ipc");
    registerAIIPC();
  });

  it("builds bounded repeated image parts and lets fetch assign the boundary", async () => {
    const response = await handlers.get(IPC_CHANNELS.AI_HTTP_REQUEST)?.(
      {},
      {
        method: "POST",
        url: "https://api.openai.com/v1/images/edits",
        headers: {
          Authorization: "Bearer key",
          "Content-Type": "application/json",
        },
        multipart: {
          fields: { model: "gpt-image-1", prompt: "Edit it" },
          files: [
            {
              fieldName: "image[]",
              fileName: "one.png",
              mimeType: "image/png",
              base64: "iVBORw0KGgo=",
            },
            {
              fieldName: "image[]",
              fileName: "two.webp",
              mimeType: "image/webp",
              base64: "UklGRgQAAABXRUJQ",
            },
          ],
        },
      },
    );

    expect(response.ok).toBe(true);
    const [, init] = fetchWithNetworkProxy.mock.calls[0];
    expect(init.headers).toEqual({ Authorization: "Bearer key" });
    expect(init.body).toBeInstanceOf(FormData);
    const entries = Array.from((init.body as FormData).entries());
    expect(entries.map(([name]) => name)).toEqual([
      "model",
      "prompt",
      "image[]",
      "image[]",
    ]);
    expect((entries[2][1] as File).name).toBe("one.png");
    expect((entries[3][1] as File).type).toBe("image/webp");
  });

  it.each([
    {
      name: "mixed JSON and multipart bodies",
      request: {
        method: "POST",
        url: "https://api.openai.com/v1/images/edits",
        body: "{}",
        multipart: { fields: {}, files: [] },
      },
    },
    {
      name: "unsupported file MIME",
      request: {
        method: "POST",
        url: "https://api.openai.com/v1/images/edits",
        multipart: {
          fields: {},
          files: [
            {
              fieldName: "image[]",
              fileName: "bad.gif",
              mimeType: "image/gif",
              base64: "R0lGODlh",
            },
          ],
        },
      },
    },
    {
      name: "malformed base64",
      request: {
        method: "POST",
        url: "https://api.openai.com/v1/images/edits",
        multipart: {
          fields: {},
          files: [
            {
              fieldName: "image[]",
              fileName: "bad.png",
              mimeType: "image/png",
              base64: "not base64!",
            },
          ],
        },
      },
    },
  ])("rejects $name before network I/O", async ({ request }) => {
    const response = await handlers.get(IPC_CHANNELS.AI_HTTP_REQUEST)?.(
      {},
      request,
    );
    expect(response).toMatchObject({ ok: false, status: 0 });
    expect(fetchWithNetworkProxy).not.toHaveBeenCalled();
  });
});
