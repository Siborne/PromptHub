import type {
  SkillPackageSnapshot,
  SkillPackageSnapshotFile,
  SkillPackageSnapshotScope,
} from "@prompthub/shared/types";
import { computeStableTextHash } from "@prompthub/shared/utils/skill-identity";

async function sha256Text(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  if (!globalThis.crypto?.subtle) return computeStableTextHash(content);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createTextSkillPackageSnapshot(options: {
  files: Array<{ path: string; content: string }>;
  directoryFingerprint: string;
  scope: SkillPackageSnapshotScope;
}): Promise<SkillPackageSnapshot> {
  const files: SkillPackageSnapshotFile[] = await Promise.all(
    options.files.map(async (file) => ({
      path: file.path,
      sizeBytes: new TextEncoder().encode(file.content).byteLength,
      contentHash: await sha256Text(file.content),
      kind: "text" as const,
      content: file.content,
    })),
  );
  files.sort((left, right) => left.path.localeCompare(right.path));
  const skillMarkdown =
    files.find((file) => file.path.toLowerCase() === "skill.md")?.content ?? "";
  return {
    content: skillMarkdown,
    directoryFingerprint: options.directoryFingerprint,
    scope: options.scope,
    files,
  };
}
