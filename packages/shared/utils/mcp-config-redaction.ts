type McpTomlRedactionOptions = {
  redactedValue: string;
  isReference: (value: string) => boolean;
};

/** Redact literal values in TOML inline maps while retaining references. */
export function redactMcpTomlConfigContent(
  content: string,
  options: McpTomlRedactionOptions,
): string {
  const assignmentPattern = /(?:env|http_headers)\s*=\s*\{/g;
  let output = "";
  let cursor = 0;
  let match = assignmentPattern.exec(content);

  while (match) {
    const openBrace = assignmentPattern.lastIndex - 1;
    const closeBrace = findTomlClosingBrace(content, openBrace);
    if (closeBrace === -1) {
      return output + content.slice(cursor);
    }
    output += content.slice(cursor, openBrace + 1);
    output += redactMcpTomlInlineTableBody(
      content.slice(openBrace + 1, closeBrace),
      options,
    );
    output += "}";
    cursor = closeBrace + 1;
    assignmentPattern.lastIndex = cursor;
    match = assignmentPattern.exec(content);
  }

  return output + content.slice(cursor);
}

function findTomlClosingBrace(content: string, openBrace: number): number {
  let inString = false;
  let escaped = false;
  for (let index = openBrace + 1; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "}") {
      return index;
    }
  }
  return -1;
}

function redactMcpTomlInlineTableBody(
  body: string,
  options: McpTomlRedactionOptions,
): string {
  return splitTomlInlineEntries(body)
    .map((entry) => {
      const separatorIndex = findTomlAssignmentSeparator(entry);
      if (separatorIndex === -1) return entry;
      const rawValue = entry.slice(separatorIndex + 1).trim();
      if (!rawValue) return entry;
      const parsedValue = parseMcpTomlString(rawValue);
      const value = parsedValue ?? rawValue;
      if (typeof value !== "string") return entry;
      if (options.isReference(value)) return entry;
      const valueOffset = entry.indexOf(rawValue, separatorIndex + 1);
      return `${entry.slice(0, valueOffset)}${JSON.stringify(options.redactedValue)}`;
    })
    .join(",");
}

function splitTomlInlineEntries(body: string): string[] {
  const entries: string[] = [];
  let start = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === ",") {
      entries.push(body.slice(start, index));
      start = index + 1;
    }
  }
  entries.push(body.slice(start));
  return entries;
}

function findTomlAssignmentSeparator(entry: string): number {
  let inString = false;
  let escaped = false;
  for (let index = 0; index < entry.length; index += 1) {
    const char = entry[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "=") {
      return index;
    }
  }
  return -1;
}

function parseMcpTomlString(value: string): string | undefined {
  try {
    const parsed = JSON.parse(value.trim()) as unknown;
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}
