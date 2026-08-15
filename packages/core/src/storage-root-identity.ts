import crypto from "node:crypto";
import path from "node:path";

export function deriveStorageRootIdentity(activeRoot: string): string {
  return crypto
    .createHash("sha256")
    .update(path.resolve(activeRoot))
    .digest("hex");
}

export function localResourceDeviceIdFromRootIdentity(
  rootIdentity: string,
): string {
  if (!/^[a-f0-9]{64}$/u.test(rootIdentity)) {
    throw new Error("Storage root identity is invalid");
  }
  return `device-${rootIdentity.slice(0, 32)}`;
}

export function deriveLocalResourceDeviceId(activeRoot: string): string {
  return localResourceDeviceIdFromRootIdentity(
    deriveStorageRootIdentity(activeRoot),
  );
}
