import { parseDocument, stringify } from "yaml";

const FRONTMATTER_MARKER = /^---[ \t]*(?:\r?\n|$)/;
const CLOSING_MARKER = /^---[ \t]*(?:\r?\n|$)/m;
const STANDARD_KEY_ORDER = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "version",
  "author",
  "tags",
] as const;

export interface SkillFrontmatter {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  compatibility?: string;
  tags?: string[];
  metadata?: Record<string, string>;
  allowedTools?: string;
}

export interface ParsedSkillMd {
  frontmatter: SkillFrontmatter;
  rawFrontmatter: Record<string, unknown>;
  body: string;
  raw: string;
}

export interface SerializeSkillMdInput {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  license?: string;
  compatibility?: string | string[];
  tags?: string[];
  metadata?: Record<string, string>;
  allowedTools?: string;
  instructions?: string;
  preservedFrontmatter?: Record<string, unknown>;
}

function asScalarString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = values
    .map(asScalarString)
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim());
  return normalized.length > 0 ? normalized : undefined;
}

function asMetadata(value: unknown): Record<string, string> | undefined {
  if (!isPlainRecord(value)) return undefined;
  const entries = Object.entries(value).flatMap(([key, item]) => {
    const normalized = asScalarString(item);
    return normalized === undefined ? [] : [[key, normalized] as const];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function asAllowedTools(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return asStringList(value)?.join(", ");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFrontmatter(
  rawFrontmatter: Record<string, unknown>,
): SkillFrontmatter {
  const compatibility = asStringList(rawFrontmatter.compatibility);
  const tags = asStringList(rawFrontmatter.tags);
  return {
    name: asScalarString(rawFrontmatter.name) ?? "",
    description: asScalarString(rawFrontmatter.description),
    version: asScalarString(rawFrontmatter.version),
    author: asScalarString(rawFrontmatter.author),
    license: asScalarString(rawFrontmatter.license),
    compatibility: compatibility?.join(", "),
    tags:
      Array.isArray(rawFrontmatter.tags) && rawFrontmatter.tags.length === 0
        ? []
        : tags,
    metadata: asMetadata(rawFrontmatter.metadata),
    allowedTools: asAllowedTools(rawFrontmatter["allowed-tools"]),
  };
}

function parseFrontmatterYaml(
  yamlContent: string,
): Record<string, unknown> | null {
  if (!yamlContent.trim()) return {};
  try {
    const document = parseDocument(yamlContent, {
      schema: "core",
      strict: true,
      uniqueKeys: true,
    });
    if (document.errors.length > 0 || document.warnings.length > 0) return null;
    const value: unknown = document.toJS({ maxAliasCount: 50 });
    return isPlainRecord(value)
      ? Object.fromEntries(Object.entries(value))
      : null;
  } catch {
    return null;
  }
}

/** Parse a SKILL.md document using the YAML core schema. */
export function parseSkillMd(content: string): ParsedSkillMd | null {
  if (!content || typeof content !== "string") return null;
  const opening = content.match(FRONTMATTER_MARKER);
  if (!opening) {
    return {
      frontmatter: { name: "" },
      rawFrontmatter: {},
      body: content.trim(),
      raw: content,
    };
  }

  const remainder = content.slice(opening[0].length);
  const closing = CLOSING_MARKER.exec(remainder);
  if (!closing) return null;
  const yamlContent = remainder.slice(0, closing.index).replace(/\r?\n$/, "");
  const rawFrontmatter = parseFrontmatterYaml(yamlContent);
  if (!rawFrontmatter) return null;
  const body = remainder.slice(closing.index + closing[0].length).trim();
  return {
    frontmatter: normalizeFrontmatter(rawFrontmatter),
    rawFrontmatter,
    body,
    raw: content,
  };
}

function setOptional(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    delete target[key];
    return;
  }
  target[key] = value;
}

function orderFrontmatter(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of STANDARD_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      ordered[key] = source[key];
    }
  }
  for (const [key, value] of Object.entries(source)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key))
      ordered[key] = value;
  }
  return ordered;
}

function canonicalizeYamlValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeYamlValue);
  }
  if (!isPlainRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalizeYamlValue(value[key])]),
  );
}

/** Normalize a SKILL.md by YAML semantics for stable content hashing. */
export function normalizeSkillMdForHash(content: string): string {
  const normalized = content.replace(/\r\n?/g, "\n");
  const parsed = parseSkillMd(normalized);
  if (!parsed || !FRONTMATTER_MARKER.test(normalized)) {
    return normalized.trimEnd();
  }
  const yamlContent = stringify(canonicalizeYamlValue(parsed.rawFrontmatter), {
    lineWidth: 0,
  }).trimEnd();
  return `---\n${yamlContent}\n---\n${parsed.body}`.trimEnd();
}

/** Serialize SKILL.md while retaining file-owned and extension frontmatter. */
export function serializeSkillMd(input: SerializeSkillMdInput): string {
  const parsedInstructions = parseSkillMd(input.instructions ?? "");
  const body = parsedInstructions?.body ?? input.instructions?.trim() ?? "";
  const preserved =
    input.preservedFrontmatter ?? parsedInstructions?.rawFrontmatter ?? {};
  const frontmatter: Record<string, unknown> = { ...preserved };

  frontmatter.name = input.name;
  if (Object.prototype.hasOwnProperty.call(input, "description")) {
    setOptional(frontmatter, "description", input.description);
  }
  if (Object.prototype.hasOwnProperty.call(input, "version")) {
    setOptional(frontmatter, "version", input.version);
  }
  if (Object.prototype.hasOwnProperty.call(input, "author")) {
    setOptional(frontmatter, "author", input.author);
  }
  if (Object.prototype.hasOwnProperty.call(input, "license")) {
    setOptional(frontmatter, "license", input.license);
  }
  if (Object.prototype.hasOwnProperty.call(input, "tags")) {
    setOptional(frontmatter, "tags", input.tags);
  }
  if (input.compatibility !== undefined) {
    const compatibility = Array.isArray(input.compatibility)
      ? input.compatibility
      : [input.compatibility];
    setOptional(frontmatter, "compatibility", compatibility);
  } else if (
    !Object.prototype.hasOwnProperty.call(frontmatter, "compatibility")
  ) {
    frontmatter.compatibility = ["prompthub"];
  }
  if (input.metadata !== undefined) frontmatter.metadata = input.metadata;
  if (input.allowedTools !== undefined) {
    frontmatter["allowed-tools"] = input.allowedTools;
  }

  const yamlContent = stringify(orderFrontmatter(frontmatter), {
    lineWidth: 0,
  }).trimEnd();
  return `---\n${yamlContent}\n---\n${body}`;
}
