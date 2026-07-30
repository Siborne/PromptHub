import { createNativeCommandRunner } from "./native-command";

const KIMI_CONFIG_VALIDATION_OPTIONS = {
  timeout: 15_000,
  maxBuffer: 64 * 1024,
};

export async function validateKimiConfigFile(
  targetPath: string,
): Promise<void> {
  const runner = createNativeCommandRunner();
  const executable = await runner.resolve("kimi");
  if (!executable) return;
  await runner.run(
    executable,
    ["doctor", "config", targetPath],
    KIMI_CONFIG_VALIDATION_OPTIONS,
  );
}
