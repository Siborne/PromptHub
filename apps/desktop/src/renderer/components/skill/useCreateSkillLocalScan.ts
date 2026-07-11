import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { TFunction } from "i18next";
import type {
  ScannedSkill,
  Skill,
  SkillInstallMode,
} from "@prompthub/shared/types/skill";
import type { SkillState } from "../../stores/skill/skill-store-types";
import { matchScannedSkillToLibrary } from "../../services/skill-scan-status";
import { isCompleteImport } from "./create-skill-modal-utils";

type ErrorSetter = Dispatch<SetStateAction<string | null>>;
type BooleanSetter = Dispatch<SetStateAction<boolean>>;
type AnnotatedScannedSkill = ScannedSkill & { isImported: boolean };

interface LocalScanOptions {
  existingSkills: Skill[];
  importScannedSkills: SkillState["importScannedSkills"];
  setError: ErrorSetter;
  setIsLoading: BooleanSetter;
  t: TFunction;
}

export function useCreateSkillLocalScan({
  existingSkills,
  importScannedSkills,
  setError,
  setIsLoading,
  t,
}: LocalScanOptions) {
  const [scanResults, setScanResults] = useState<ScannedSkill[]>([]);
  const [selectedScanItems, setSelectedScanItems] = useState<Set<string>>(
    new Set(),
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [importingCount, setImportingCount] = useState(0);
  const [scanImportNotice, setScanImportNotice] = useState<string | null>(null);
  const [scanSearchQuery, setScanSearchQuery] = useState("");
  const [scanRootPaths, setScanRootPaths] = useState<string[]>([]);
  const [showScanOptionalTags, setShowScanOptionalTags] = useState(false);
  const [scanImportMode, setScanImportMode] =
    useState<SkillInstallMode>("copy");
  const [scanTagDrafts, setScanTagDrafts] = useState<Record<string, string[]>>(
    {},
  );
  const [scanTagInputs, setScanTagInputs] = useState<Record<string, string>>(
    {},
  );
  const annotatedScanResults = useMemo(
    () => annotateScannedSkills(scanResults, existingSkills),
    [existingSkills, scanResults],
  );
  const selectableScanResults = useMemo(
    () => annotatedScanResults.filter((skill) => !skill.isImported),
    [annotatedScanResults],
  );
  const visibleAnnotatedScanResults = useMemo(
    () => filterScannedSkills(annotatedScanResults, scanSearchQuery),
    [annotatedScanResults, scanSearchQuery],
  );
  const visibleSelectableScanResults = useMemo(
    () => visibleAnnotatedScanResults.filter((skill) => !skill.isImported),
    [visibleAnnotatedScanResults],
  );
  const importedScanCount =
    annotatedScanResults.length - selectableScanResults.length;
  const reset = useCallback(() => {
    setScanResults([]);
    setSelectedScanItems(new Set());
    setIsScanning(false);
    setScanDone(false);
    setImportingCount(0);
    setScanImportNotice(null);
    setScanSearchQuery("");
    setScanRootPaths([]);
    setShowScanOptionalTags(false);
    setScanImportMode("copy");
    setScanTagDrafts({});
    setScanTagInputs({});
  }, []);
  const handleScanLocal = useCallback(
    (paths: string[]) =>
      scanLocalSkills({
        existingSkills,
        paths,
        setError,
        setIsScanning,
        setScanDone,
        setScanImportNotice,
        setScanResults,
        setScanRootPaths,
        setScanTagDrafts,
        setScanTagInputs,
        setSelectedScanItems,
        t,
      }),
    [existingSkills, setError, t],
  );
  const toggleScanItem = useCallback((path: string) => {
    setSelectedScanItems((items) => toggleSelection(items, path));
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelectedScanItems((items) =>
      toggleVisibleSelections(items, visibleSelectableScanResults),
    );
  }, [visibleSelectableScanResults]);
  const handleAddScanTag = useCallback(
    (path: string) => {
      addScanTag(path, scanTagInputs, setScanTagDrafts, setScanTagInputs);
    },
    [scanTagInputs],
  );
  const handleRemoveScanTag = useCallback((path: string, tag: string) => {
    setScanTagDrafts((drafts) => removeScanTag(drafts, path, tag));
  }, []);
  const importSelected = useCallback(
    () =>
      importSelectedScannedSkills({
        annotatedScanResults,
        importScannedSkills,
        scanImportMode,
        scanTagDrafts,
        selectedScanItems,
        setError,
        setImportingCount,
        setIsLoading,
        setScanImportNotice,
        t,
      }),
    [
      annotatedScanResults,
      importScannedSkills,
      scanImportMode,
      scanTagDrafts,
      selectedScanItems,
      setError,
      setIsLoading,
      t,
    ],
  );
  return {
    selectedScanItems,
    isScanning,
    scanDone,
    importingCount,
    scanImportNotice,
    scanSearchQuery,
    setScanSearchQuery,
    scanRootPaths,
    showScanOptionalTags,
    setShowScanOptionalTags,
    scanImportMode,
    setScanImportMode,
    scanTagDrafts,
    scanTagInputs,
    setScanTagInputs,
    annotatedScanResults,
    selectableScanResults,
    visibleAnnotatedScanResults,
    visibleSelectableScanResults,
    importedScanCount,
    reset,
    handleScanLocal,
    toggleScanItem,
    toggleSelectAll,
    handleAddScanTag,
    handleRemoveScanTag,
    importSelected,
  };
}

function annotateScannedSkills(
  scannedSkills: ScannedSkill[],
  existingSkills: Skill[],
): AnnotatedScannedSkill[] {
  return scannedSkills.map((skill) => ({
    ...skill,
    isImported: Boolean(matchScannedSkillToLibrary(skill, existingSkills)),
  }));
}

function filterScannedSkills(
  skills: AnnotatedScannedSkill[],
  searchQuery: string,
): AnnotatedScannedSkill[] {
  const query = searchQuery.trim().toLowerCase();
  return query
    ? skills.filter((skill) =>
        getSearchableValues(skill).some((value) =>
          value?.toLowerCase().includes(query),
        ),
      )
    : skills;
}

function getSearchableValues(skill: ScannedSkill): Array<string | undefined> {
  return [
    skill.name,
    skill.description,
    skill.author,
    skill.localPath,
    ...skill.tags,
    ...skill.platforms,
  ];
}

async function scanLocalSkills({
  existingSkills,
  paths,
  setError,
  setIsScanning,
  setScanDone,
  setScanImportNotice,
  setScanResults,
  setScanRootPaths,
  setScanTagDrafts,
  setScanTagInputs,
  setSelectedScanItems,
  t,
}: {
  existingSkills: Skill[];
  paths: string[];
  setError: ErrorSetter;
  setIsScanning: BooleanSetter;
  setScanDone: BooleanSetter;
  setScanImportNotice: Dispatch<SetStateAction<string | null>>;
  setScanResults: Dispatch<SetStateAction<ScannedSkill[]>>;
  setScanRootPaths: Dispatch<SetStateAction<string[]>>;
  setScanTagDrafts: Dispatch<SetStateAction<Record<string, string[]>>>;
  setScanTagInputs: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedScanItems: Dispatch<SetStateAction<Set<string>>>;
  t: TFunction;
}) {
  resetScanResultState(paths, {
    setError,
    setScanDone,
    setScanImportNotice,
    setScanResults,
    setScanRootPaths,
    setScanTagDrafts,
    setScanTagInputs,
    setSelectedScanItems,
  });
  setIsScanning(true);
  try {
    const results = await window.api.skill.scanLocalPreview(paths);
    applyScanResults(results, existingSkills, {
      setError,
      setScanDone,
      setScanResults,
      setSelectedScanItems,
      t,
    });
  } catch (error) {
    setError(t("skill.scanFailed", "Failed to scan: ") + String(error));
  } finally {
    setIsScanning(false);
  }
}

function resetScanResultState(
  paths: string[],
  setters: {
    setError: ErrorSetter;
    setScanDone: BooleanSetter;
    setScanImportNotice: Dispatch<SetStateAction<string | null>>;
    setScanResults: Dispatch<SetStateAction<ScannedSkill[]>>;
    setScanRootPaths: Dispatch<SetStateAction<string[]>>;
    setScanTagDrafts: Dispatch<SetStateAction<Record<string, string[]>>>;
    setScanTagInputs: Dispatch<SetStateAction<Record<string, string>>>;
    setSelectedScanItems: Dispatch<SetStateAction<Set<string>>>;
  },
) {
  setters.setScanRootPaths(paths);
  setters.setScanDone(false);
  setters.setError(null);
  setters.setScanImportNotice(null);
  setters.setScanResults([]);
  setters.setSelectedScanItems(new Set());
  setters.setScanTagDrafts({});
  setters.setScanTagInputs({});
}

function applyScanResults(
  results: ScannedSkill[],
  existingSkills: Skill[],
  {
    setError,
    setScanDone,
    setScanResults,
    setSelectedScanItems,
    t,
  }: {
    setError: ErrorSetter;
    setScanDone: BooleanSetter;
    setScanResults: Dispatch<SetStateAction<ScannedSkill[]>>;
    setSelectedScanItems: Dispatch<SetStateAction<Set<string>>>;
    t: TFunction;
  },
) {
  const uninstalled = results.filter(
    (skill) => !matchScannedSkillToLibrary(skill, existingSkills),
  );
  setScanResults(results);
  setSelectedScanItems(new Set(uninstalled.map((skill) => skill.filePath)));
  setScanDone(true);
  setError(getScanResultError(results, uninstalled.length, t));
}

function getScanResultError(
  results: ScannedSkill[],
  uninstalledCount: number,
  t: TFunction,
): string | null {
  if (!results.length)
    return t("skill.noSkillsFound", "No new local SKILL.md files found.");
  return uninstalledCount
    ? null
    : t(
        "skill.allAlreadyImported",
        "All found skills already exist in your library.",
      );
}

function toggleSelection(selection: Set<string>, value: string): Set<string> {
  const next = new Set(selection);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function toggleVisibleSelections(
  selectedItems: Set<string>,
  visibleSkills: AnnotatedScannedSkill[],
): Set<string> {
  if (!visibleSkills.length) return selectedItems;
  const next = new Set(selectedItems);
  const allSelected = visibleSkills.every((skill) => next.has(skill.filePath));
  visibleSkills.forEach((skill) =>
    allSelected ? next.delete(skill.filePath) : next.add(skill.filePath),
  );
  return next;
}

function addScanTag(
  path: string,
  inputs: Record<string, string>,
  setDrafts: Dispatch<SetStateAction<Record<string, string[]>>>,
  setInputs: Dispatch<SetStateAction<Record<string, string>>>,
) {
  const tag = (inputs[path] || "").trim().toLowerCase();
  if (!tag) return;
  setDrafts((drafts) => appendUniqueTag(drafts, path, tag));
  setInputs((current) => ({ ...current, [path]: "" }));
}

function appendUniqueTag(
  drafts: Record<string, string[]>,
  path: string,
  tag: string,
): Record<string, string[]> {
  const tags = drafts[path] || [];
  return tags.includes(tag) ? drafts : { ...drafts, [path]: [...tags, tag] };
}

function removeScanTag(
  drafts: Record<string, string[]>,
  path: string,
  tag: string,
): Record<string, string[]> {
  return {
    ...drafts,
    [path]: (drafts[path] || []).filter((item) => item !== tag),
  };
}

async function importSelectedScannedSkills({
  annotatedScanResults,
  importScannedSkills,
  scanImportMode,
  scanTagDrafts,
  selectedScanItems,
  setError,
  setImportingCount,
  setIsLoading,
  setScanImportNotice,
  t,
}: {
  annotatedScanResults: AnnotatedScannedSkill[];
  importScannedSkills: SkillState["importScannedSkills"];
  scanImportMode: SkillInstallMode;
  scanTagDrafts: Record<string, string[]>;
  selectedScanItems: Set<string>;
  setError: ErrorSetter;
  setImportingCount: Dispatch<SetStateAction<number>>;
  setIsLoading: BooleanSetter;
  setScanImportNotice: Dispatch<SetStateAction<string | null>>;
  t: TFunction;
}): Promise<boolean> {
  const skills = annotatedScanResults.filter(
    (skill) => !skill.isImported && selectedScanItems.has(skill.filePath),
  );
  if (!skills.length) return false;
  setIsLoading(true);
  setError(null);
  setScanImportNotice(null);
  setImportingCount(0);
  try {
    const result = await importScannedSkills(
      skills,
      getUserTagsByPath(skills, scanTagDrafts),
      scanImportMode,
    );
    setImportingCount(result.importedCount);
    if (
      isCompleteImport(
        result.importedCount,
        result.skipped.length,
        result.failed.length,
      )
    )
      return true;
    setScanResultFeedback(
      result,
      skills.length,
      setError,
      setScanImportNotice,
      t,
    );
    return false;
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : t("skill.importFailed", "Failed to import skills"),
    );
    return false;
  } finally {
    setIsLoading(false);
  }
}

function getUserTagsByPath(
  skills: ScannedSkill[],
  tagsByPath: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    skills.map((skill) => [skill.localPath, tagsByPath[skill.localPath] || []]),
  );
}

function setScanResultFeedback(
  result: Awaited<ReturnType<SkillState["importScannedSkills"]>>,
  total: number,
  setError: ErrorSetter,
  setNotice: Dispatch<SetStateAction<string | null>>,
  t: TFunction,
) {
  if (!result.importedCount && !result.failed.length && result.skipped.length) {
    setError(
      t(
        "skill.allDuplicates",
        "All selected skills already exist in your library.",
      ),
    );
    return;
  }
  const summary = t(
    "skill.scanImportSummary",
    "Imported {{imported}} / {{total}}, skipped {{skipped}}, failed {{failed}}.",
  )
    .replace("{{imported}}", String(result.importedCount))
    .replace("{{total}}", String(total))
    .replace("{{skipped}}", String(result.skipped.length))
    .replace("{{failed}}", String(result.failed.length));
  const details = [...result.skipped, ...result.failed]
    .slice(0, 3)
    .map((item) => `${item.name}: ${item.reason}`);
  setNotice(details.length ? `${summary} ${details.join(" | ")}` : summary);
}
