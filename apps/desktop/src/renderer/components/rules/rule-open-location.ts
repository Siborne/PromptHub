export interface RuleOpenPathResult {
  success: boolean;
  error?: string;
}

export type RuleOpenPath = (
  path: string,
) => Promise<RuleOpenPathResult | undefined>;

export async function revealRuleFile(
  filePath: string,
  openPath: RuleOpenPath | undefined,
): Promise<RuleOpenPathResult> {
  if (!openPath) {
    return { success: false, error: "Shell bridge is unavailable" };
  }

  try {
    const result = await openPath(filePath);
    return result && typeof result.success === "boolean"
      ? result
      : { success: false, error: "Shell did not return a result" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
