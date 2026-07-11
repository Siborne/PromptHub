export {
  parseSkillMd,
  type ParsedSkillMd,
  type SkillFrontmatter,
} from "../../skills/skill-frontmatter";

export function sanitizeString(
  value: unknown,
  fallback?: string,
): string | undefined {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

export function sanitizeTags(primary: unknown, fallback: unknown): string[] {
  const source = Array.isArray(primary)
    ? primary
    : Array.isArray(fallback)
      ? fallback
      : [];

  return source
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    )
    .map((item) => item.trim());
}

export function sanitizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    )
    .map((item) => item.trim());

  return items.length > 0 ? items : undefined;
}

export function sanitizeProtocolType(
  value: unknown,
): "skill" | "mcp" | "claude-code" {
  return value === "mcp" || value === "claude-code" ? value : "skill";
}

export function validateSkillName(skillName: string): string {
  const normalizedName = skillName.trim();
  if (!normalizedName) {
    throw new Error("Invalid skill name: must not be empty");
  }
  if (normalizedName.includes("\0")) {
    throw new Error("Invalid skill name: must not contain null bytes");
  }
  if (
    normalizedName.includes("..") ||
    normalizedName.includes("/") ||
    normalizedName.includes("\\")
  ) {
    throw new Error(
      `Invalid skill name: must not contain "..", "/" or "\\": ${normalizedName}`,
    );
  }
  if (/^[a-zA-Z]:/.test(normalizedName)) {
    throw new Error(
      `Invalid skill name: must not be an absolute path: ${normalizedName}`,
    );
  }

  return normalizedName;
}
