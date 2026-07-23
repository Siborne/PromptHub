import * as fs from "fs/promises";
import * as path from "path";
import type {
  AgentScannedSkill,
  ScannedSkill,
  SkillPlatformScanResult,
} from "@prompthub/shared/types";
import {
  getCherryStudioPlatformSkillMetadata,
  isCherryStudioPlatform,
  uninstallCherryStudioPlatformSkill,
} from "./cherry-studio-skill-platform";
import { fileExists, isPathWithin } from "./skill-installer-internal";
import { getSupportedPlatforms } from "./skill-installer-platform";
import { getPlatformSkillsDir } from "./skill-installer-utils";
import { getQwenSkillScanRoots, isReadOnlyQwenSkill } from "./qwen-code-assets";

type ScanLocalPreview = (paths: string[]) => Promise<ScannedSkill[]>;

export async function scanAgentPlatformSkills(
  platformId: string,
  scanLocalPreview: ScanLocalPreview,
  options: { homeDir?: string } = {},
): Promise<SkillPlatformScanResult> {
  const platform = getSupportedPlatforms().find(
    (entry) => entry.id === platformId,
  );
  if (!platform) {
    throw new Error(`Unknown platform: ${platformId}`);
  }

  const skillsDir = getPlatformSkillsDir(platform);
  const scanRoots = getQwenSkillScanRoots(
    platform.id,
    skillsDir,
    options.homeDir,
  );
  const scannedSkills = await scanLocalPreview(
    scanRoots.map((root) => root.path),
  );
  const isCherryStudio = isCherryStudioPlatform(platform.id);
  const agentSkills = await Promise.all(
    scannedSkills.map(async (skill): Promise<AgentScannedSkill> => {
      const platformMetadata = isCherryStudio
        ? await getCherryStudioPlatformSkillMetadata(
            platform,
            skill.localPath,
          ).catch(() => ({ isBuiltin: false }))
        : { isBuiltin: false };

      return {
        ...skill,
        installMode: skill.installMode ?? "copy",
        isPlatformBuiltin: platformMetadata.isBuiltin || undefined,
        isReadOnlyDiscovery:
          isReadOnlyQwenSkill(scanRoots, skill.localPath) || undefined,
        platformSkillPath: skill.localPath,
        platforms: [platform.name],
      };
    }),
  );

  return { platform, skillsDir, scannedSkills: agentSkills };
}

export async function uninstallAgentPlatformSkill(
  platformId: string,
  platformSkillPath: string,
): Promise<void> {
  const platform = getSupportedPlatforms().find(
    (entry) => entry.id === platformId,
  );
  if (!platform) {
    throw new Error(`Unknown platform: ${platformId}`);
  }
  if (
    typeof platformSkillPath !== "string" ||
    platformSkillPath.trim().length === 0
  ) {
    throw new Error("Platform skill path is required");
  }

  const skillsDir = path.resolve(getPlatformSkillsDir(platform));
  const targetPath = path.resolve(platformSkillPath);
  const relativeTarget = path.relative(skillsDir, targetPath);
  if (
    !isPathWithin(skillsDir, targetPath) ||
    relativeTarget === "" ||
    relativeTarget === "."
  ) {
    throw new Error("Path traversal detected: skill path is outside platform");
  }

  if (isCherryStudioPlatform(platform.id)) {
    await uninstallCherryStudioPlatformSkill(platform, targetPath);
    return;
  }

  if (await fileExists(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}
