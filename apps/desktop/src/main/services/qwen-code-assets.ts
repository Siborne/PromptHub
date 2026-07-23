import os from "node:os";
import path from "node:path";

export interface QwenSkillScanRoot {
  path: string;
  readOnlyDiscovery: boolean;
}

export function getQwenSkillScanRoots(
  platformId: string,
  nativeSkillsDir: string,
  homeDir = os.homedir(),
): QwenSkillScanRoot[] {
  const nativeRoot = path.resolve(nativeSkillsDir);
  if (platformId !== "qwen") {
    return [{ path: nativeRoot, readOnlyDiscovery: false }];
  }

  const compatibilityRoot = path.resolve(homeDir, ".agents", "skills");
  return compatibilityRoot === nativeRoot
    ? [{ path: nativeRoot, readOnlyDiscovery: false }]
    : [
        { path: nativeRoot, readOnlyDiscovery: false },
        { path: compatibilityRoot, readOnlyDiscovery: true },
      ];
}

export function isReadOnlyQwenSkill(
  roots: QwenSkillScanRoot[],
  skillPath: string,
): boolean {
  const candidate = path.resolve(skillPath);
  return roots.some((root) => {
    if (!root.readOnlyDiscovery) return false;
    const relative = path.relative(root.path, candidate);
    return (
      relative !== "" &&
      !relative.startsWith("..") &&
      !path.isAbsolute(relative)
    );
  });
}
