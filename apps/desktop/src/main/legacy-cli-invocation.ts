export const LEGACY_DESKTOP_CLI_EXIT_CODE = 2;

const LEGACY_DESKTOP_CLI_MESSAGE = [
  "The desktop --cli entry is retired; PromptHub Desktop was not started.",
  "Install the standalone PromptHub CLI from Settings > CLI, then run the prompthub command again.",
  "桌面版 --cli 入口已停用；请在设置 > CLI 中安装独立命令行工具后重试。",
].join("\n");

export function handleLegacyDesktopCliInvocation(options: {
  argv: string[];
  exit: (code: number) => void;
  writeError: (message: string) => void;
}): boolean {
  if (!options.argv.includes("--cli")) {
    return false;
  }
  options.writeError(`${LEGACY_DESKTOP_CLI_MESSAGE}\n`);
  options.exit(LEGACY_DESKTOP_CLI_EXIT_CODE);
  return true;
}
