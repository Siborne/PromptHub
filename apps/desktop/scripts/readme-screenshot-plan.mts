export const README_DESKTOP_MODULES = [
  "prompt",
  "skill",
  "mcp",
  "plugin",
  "rules",
] as const;

export type ReadmeDesktopModule = (typeof README_DESKTOP_MODULES)[number];

export const README_DESKTOP_SCREENSHOTS: Record<
  ReadmeDesktopModule,
  readonly string[]
> = {
  prompt: ["1-index.png", "15-quick-add-ai.png", "17-appearance-motion.png"],
  skill: [
    "10-skill-store.png",
    "11-skill-platform-install.png",
    "14-skill-projects.png",
  ],
  mcp: ["18-mcp-workspace.png"],
  plugin: ["19-plugin-workspace.png"],
  rules: ["13-rules-workspace.png"],
};

export const README_DESKTOP_SCREENSHOT_FILENAMES =
  README_DESKTOP_MODULES.flatMap((module) => README_DESKTOP_SCREENSHOTS[module]);

export function getScreenshotPlanMismatch(capturedFilenames: readonly string[]): {
  missing: string[];
  unlisted: string[];
} {
  return {
    missing: README_DESKTOP_SCREENSHOT_FILENAMES.filter(
      (filename) => !capturedFilenames.includes(filename),
    ),
    unlisted: capturedFilenames.filter(
      (filename) => !README_DESKTOP_SCREENSHOT_FILENAMES.includes(filename),
    ),
  };
}
