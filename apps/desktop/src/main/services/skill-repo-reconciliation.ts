import fs from "fs";
import path from "path";

import type { DatabaseAdapter } from "@prompthub/db";

const MARKER_KIND = "prompthub-desktop-skill-repo-reconciliation";

interface SkillWithoutRepoPath {
  id: string;
  name: string;
  source_url: string | null;
}

interface ReconciliationMarker {
  kind: typeof MARKER_KIND;
  version: 1;
  state: "complete";
  reconciled: number;
  unresolved: number;
  completedAt: string;
}

export type SkillRepoPathResolver = (skill: SkillWithoutRepoPath) => string | null;

export interface SkillRepoReconciliationResult {
  status: "completed" | "already-complete";
  reconciled: number;
  unresolved: number;
}

function readMarker(markerPath: string): ReconciliationMarker | null {
  try {
    const stats = fs.lstatSync(markerPath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Desktop skill reconciliation marker is unsafe");
    }
    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8")) as Partial<ReconciliationMarker>;
    if (
      marker.kind !== MARKER_KIND ||
      marker.version !== 1 ||
      marker.state !== "complete" ||
      !Number.isSafeInteger(marker.reconciled) ||
      Number(marker.reconciled) < 0 ||
      !Number.isSafeInteger(marker.unresolved) ||
      Number(marker.unresolved) < 0 ||
      typeof marker.completedAt !== "string" ||
      !Number.isFinite(Date.parse(marker.completedAt))
    ) {
      throw new Error("Desktop skill reconciliation marker is malformed");
    }
    return marker as ReconciliationMarker;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function assertSafeRepoPath(repoPath: string): string {
  if (!path.isAbsolute(repoPath) || repoPath.includes("\0")) {
    throw new Error(`Unsafe skill repository path: ${repoPath}`);
  }
  const resolved = path.resolve(repoPath);
  const stats = fs.lstatSync(resolved);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`Unsafe skill repository path: ${repoPath}`);
  }
  return resolved;
}

function flushDirectory(directoryPath: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(directoryPath, "r");
    fs.fsyncSync(descriptor);
  } catch {
    // Windows and some filesystems do not permit directory fsync.
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function publishMarker(markerPath: string, marker: ReconciliationMarker): void {
  const markerDirectory = path.dirname(markerPath);
  fs.mkdirSync(markerDirectory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    markerDirectory,
    `.desktop-skill-repo-v1-${process.pid}-${Date.now()}.tmp`,
  );
  const descriptor = fs.openSync(temporaryPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(marker, null, 2), "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.renameSync(temporaryPath, markerPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
  flushDirectory(markerDirectory);
}

export function reconcileDesktopSkillRepoPaths(
  database: DatabaseAdapter.Database,
  markerPath: string,
  resolveRepoPath: SkillRepoPathResolver,
): SkillRepoReconciliationResult {
  const existing = readMarker(markerPath);
  if (existing) {
    return {
      status: "already-complete",
      reconciled: existing.reconciled,
      unresolved: existing.unresolved,
    };
  }

  const skills = database.all(
    `SELECT id, name, source_url
     FROM skills
     WHERE local_repo_path IS NULL OR local_repo_path = ''
     ORDER BY id ASC`,
  ) as SkillWithoutRepoPath[];
  const resolved = skills.map((skill) => {
    const repoPath = resolveRepoPath(skill);
    return { skill, repoPath: repoPath ? assertSafeRepoPath(repoPath) : null };
  });
  const updates = resolved.filter(
    (entry): entry is { skill: SkillWithoutRepoPath; repoPath: string } =>
      entry.repoPath !== null,
  );

  database.transaction(() => {
    for (const update of updates) {
      database.run(
        "UPDATE skills SET local_repo_path = ? WHERE id = ?",
        update.repoPath,
        update.skill.id,
      );
    }
    for (const update of updates) {
      const row = database.get(
        "SELECT local_repo_path FROM skills WHERE id = ?",
        update.skill.id,
      ) as { local_repo_path: string | null } | null;
      if (row?.local_repo_path !== update.repoPath) {
        throw new Error(`Desktop skill repository reconciliation failed for ${update.skill.id}`);
      }
    }
  })();

  const marker: ReconciliationMarker = {
    kind: MARKER_KIND,
    version: 1,
    state: "complete",
    reconciled: updates.length,
    unresolved: resolved.length - updates.length,
    completedAt: new Date().toISOString(),
  };
  publishMarker(markerPath, marker);
  return {
    status: "completed",
    reconciled: marker.reconciled,
    unresolved: marker.unresolved,
  };
}
