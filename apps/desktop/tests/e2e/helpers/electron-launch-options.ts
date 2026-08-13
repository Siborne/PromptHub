export function getElectronLaunchArgs(
  mainEntry: string,
  platform = process.platform,
  isCi = Boolean(process.env.CI),
): string[] {
  return platform === "linux" && isCi
    ? ["--no-sandbox", mainEntry]
    : [mainEntry];
}
