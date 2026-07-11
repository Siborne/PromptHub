import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Skill,
  SkillInstallMode,
  SkillProject,
} from "@prompthub/shared/types";
import { useSettingsStore } from "../../stores/settings.store";
import { useSkillStore } from "../../stores/skill.store";
import { useToast } from "../ui/Toast";
import {
  getDeployedProjectSkillTargets,
  getDeployableProjectTargetDirs,
  getProjectTargetDirsRequiringDeployment,
  type ProjectDeployedSkillTarget,
} from "../../services/project-skill-targets";
import { getErrorMessage } from "./detail-utils";

const OPEN_CREATE_SKILL_PROJECT_MODAL_EVENT = "open-create-skill-project-modal";

export function getProjectDeployTargets(project: SkillProject): string[] {
  const configured = Array.isArray(project.deployTargets)
    ? project.deployTargets.filter(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
  if (configured.length > 0) return Array.from(new Set(configured));

  const normalizedRoot = project.rootPath.replace(/[\\/]+$/, "");
  return normalizedRoot ? [`${normalizedRoot}/.agents/skills`] : [];
}

export function useSkillProjectDistribution(selectedSkill: Skill | null) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const skillProjects = useSettingsStore((state) => state.skillProjects);
  const preferredMode = useSettingsStore(
    (state) => state.projectSkillImportModePreference,
  );
  const setPreferredMode = useSettingsStore(
    (state) => state.setProjectSkillImportModePreference,
  );
  const updateSkillProject = useSettingsStore(
    (state) => state.updateSkillProject,
  );
  const projectScanState = useSkillStore((state) => state.projectScanState);
  const scanProjectSkills = useSkillStore((state) => state.scanProjectSkills);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployMode, setDeployMode] = useState<SkillInstallMode>(preferredMode);
  const [deleteDistributionSummary, setDeleteDistributionSummary] = useState({
    hasCopy: false,
    hasSymlink: false,
  });
  const [pendingRemoval, setPendingRemoval] = useState<{
    project: SkillProject;
    targets: ProjectDeployedSkillTarget[];
  } | null>(null);
  const deployInFlightRef = useRef(false);
  const removalInFlightRef = useRef(false);

  useEffect(() => setDeployMode(preferredMode), [preferredMode]);

  const openCreateProjectModal = () => {
    useSkillStore.getState().setStoreView("projects");
    document.dispatchEvent(new Event(OPEN_CREATE_SKILL_PROJECT_MODAL_EVENT));
  };

  const getDeployedTargets = (project: SkillProject) => {
    if (!selectedSkill) return [];
    return getDeployedProjectSkillTargets(
      projectScanState[project.id]?.scannedSkills ?? [],
      selectedSkill.name,
      getProjectDeployTargets(project),
    );
  };

  const getAllDeployedTargets = () =>
    skillProjects.flatMap((project) =>
      getDeployedTargets(project).map((target) => ({ project, target })),
    );

  const setProjectDeployMode = (mode: SkillInstallMode) => {
    setDeployMode(mode);
    setPreferredMode(mode);
  };

  const deployToProjects = async (
    projectIds: string[],
    targetDirsByProjectId?: Record<string, string[]>,
  ) => {
    if (
      !selectedSkill ||
      projectIds.length === 0 ||
      deployInFlightRef.current
    ) {
      return;
    }
    const projects = skillProjects.filter((project) =>
      projectIds.includes(project.id),
    );
    const targets = projects.map((project) => ({
      project,
      targetDirs:
        targetDirsByProjectId?.[project.id] ?? getProjectDeployTargets(project),
    }));
    if (!targets.some(({ targetDirs }) => targetDirs.length > 0)) {
      showToast(
        t(
          "skill.projectDeployNoTargets",
          "Selected projects do not have any deploy target folders yet.",
        ),
        "error",
      );
      return;
    }

    deployInFlightRef.current = true;
    setIsDeploying(true);
    try {
      await deploySelectedProjectTargets({
        selectedSkill,
        projects,
        targets,
        deployMode,
        projectScanState,
        scanProjectSkills,
        updateSkillProject,
        showToast,
        t,
      });
    } catch (error) {
      showToast(
        t("skill.projectDeployFailed", {
          reason: getErrorMessage(error),
          defaultValue: "Failed to deploy project skill: {{reason}}",
        }),
        "error",
      );
    } finally {
      deployInFlightRef.current = false;
      setIsDeploying(false);
    }
  };

  const requestRemove = (
    projectId: string,
    targets: ProjectDeployedSkillTarget[],
  ) => {
    const project = skillProjects.find((entry) => entry.id === projectId);
    if (project && targets.length > 0) setPendingRemoval({ project, targets });
  };

  const inspectDeleteDistribution = async () => {
    const targets = getAllDeployedTargets();
    if (targets.length === 0) return;
    const statuses = await Promise.all(
      targets.map(({ target }) =>
        window.api.skill.getLocalPathStatus(target.localPath),
      ),
    );
    setDeleteDistributionSummary({
      hasCopy: statuses.some(
        (status) => status.exists && status.mode !== "symlink",
      ),
      hasSymlink: statuses.some(
        (status) => status.exists && status.mode === "symlink",
      ),
    });
  };

  const confirmRemove = async () => {
    if (!pendingRemoval || removalInFlightRef.current) return;
    const { project, targets } = pendingRemoval;
    removalInFlightRef.current = true;
    setIsDeploying(true);
    try {
      await Promise.all(
        targets.map((target) =>
          window.api.skill.deleteLocalFileByPath(target.localPath, "."),
        ),
      );
      showToast(
        t("skill.projectRemoveDistributionSuccess", {
          count: targets.length,
          defaultValue: "Removed from {{count}} project folder(s).",
        }),
        "success",
      );
      await scanProjectSkills(project);
      updateSkillProject(project.id, { lastScannedAt: Date.now() });
    } catch (error) {
      showToast(
        t("skill.projectRemoveDistributionFailed", {
          reason: getErrorMessage(error),
          defaultValue: "Failed to remove project skill: {{reason}}",
        }),
        "error",
      );
    } finally {
      removalInFlightRef.current = false;
      setIsDeploying(false);
      setPendingRemoval(null);
    }
  };

  return {
    cancelPendingRemoval: () => setPendingRemoval(null),
    confirmRemove,
    deleteDistributionSummary,
    deployMode,
    deployToProjects,
    getAllDeployedTargets,
    getDeployedTargets,
    inspectDeleteDistribution,
    isDeploying,
    openCreateProjectModal,
    pendingRemoval,
    requestRemove,
    resetDeleteDistributionSummary: () =>
      setDeleteDistributionSummary({ hasCopy: false, hasSymlink: false }),
    setProjectDeployMode,
    skillProjects,
  };
}

interface DeploySelectedProjectTargetsInput {
  selectedSkill: Skill;
  projects: SkillProject[];
  targets: Array<{ project: SkillProject; targetDirs: string[] }>;
  deployMode: SkillInstallMode;
  projectScanState: ReturnType<
    typeof useSkillStore.getState
  >["projectScanState"];
  scanProjectSkills: ReturnType<
    typeof useSkillStore.getState
  >["scanProjectSkills"];
  updateSkillProject: ReturnType<
    typeof useSettingsStore.getState
  >["updateSkillProject"];
  showToast: ReturnType<typeof useToast>["showToast"];
  t: ReturnType<typeof useTranslation>["t"];
}

async function deploySelectedProjectTargets({
  selectedSkill,
  projects,
  targets,
  deployMode,
  projectScanState,
  scanProjectSkills,
  updateSkillProject,
  showToast,
  t,
}: DeploySelectedProjectTargetsInput) {
  const repoPath = await window.api.skill.getRepoPath(selectedSkill.id);
  if (!repoPath) {
    showToast(
      t("skill.projectDeployMissingSource", "Missing local skill source path."),
      "error",
    );
    return;
  }
  const deployableTargets = targets.map(({ project, targetDirs }) => ({
    project,
    targetDirs: getDeployableProjectTargetDirs(
      repoPath,
      selectedSkill.name,
      targetDirs,
    ),
  }));
  if (!deployableTargets.some(({ targetDirs }) => targetDirs.length > 0)) {
    showToast(
      t(
        "skill.projectDeployAlreadyAtTarget",
        "This skill is already inside the selected project target folders.",
      ),
      "warning",
    );
    return;
  }
  const jobs = deployableTargets.flatMap(({ project, targetDirs }) =>
    getProjectTargetDirsRequiringDeployment(
      projectScanState[project.id]?.scannedSkills ?? [],
      selectedSkill,
      targetDirs,
    ).map((targetDir) => ({ project, targetDir })),
  );
  if (jobs.length === 0) {
    showToast(
      t(
        "skill.projectImportAlreadyExists",
        "Selected skills are already imported into the selected project folders.",
      ),
      "warning",
    );
    return;
  }
  await Promise.all(
    jobs.map(({ targetDir }) =>
      window.api.skill.copyRepoByPathToDirectory(
        repoPath,
        selectedSkill.name,
        targetDir,
        { ifExists: "overwrite", mode: deployMode },
      ),
    ),
  );
  showToast(
    t("skill.projectDeploySuccess", {
      count: jobs.length,
      mode:
        deployMode === "symlink"
          ? t("skill.symlink", "Symlink")
          : t("skill.copyMode", "Copy"),
      defaultValue: "Deployed to {{count}} project folder(s).",
    }),
    "success",
  );
  void Promise.all(
    projects.map(async (project) => {
      await scanProjectSkills(project);
      updateSkillProject(project.id, { lastScannedAt: Date.now() });
    }),
  ).catch(() => {
    showToast(
      t(
        "skill.projectImportLibraryRescanFailed",
        "Import completed, but PromptHub could not refresh the project list. Please rescan manually.",
      ),
      "warning",
    );
  });
}
