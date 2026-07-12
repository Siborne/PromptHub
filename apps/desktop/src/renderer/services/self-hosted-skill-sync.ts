import type {
  Skill,
  SkillFileSnapshot,
  SkillVersion,
} from "@prompthub/shared/types/skill";

export interface MergedSkillSnapshots {
  skills: Skill[];
  skillVersions: SkillVersion[];
  skillFiles?: Record<string, SkillFileSnapshot[]>;
}

interface SkillSnapshotSource<T> {
  value: T;
  origin: "local" | "remote";
}

const SAFE_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/iu;

function isHttpUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPortableIconUrl(value: string | undefined): boolean {
  return (
    isHttpUrl(value) ||
    SAFE_IMAGE_DATA_URL_PATTERN.test(value?.trim() ?? "")
  );
}

function skillIdentity(skill: Skill): string {
  const sourceId = skill.source_id?.trim();
  if (sourceId) return `source:${sourceId}`;
  const fingerprint =
    skill.directory_fingerprint?.trim() ||
    skill.installed_directory_fingerprint?.trim() ||
    skill.installed_content_hash?.trim();
  if (fingerprint) return `fingerprint:${fingerprint}`;
  return `legacy-name:${skill.name.trim().toLocaleLowerCase()}`;
}

function toTimestamp(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldReplaceSkill(
  current: SkillSnapshotSource<Skill>,
  incoming: SkillSnapshotSource<Skill>,
): boolean {
  const incomingTime = toTimestamp(incoming.value.updated_at);
  const currentTime = toTimestamp(current.value.updated_at);
  return (
    incomingTime > currentTime ||
    (incomingTime === currentTime && incoming.origin === "remote")
  );
}

function mergeSkillRecords(
  localSkills: Skill[],
  remoteSkills: Skill[],
): {
  skills: Skill[];
  idMap: Map<string, string>;
  selectedOrigin: Map<string, "local" | "remote">;
} {
  const groups = new Map<
    string,
    { selected: SkillSnapshotSource<Skill>; members: Skill[] }
  >();

  for (const [origin, skills] of [
    ["local", localSkills],
    ["remote", remoteSkills],
  ] as const) {
    for (const skill of skills) {
      const key = skillIdentity(skill);
      const incoming = {
        value: skill,
        origin,
      } satisfies SkillSnapshotSource<Skill>;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, { selected: incoming, members: [skill] });
        continue;
      }
      group.members.push(skill);
      if (shouldReplaceSkill(group.selected, incoming)) {
        group.selected = incoming;
      }
    }
  }

  const idMap = new Map<string, string>();
  const selectedOrigin = new Map<string, "local" | "remote">();
  const skills: Skill[] = [];
  for (const group of groups.values()) {
    const selectedId = group.selected.value.id;
    skills.push(group.selected.value);
    selectedOrigin.set(selectedId, group.selected.origin);
    for (const member of group.members) {
      idMap.set(member.id, selectedId);
    }
  }

  return { skills, idMap, selectedOrigin };
}

function mergeSkillVersions(
  localVersions: SkillVersion[],
  remoteVersions: SkillVersion[],
  idMap: Map<string, string>,
): SkillVersion[] {
  const versions = new Map<string, SkillSnapshotSource<SkillVersion>>();
  for (const [origin, entries] of [
    ["local", localVersions],
    ["remote", remoteVersions],
  ] as const) {
    for (const version of entries) {
      const skillId = idMap.get(version.skillId);
      if (!skillId) continue;
      const remapped = { ...version, skillId };
      const key = `${skillId}:${version.version}`;
      const incoming = {
        value: remapped,
        origin,
      } satisfies SkillSnapshotSource<SkillVersion>;
      const current = versions.get(key);
      if (
        !current ||
        toTimestamp(version.createdAt) > toTimestamp(current.value.createdAt) ||
        (toTimestamp(version.createdAt) ===
          toTimestamp(current.value.createdAt) &&
          origin === "remote")
      ) {
        versions.set(key, incoming);
      }
    }
  }
  return Array.from(versions.values(), ({ value }) => value);
}

function mergeSkillFiles(
  localFiles: Record<string, SkillFileSnapshot[]> | undefined,
  remoteFiles: Record<string, SkillFileSnapshot[]> | undefined,
  idMap: Map<string, string>,
  selectedOrigin: Map<string, "local" | "remote">,
): Record<string, SkillFileSnapshot[]> | undefined {
  if (!localFiles && !remoteFiles) return undefined;

  const merged = new Map<
    string,
    Map<string, SkillSnapshotSource<SkillFileSnapshot>>
  >();
  for (const [origin, filesBySource] of [
    ["local", localFiles],
    ["remote", remoteFiles],
  ] as const) {
    if (!filesBySource) continue;
    for (const [sourceId, files] of Object.entries(filesBySource)) {
      const skillId = idMap.get(sourceId);
      if (!skillId) continue;
      const targetFiles = merged.get(skillId) ?? new Map();
      const preferredOrigin = selectedOrigin.get(skillId);
      for (const file of files) {
        const current = targetFiles.get(file.relativePath);
        if (
          !current ||
          current.origin === origin ||
          origin === preferredOrigin
        ) {
          targetFiles.set(file.relativePath, { value: file, origin });
        }
      }
      merged.set(skillId, targetFiles);
    }
  }

  return Object.fromEntries(
    Array.from(merged, ([skillId, files]) => [
      skillId,
      Array.from(files.values(), ({ value }) => value),
    ]),
  );
}

export function mergeSkillSnapshots(
  localSkills: Skill[],
  remoteSkills: Skill[],
  localVersions: SkillVersion[],
  remoteVersions: SkillVersion[],
  localFiles?: Record<string, SkillFileSnapshot[]>,
  remoteFiles?: Record<string, SkillFileSnapshot[]>,
): MergedSkillSnapshots {
  const { skills, idMap, selectedOrigin } = mergeSkillRecords(
    localSkills,
    remoteSkills,
  );
  const skillFiles = mergeSkillFiles(
    localFiles,
    remoteFiles,
    idMap,
    selectedOrigin,
  );
  return {
    skills,
    skillVersions: mergeSkillVersions(localVersions, remoteVersions, idMap),
    ...(skillFiles ? { skillFiles } : {}),
  };
}

export function normalizeSkillsForWebSync(skills: Skill[]): Skill[] {
  return skills.map((skill) => {
    const {
      local_repo_path: _localRepoPath,
      source_url,
      content_url,
      icon_url,
      ...portable
    } = skill;
    return {
      ...portable,
      ...(isHttpUrl(source_url) ? { source_url } : {}),
      ...(isHttpUrl(content_url) ? { content_url } : {}),
      ...(isPortableIconUrl(icon_url) ? { icon_url } : {}),
    };
  });
}
