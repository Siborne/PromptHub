function decodeValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function lineKey(line: string): string | null {
  return (
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1] ?? null
  );
}

export function parseDotEnv(raw: string | null): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of raw?.split(/\r?\n/) ?? []) {
    const match =
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values.set(match[1], decodeValue(match[2]));
  }
  return values;
}

export function renderDotEnv(
  original: string | null,
  replacements: ReadonlyArray<readonly [key: string, value: string | null]>,
): string {
  const managedKeys = new Set(replacements.map(([key]) => key));
  const retained = (original ?? "").split(/\r?\n/).filter((line) => {
    const key = lineKey(line);
    return !key || !managedKeys.has(key);
  });
  while (retained.at(-1) === "") retained.pop();
  for (const [key, value] of replacements) {
    if (value !== null) retained.push(`${key}=${JSON.stringify(value)}`);
  }
  return retained.length > 0 ? `${retained.join("\n")}\n` : "";
}
