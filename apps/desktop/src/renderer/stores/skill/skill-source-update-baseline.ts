import type { RegistrySkill, UpdateSkillParams } from "@prompthub/shared/types";
import { SKILL_PACKAGE_FINGERPRINT_ALGORITHM } from "@prompthub/shared/utils/skill-source-update";
import { getRegistrySkillSourceResolverKind } from "../../services/skill-source-resolver";

export function buildSourceBaselineFields(options: {
  contentHash: string;
  directoryFingerprint?: string;
  checkedAt: number;
}): Pick<
  UpdateSkillParams,
  | "installed_directory_fingerprint"
  | "fingerprint_algorithm"
  | "source_last_checked_at"
  | "source_last_error"
  | "source_binding_state"
> {
  return {
    installed_directory_fingerprint:
      options.directoryFingerprint?.trim() || options.contentHash,
    fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    source_last_checked_at: options.checkedAt,
    source_last_error: null,
    source_binding_state: "bound",
  };
}

export function getRegistrySkillInstallPackageFingerprint(
  registrySkill: RegistrySkill,
  installedContentHash: string,
): string {
  return getRegistrySkillSourceResolverKind(registrySkill) === "content-url"
    ? installedContentHash
    : registrySkill.directory_fingerprint?.trim() || installedContentHash;
}
