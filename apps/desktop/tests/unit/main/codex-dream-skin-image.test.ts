import { describe, expect, it } from "vitest";

import { readDreamSkinImageMetadata } from "../../../src/main/services/codex-dream-skin-image";

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpeg(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

function webpChunk(type: "VP8X" | "VP8L" | "VP8 ", data: Buffer): Buffer {
  const padding = data.length % 2;
  const bytes = Buffer.alloc(20 + data.length + padding);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write(type, 12, "ascii");
  bytes.writeUInt32LE(data.length, 16);
  data.copy(bytes, 20);
  return bytes;
}

describe("Codex Dream Skin image metadata", () => {
  it("reads PNG and JPEG dimensions and classifies their layout", () => {
    expect(readDreamSkinImageMetadata(png(3_000, 1_000), ".PNG")).toMatchObject(
      {
        width: 3_000,
        height: 1_000,
        aspect: "ultrawide",
        wide: true,
        taskMode: "banner",
      },
    );
    expect(
      readDreamSkinImageMetadata(jpeg(1_600, 1_000), ".jpeg"),
    ).toMatchObject({
      aspect: "wide",
      taskMode: "ambient",
    });
    expect(
      readDreamSkinImageMetadata(jpeg(1_200, 1_000), ".jpg"),
    ).toMatchObject({ aspect: "landscape" });
    expect(readDreamSkinImageMetadata(png(1_000, 1_000), ".png")).toMatchObject(
      { aspect: "square" },
    );
    expect(readDreamSkinImageMetadata(png(800, 1_000), ".png")).toMatchObject({
      aspect: "portrait",
    });
  });

  it("reads VP8X, VP8L and lossy VP8 WebP dimensions", () => {
    const vp8x = Buffer.alloc(10);
    vp8x.writeUIntLE(639, 4, 3);
    vp8x.writeUIntLE(359, 7, 3);
    expect(
      readDreamSkinImageMetadata(webpChunk("VP8X", vp8x), ".webp"),
    ).toMatchObject({ width: 640, height: 360 });

    const vp8l = Buffer.from([0x2f, 0xff, 0xc1, 0x18, 0x00]);
    expect(
      readDreamSkinImageMetadata(webpChunk("VP8L", vp8l), ".webp"),
    ).toMatchObject({ width: 512, height: 100 });

    const vp8 = Buffer.alloc(10);
    vp8.set([0x9d, 0x01, 0x2a], 3);
    vp8.writeUInt16LE(320, 6);
    vp8.writeUInt16LE(240, 8);
    expect(
      readDreamSkinImageMetadata(webpChunk("VP8 ", vp8), ".webp"),
    ).toMatchObject({ width: 320, height: 240 });
  });

  it("rejects malformed, unsupported and unsafe image dimensions", () => {
    expect(readDreamSkinImageMetadata(Buffer.alloc(3), ".png")).toBeNull();
    expect(readDreamSkinImageMetadata(png(1, 1), ".gif")).toBeNull();
    expect(readDreamSkinImageMetadata(png(0, 1), ".png")).toBeNull();
    expect(readDreamSkinImageMetadata(png(16_385, 1), ".png")).toBeNull();
    expect(readDreamSkinImageMetadata(png(10_000, 10_000), ".png")).toBeNull();
    expect(
      readDreamSkinImageMetadata(webpChunk("VP8L", Buffer.alloc(2)), ".webp"),
    ).toBeNull();

    const brokenJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x20]);
    expect(readDreamSkinImageMetadata(brokenJpeg, ".jpg")).toBeNull();

    const brokenWebp = webpChunk("VP8X", Buffer.alloc(10));
    brokenWebp.writeUInt32LE(0xffff, 16);
    expect(readDreamSkinImageMetadata(brokenWebp, ".webp")).toBeNull();
  });
});
