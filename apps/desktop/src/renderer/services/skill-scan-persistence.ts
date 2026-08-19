import type {
  ScannedSkill,
  SkillPlatformScanResult,
} from "@prompthub/shared/types";

export interface ProjectSkillScanState {
  scannedSkills: ScannedSkill[];
  isScanning: boolean;
  scannedAt?: number;
  error?: string | null;
}

export interface AgentSkillScanState {
  result: SkillPlatformScanResult | null;
  isScanning: boolean;
  scannedAt?: number;
  error?: string | null;
}

export function sanitizePersistedProjectScanState(
  stateByProject: Record<string, ProjectSkillScanState>,
): Record<string, ProjectSkillScanState> {
  return Object.fromEntries(
    Object.entries(stateByProject)
      .filter(([, state]) => Boolean(state))
      .map(([projectId, state]) => [
        projectId,
        {
          scannedSkills: Array.isArray(state.scannedSkills)
            ? state.scannedSkills.map((skill) => ({
                ...skill,
                instructions: "",
              }))
            : [],
          isScanning: false,
          scannedAt: state.scannedAt,
          error: state.error ?? null,
        },
      ]),
  );
}

export function sanitizePersistedAgentScanState(
  _stateByAgent: Record<string, AgentSkillScanState>,
): Record<string, AgentSkillScanState> {
  return {};
}
