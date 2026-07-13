import type { TFunction } from "i18next";
import type { RegistrySkillUpdateCheck } from "../../services/skill-store-update";
import {
  getRegistrySkillSourceReference,
  type SkillSourceResolverKind,
} from "../../services/skill-source-resolver";
import { sanitizeSourceUpdateError } from "../../stores/skill/skill-store-domain";

function getSourceKindLabel(
  kind: SkillSourceResolverKind,
  sourceLabel: string | undefined,
  t: TFunction,
): string {
  if (kind === "local-linked" || kind === "managed-copy") {
    return t("skill.sourceKindLocal", "Local source");
  }
  if (kind === "remote-store" && sourceLabel?.trim()) {
    return sourceLabel.trim();
  }
  return t("skill.sourceKindRemote", "Remote source");
}

export function formatSkillSourceUnavailableMessage(
  check: RegistrySkillUpdateCheck,
  t: TFunction,
): string {
  const source = getRegistrySkillSourceReference(
    check.registrySkill,
    check.installedSkill,
  );
  const kind = check.sourceKind || source.kind;
  const reference = check.sourceReference || source.reference;
  const reason =
    check.sourceError ||
    check.installedSkill?.source_last_error ||
    "Source check failed";

  return t(
    "skill.sourceUnavailableDetails",
    "Source is unavailable. Type: {{type}}. Location: {{reference}}. Reason: {{reason}}.",
    {
      type: getSourceKindLabel(kind, check.registrySkill.source_label, t),
      reference: sanitizeSourceUpdateError(reference),
      reason: sanitizeSourceUpdateError(reason),
    },
  );
}
