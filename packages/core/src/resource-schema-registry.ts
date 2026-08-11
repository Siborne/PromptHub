export type ResourceSchemaDocument = Record<string, unknown>;

export interface ResourceSchemaConverter {
  fromVersion: number;
  toVersion: number;
  convert: (document: ResourceSchemaDocument) => ResourceSchemaDocument;
}

export interface ResourceSchemaRegistration {
  resourceType: string;
  currentVersion: number;
  converters?: readonly ResourceSchemaConverter[];
}

export interface ResourceSchemaResolution {
  resourceType: string;
  sourceVersion: number;
  currentVersion: number;
  mode: "current" | "converted" | "read-only-newer";
  document: ResourceSchemaDocument;
}

type NormalizedResourceSchemaRegistration = Omit<
  ResourceSchemaRegistration,
  "converters"
> & {
  converters: readonly ResourceSchemaConverter[];
};

function positiveVersion(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function resourceType(value: string): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,63}$/u.test(value)) {
    throw new Error(`Invalid resource schema type: ${value}`);
  }
  return value;
}

export class ResourceSchemaRegistry {
  private readonly registrations = new Map<
    string,
    NormalizedResourceSchemaRegistration
  >();

  constructor(registrations: readonly ResourceSchemaRegistration[] = []) {
    for (const registration of registrations) this.register(registration);
  }

  register(registration: ResourceSchemaRegistration): void {
    const type = resourceType(registration.resourceType);
    const currentVersion = positiveVersion(
      registration.currentVersion,
      `${type} currentVersion`,
    );
    if (this.registrations.has(type)) {
      throw new Error(`Resource schema is already registered: ${type}`);
    }
    const converters = [...(registration.converters ?? [])].sort(
      (left, right) => left.fromVersion - right.fromVersion,
    );
    const seen = new Set<number>();
    for (const converter of converters) {
      const from = positiveVersion(
        converter.fromVersion,
        `${type} fromVersion`,
      );
      const to = positiveVersion(converter.toVersion, `${type} toVersion`);
      if (to !== from + 1 || to > currentVersion || seen.has(from)) {
        throw new Error(`Resource schema converter chain is invalid: ${type}`);
      }
      seen.add(from);
    }
    for (let version = 1; version < currentVersion; version += 1) {
      if (!seen.has(version)) {
        throw new Error(`Resource schema converter chain is invalid: ${type}`);
      }
    }
    this.registrations.set(
      type,
      Object.freeze({
        resourceType: type,
        currentVersion,
        converters: Object.freeze(converters),
      }),
    );
  }

  list(): ResourceSchemaRegistration[] {
    return [...this.registrations.values()]
      .sort((left, right) =>
        left.resourceType.localeCompare(right.resourceType),
      )
      .map((entry) => ({
        resourceType: entry.resourceType,
        currentVersion: entry.currentVersion,
        converters: [...entry.converters],
      }));
  }

  resolve(
    typeValue: string,
    schemaVersionValue: number,
    input: ResourceSchemaDocument,
  ): ResourceSchemaResolution {
    const type = resourceType(typeValue);
    const sourceVersion = positiveVersion(schemaVersionValue, "schemaVersion");
    const registration = this.registrations.get(type);
    if (!registration) throw new Error(`Unknown resource schema: ${type}`);
    const original = structuredClone(input);
    if (sourceVersion > registration.currentVersion) {
      return {
        resourceType: type,
        sourceVersion,
        currentVersion: registration.currentVersion,
        mode: "read-only-newer",
        document: original,
      };
    }
    let version = sourceVersion;
    let document = original;
    while (version < registration.currentVersion) {
      const converter = registration.converters.find(
        (candidate) => candidate.fromVersion === version,
      )!;
      document = structuredClone(converter.convert(structuredClone(document)));
      version = converter.toVersion;
    }
    return {
      resourceType: type,
      sourceVersion,
      currentVersion: registration.currentVersion,
      mode: sourceVersion === version ? "current" : "converted",
      document,
    };
  }
}

export function createCanonicalResourceSchemaRegistry(): ResourceSchemaRegistry {
  return new ResourceSchemaRegistry([
    { resourceType: "agent-provider", currentVersion: 1 },
    { resourceType: "generation", currentVersion: 1 },
    { resourceType: "mcp-server", currentVersion: 1 },
    { resourceType: "plugin", currentVersion: 1 },
    { resourceType: "prompt", currentVersion: 1 },
    { resourceType: "rule", currentVersion: 1 },
    { resourceType: "skill", currentVersion: 1 },
  ]);
}
