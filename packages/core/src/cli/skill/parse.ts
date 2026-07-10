export interface ParsedSkillMd {
  frontmatter: {
    name?: string;
    description?: string;
    version?: string;
    author?: string;
    tags?: string[];
    compatibility?: string;
  };
  body?: string;
}

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

export function parseSkillMd(content: string): ParsedSkillMd | null {
  if (!content || typeof content !== "string") {
    return null;
  }

  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content.trim() };
  }

  const body = content.slice(frontmatterMatch[0].length).trim();
  const frontmatter: ParsedSkillMd["frontmatter"] = {};
  for (const line of frontmatterMatch[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      const items = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      if (key === "tags") {
        frontmatter.tags = items;
      } else if (key === "compatibility") {
        frontmatter.compatibility = items.join(", ");
      }
      continue;
    }

    if (key === "name") frontmatter.name = value;
    if (key === "description") frontmatter.description = value;
    if (key === "version") frontmatter.version = value;
    if (key === "author") frontmatter.author = value;
    if (key === "compatibility") frontmatter.compatibility = value;
    if (key === "tags" && !frontmatter.tags) {
      frontmatter.tags = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return { frontmatter, body };
}
