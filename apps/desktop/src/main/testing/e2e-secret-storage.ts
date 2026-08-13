interface E2ESecretStorage {
  isEncryptionAvailable(): boolean;
  setUsePlainTextEncryption(usePlainText: boolean): void;
}

export function configureE2ESecretStorage(
  storage: E2ESecretStorage,
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (
    env.PROMPTHUB_E2E !== "1" ||
    platform !== "linux" ||
    storage.isEncryptionAvailable()
  ) {
    return false;
  }

  storage.setUsePlainTextEncryption(true);
  return true;
}
