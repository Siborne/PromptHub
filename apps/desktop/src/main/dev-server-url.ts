export function normalizeDesktopDevServerUrl(
  value: string | undefined,
): string | undefined {
  if (!value) return undefined;

  const url = new URL(value);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return url.toString();
}
