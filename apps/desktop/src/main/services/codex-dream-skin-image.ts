// Adapted from Fei-Away/Codex-Dream-Skin 3af1d6d under the MIT License.
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export const DREAM_SKIN_MAX_IMAGE_DIMENSION = 16_384;
export const DREAM_SKIN_MAX_IMAGE_PIXELS = 50_000_000;

export interface DreamSkinImageMetadata {
  width: number;
  height: number;
  ratio: number;
  wide: boolean;
  aspect: "ultrawide" | "wide" | "landscape" | "square" | "portrait";
  taskMode: "banner" | "ambient";
}

function uint16be(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 256 + bytes[offset + 1];
}

function uint16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 256;
}

function uint24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65_536;
}

function uint32be(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  );
}

function uint32le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngDimensions(bytes: Uint8Array): [number, number] | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < 24 ||
    signature.some((value, index) => bytes[index] !== value) ||
    uint32be(bytes, 8) !== 13 ||
    ascii(bytes, 12, 4) !== "IHDR"
  ) {
    return null;
  }
  return [uint32be(bytes, 16), uint32be(bytes, 20)];
}

function jpegDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) break;
    const length = uint16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (SOF_MARKERS.has(marker) && length >= 7) {
      return [uint16be(bytes, offset + 5), uint16be(bytes, offset + 3)];
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): [number, number] | null {
  if (
    bytes.length < 20 ||
    ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    return null;
  }
  const riffEnd = Math.min(bytes.length, uint32le(bytes, 4) + 8);
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const type = ascii(bytes, offset, 4);
    const size = uint32le(bytes, offset + 4);
    const data = offset + 8;
    if (data + size > riffEnd) break;
    if (type === "VP8X" && size >= 10) {
      return [uint24le(bytes, data + 4) + 1, uint24le(bytes, data + 7) + 1];
    }
    if (type === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
      const width = 1 + bytes[data + 1] + ((bytes[data + 2] & 0x3f) << 8);
      const height =
        1 +
        (bytes[data + 2] >> 6) +
        (bytes[data + 3] << 2) +
        ((bytes[data + 4] & 0x0f) << 10);
      return [width, height];
    }
    if (
      type === "VP8 " &&
      size >= 10 &&
      bytes[data + 3] === 0x9d &&
      bytes[data + 4] === 0x01 &&
      bytes[data + 5] === 0x2a
    ) {
      return [
        uint16le(bytes, data + 6) & 0x3fff,
        uint16le(bytes, data + 8) & 0x3fff,
      ];
    }
    offset = data + size + (size % 2);
  }
  return null;
}

export function readDreamSkinImageMetadata(
  bytes: Uint8Array,
  extension: string,
): DreamSkinImageMetadata | null {
  const normalized = extension.toLowerCase();
  const dimensions =
    normalized === ".png"
      ? pngDimensions(bytes)
      : normalized === ".jpg" || normalized === ".jpeg"
        ? jpegDimensions(bytes)
        : normalized === ".webp"
          ? webpDimensions(bytes)
          : null;
  if (!dimensions) return null;
  const [width, height] = dimensions;
  const ratio = width / height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > DREAM_SKIN_MAX_IMAGE_DIMENSION ||
    height > DREAM_SKIN_MAX_IMAGE_DIMENSION ||
    width * height > DREAM_SKIN_MAX_IMAGE_PIXELS ||
    !Number.isFinite(ratio)
  ) {
    return null;
  }
  const aspect =
    ratio >= 2.25
      ? "ultrawide"
      : ratio >= 1.45
        ? "wide"
        : ratio >= 1.08
          ? "landscape"
          : ratio >= 0.9
            ? "square"
            : "portrait";
  return {
    width,
    height,
    ratio,
    wide: ratio >= 1.75,
    aspect,
    taskMode: ratio >= 2.25 ? "banner" : "ambient",
  };
}
