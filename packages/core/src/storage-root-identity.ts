import crypto from "node:crypto";
import path from "node:path";

export function deriveStorageRootIdentity(activeRoot: string): string {
  return crypto
    .createHash("sha256")
    .update(path.resolve(activeRoot))
    .digest("hex");
}
