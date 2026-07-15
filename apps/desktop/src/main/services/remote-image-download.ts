import * as http from "http";
import * as https from "https";
import path from "path";
import {
  isBlockedHostname,
  resolvePublicAddress,
} from "./skill-installer-remote";
import { getHttpRequestAgent } from "./network-proxy";

const DOWNLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_MAX_REDIRECTS = 5;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export interface RemoteImageDownload {
  buffer: Buffer;
  finalUrl: string;
  contentType?: string;
}

function requestModule(protocol: string): typeof http | typeof https {
  return protocol === "https:" ? https : http;
}

function singleHeader(
  header: string | string[] | undefined,
): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

export async function isValidExternalImageUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (isBlockedHostname(host)) return false;
    await resolvePublicAddress(host);
    return true;
  } catch {
    return false;
  }
}

export function inferImageExtension(
  url: string,
  contentType?: string,
): string | null {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (IMAGE_EXTENSIONS.has(fromUrl)) return fromUrl;
  const mimeType = (contentType || "").split(";")[0].trim().toLowerCase();
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  return extensions[mimeType] ?? null;
}

export async function downloadRemoteImage(
  targetUrl: string,
  redirectCount = 0,
): Promise<RemoteImageDownload> {
  if (redirectCount > DOWNLOAD_MAX_REDIRECTS) {
    throw new Error("Too many redirects while downloading image");
  }
  const parsedUrl = new URL(targetUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Invalid or blocked URL");
  }
  if (isBlockedHostname(parsedUrl.hostname.toLowerCase())) {
    throw new Error("Invalid or blocked URL");
  }
  const resolvedAddress = await resolvePublicAddress(parsedUrl.hostname);
  const transport = requestModule(parsedUrl.protocol);
  const agent = getHttpRequestAgent(parsedUrl);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: resolvedAddress.address,
        family: resolvedAddress.family,
        servername: parsedUrl.hostname,
        port: parsedUrl.port
          ? Number(parsedUrl.port)
          : parsedUrl.protocol === "https:"
            ? 443
            : 80,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        headers: {
          Host: parsedUrl.host,
          "User-Agent": "PromptHub/image-download",
          Accept: "image/*",
        },
        agent,
        timeout: DOWNLOAD_TIMEOUT_MS,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = singleHeader(response.headers.location);
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          void downloadRemoteImage(
            new URL(location, parsedUrl).toString(),
            redirectCount + 1,
          )
            .then(resolve)
            .catch(reject);
          return;
        }
        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to fetch image: HTTP ${statusCode}`));
          return;
        }
        const contentType = singleHeader(response.headers["content-type"]);
        if (contentType && !contentType.toLowerCase().startsWith("image/")) {
          response.resume();
          reject(new Error("Remote resource is not an image"));
          return;
        }
        const contentLength = Number.parseInt(
          singleHeader(response.headers["content-length"]) ?? "",
          10,
        );
        if (
          Number.isFinite(contentLength) &&
          contentLength > DOWNLOAD_MAX_BYTES
        ) {
          response.resume();
          reject(new Error("Remote image exceeds size limit"));
          return;
        }
        let receivedBytes = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (receivedBytes > DOWNLOAD_MAX_BYTES) {
            response.destroy(new Error("Remote image exceeds size limit"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            finalUrl: parsedUrl.toString(),
            contentType,
          });
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("Remote image request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}
