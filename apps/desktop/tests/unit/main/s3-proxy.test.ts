/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";

const electronMocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
}));

const s3Mocks = vi.hoisted(() => ({
  s3ClientMock: vi.fn(),
  sendMock: vi.fn(),
  headBucketCommandMock: vi.fn(),
  getObjectCommandMock: vi.fn(),
  putObjectCommandMock: vi.fn(),
  headObjectCommandMock: vi.fn(),
}));

const smithyMocks = vi.hoisted(() => ({
  nodeHttpHandlerMock: vi.fn((options) => ({ options })),
}));

const proxyMocks = vi.hoisted(() => ({
  agent: { kind: "proxy-agent" },
  getHttpRequestAgentMock: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.handleMock,
  },
}));

vi.mock("@smithy/node-http-handler", () => ({
  NodeHttpHandler: smithyMocks.nodeHttpHandlerMock,
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: s3Mocks.s3ClientMock,
  S3ServiceException: class S3ServiceException extends Error {},
  HeadBucketCommand: s3Mocks.headBucketCommandMock,
  GetObjectCommand: s3Mocks.getObjectCommandMock,
  PutObjectCommand: s3Mocks.putObjectCommandMock,
  HeadObjectCommand: s3Mocks.headObjectCommandMock,
}));

vi.mock("../../../src/main/services/network-proxy", () => ({
  getHttpRequestAgent: proxyMocks.getHttpRequestAgentMock,
}));

describe("S3 proxy wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    proxyMocks.getHttpRequestAgentMock.mockReturnValue(proxyMocks.agent);
    s3Mocks.s3ClientMock.mockImplementation(() => ({
      send: s3Mocks.sendMock.mockResolvedValue({}),
    }));
  });

  it("passes the active proxy agent into the AWS S3 HTTP handler", async () => {
    const { registerS3IPC } = await import("../../../src/main/s3");
    registerS3IPC();

    const handler = electronMocks.handleMock.mock.calls.find(
      ([channel]) => channel === IPC_CHANNELS.S3_TEST_CONNECTION,
    )?.[1] as (_event: unknown, config: unknown) => Promise<unknown>;
    expect(handler).toBeTypeOf("function");

    await handler(
      {},
      {
        endpoint: "https://s3.example.com",
        region: "us-east-1",
        bucket: "prompthub",
        accessKeyId: "access",
        secretAccessKey: "secret",
      },
    );

    expect(proxyMocks.getHttpRequestAgentMock).toHaveBeenCalledWith(
      new URL("https://s3.example.com"),
    );
    expect(smithyMocks.nodeHttpHandlerMock).toHaveBeenCalledWith({
      httpsAgent: proxyMocks.agent,
    });
    expect(s3Mocks.s3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://s3.example.com",
        requestHandler: { options: { httpsAgent: proxyMocks.agent } },
      }),
    );
  });
});
