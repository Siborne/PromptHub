import Database from "./adapter";

export interface CanonicalResourceRecord {
  resourceType: string;
  resourceId: string;
  schemaVersion: number;
  revision: number;
  contentHash: string;
  manifestPath: string;
  updatedAt: string;
}

interface CanonicalResourceRow {
  resource_type: string;
  resource_id: string;
  schema_version: number;
  revision: number;
  content_hash: string;
  manifest_path: string;
  updated_at: string;
}

export class CanonicalResourceDB {
  constructor(private readonly db: Database.Database) {}

  replaceAll(records: readonly CanonicalResourceRecord[]): void {
    const identities = new Set<string>();
    for (const record of records) {
      const identity = `${record.resourceType}\0${record.resourceId}`;
      if (identities.has(identity)) {
        throw new Error(`Duplicate canonical resource: ${identity}`);
      }
      identities.add(identity);
    }
    this.db.transaction(() => {
      this.db.run("DELETE FROM canonical_resources");
      for (const record of records) this.insert(record);
    })();
  }

  list(resourceType?: string): CanonicalResourceRecord[] {
    const rows = (
      resourceType
        ? this.db.all(
            `SELECT * FROM canonical_resources
           WHERE resource_type = ?
           ORDER BY resource_id ASC`,
            resourceType,
          )
        : this.db.all(
            `SELECT * FROM canonical_resources
           ORDER BY resource_type ASC, resource_id ASC`,
          )
    ) as CanonicalResourceRow[];
    return rows.map((row) => ({
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      schemaVersion: row.schema_version,
      revision: row.revision,
      contentHash: row.content_hash,
      manifestPath: row.manifest_path,
      updatedAt: row.updated_at,
    }));
  }

  upsert(record: CanonicalResourceRecord): void {
    this.db.run(
      `INSERT INTO canonical_resources (
        resource_type, resource_id, schema_version, revision,
        content_hash, manifest_path, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(resource_type, resource_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        revision = excluded.revision,
        content_hash = excluded.content_hash,
        manifest_path = excluded.manifest_path,
        updated_at = excluded.updated_at`,
      record.resourceType,
      record.resourceId,
      record.schemaVersion,
      record.revision,
      record.contentHash,
      record.manifestPath,
      record.updatedAt,
    );
  }

  private insert(record: CanonicalResourceRecord): void {
    this.db.run(
      `INSERT INTO canonical_resources (
        resource_type, resource_id, schema_version, revision,
        content_hash, manifest_path, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      record.resourceType,
      record.resourceId,
      record.schemaVersion,
      record.revision,
      record.contentHash,
      record.manifestPath,
      record.updatedAt,
    );
  }
}
