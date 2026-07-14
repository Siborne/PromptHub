import type {
  SkillPackageSnapshot,
  SkillPackageSnapshotFile,
} from "@prompthub/shared/types";

export type SkillPackageFileDiffStatus = "added" | "modified" | "removed";
export type SkillPackageFilePreviewKind = "text" | "binary" | "truncated";

export interface SkillPackageFileDiff {
  path: string;
  status: SkillPackageFileDiffStatus;
  previewKind: SkillPackageFilePreviewKind;
  local?: SkillPackageSnapshotFile;
  remote?: SkillPackageSnapshotFile;
}

function fallbackFiles(
  snapshot: SkillPackageSnapshot | null | undefined,
): SkillPackageSnapshotFile[] {
  if (!snapshot) return [];
  if (snapshot.files?.length) return snapshot.files;
  return [
    {
      path: "SKILL.md",
      sizeBytes: new TextEncoder().encode(snapshot.content).byteLength,
      contentHash: snapshot.directoryFingerprint,
      kind: "text",
      content: snapshot.content,
    },
  ];
}

function getPreviewKind(
  local: SkillPackageSnapshotFile | undefined,
  remote: SkillPackageSnapshotFile | undefined,
): SkillPackageFilePreviewKind {
  if (local?.kind === "binary" || remote?.kind === "binary") return "binary";
  if (
    local?.contentTruncated ||
    remote?.contentTruncated ||
    (local && local.content === undefined) ||
    (remote && remote.content === undefined)
  ) {
    return "truncated";
  }
  return "text";
}

function isSameFile(
  local: SkillPackageSnapshotFile,
  remote: SkillPackageSnapshotFile,
): boolean {
  if (local.kind !== remote.kind) return false;
  if (local.contentHash && remote.contentHash) {
    return local.contentHash === remote.contentHash;
  }
  return local.content !== undefined && local.content === remote.content;
}

export function buildSkillPackageDiff(
  localSnapshot: SkillPackageSnapshot | null | undefined,
  remoteSnapshot: SkillPackageSnapshot | null | undefined,
): SkillPackageFileDiff[] {
  const localFiles = fallbackFiles(localSnapshot);
  const remoteFiles = fallbackFiles(remoteSnapshot);
  const localByPath = new Map(localFiles.map((file) => [file.path, file]));
  const remoteByPath = new Map(remoteFiles.map((file) => [file.path, file]));
  const paths =
    remoteSnapshot?.scope === "skill-md"
      ? [...remoteByPath.keys()]
      : [...new Set([...localByPath.keys(), ...remoteByPath.keys()])];

  return paths
    .sort((left, right) => left.localeCompare(right))
    .flatMap((path): SkillPackageFileDiff[] => {
      const local = localByPath.get(path);
      const remote = remoteByPath.get(path);
      if (local && remote && isSameFile(local, remote)) return [];
      const status: SkillPackageFileDiffStatus = !local
        ? "added"
        : !remote
          ? "removed"
          : "modified";
      return [
        {
          path,
          status,
          previewKind: getPreviewKind(local, remote),
          ...(local ? { local } : {}),
          ...(remote ? { remote } : {}),
        },
      ];
    });
}
