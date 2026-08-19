import fs from "fs";
import path from "path";

import { getUserDataPath } from "../runtime-paths";

const RESTORE_MARKER_NAME = ".prompthub-restore-marker";

function getRestoreMarkerPath(userDataPath?: string): string {
  return path.join(userDataPath ?? getUserDataPath(), RESTORE_MARKER_NAME);
}

/**
 * Marks a completed database restore so the next bootstrap does not resurrect
 * stale Prompt workspace files before the database is projected back to disk.
 */
export function writeRestoreMarker(userDataPath?: string): void {
  try {
    const markerPath = getRestoreMarkerPath(userDataPath);
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, new Date().toISOString(), "utf8");
  } catch (error) {
    console.warn("[prompt-workspace] failed to write restore marker:", error);
  }
}

export function hasPromptWorkspaceRestoreMarker(
  userDataPath?: string,
): boolean {
  try {
    return fs.existsSync(getRestoreMarkerPath(userDataPath));
  } catch {
    return false;
  }
}

export function clearPromptWorkspaceRestoreMarker(userDataPath?: string): void {
  try {
    const markerPath = getRestoreMarkerPath(userDataPath);
    if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
  } catch (error) {
    console.warn("[prompt-workspace] failed to clear restore marker:", error);
  }
}
