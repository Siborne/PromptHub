import fs from "fs";

export interface CanonicalMetadataMigrationOptions<T> {
  canonical: T;
  supersededPath: string;
  cleanupPaths?: string[];
  isPopulated: (value: T) => boolean;
  readSuperseded: () => T;
  publish: (value: T) => void;
  rereadCanonical: () => T;
  unsafePathMessage: string;
}

function removeSupersededFiles(
  filePaths: string[],
  unsafePathMessage: string,
): void {
  const existingPaths = filePaths.filter((filePath) => fs.existsSync(filePath));
  for (const filePath of existingPaths) {
    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(unsafePathMessage);
    }
  }
  for (const filePath of existingPaths) fs.unlinkSync(filePath);
}

export function readCanonicalWithMetadataMigration<T>(
  options: CanonicalMetadataMigrationOptions<T>,
): T {
  if (!fs.existsSync(options.supersededPath)) return options.canonical;
  const cleanupPaths = [
    options.supersededPath,
    ...(options.cleanupPaths ?? []),
  ];
  if (options.isPopulated(options.canonical)) {
    removeSupersededFiles(cleanupPaths, options.unsafePathMessage);
    return options.canonical;
  }
  const superseded = options.readSuperseded();
  if (!options.isPopulated(superseded)) {
    removeSupersededFiles(cleanupPaths, options.unsafePathMessage);
    return options.canonical;
  }
  options.publish(superseded);
  const migrated = options.rereadCanonical();
  removeSupersededFiles(cleanupPaths, options.unsafePathMessage);
  return migrated;
}
