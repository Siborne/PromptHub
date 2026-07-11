import { DEFAULT_SETTINGS } from "@prompthub/shared";

const REMOTE_PAYLOAD = {
  version: "web-backup-v2",
  exportedAt: "2026-04-13T12:00:00.000Z",
  prompts: [
    {
      id: "remote-prompt-1",
      title: "Remote Prompt",
      userPrompt: "Pulled body",
      variables: [],
      tags: ["remote"],
      folderId: "remote-folder-child",
      images: ["remote-image.png"],
      videos: ["remote-video.mp4"],
      isFavorite: false,
      isPinned: false,
      version: 2,
      currentVersion: 2,
      usageCount: 0,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
    },
  ],
  promptVersions: [
    {
      id: "remote-prompt-version-1",
      promptId: "remote-prompt-1",
      version: 1,
      userPrompt: "Pulled body",
      variables: [],
      createdAt: "2026-04-10T00:00:00.000Z",
    },
  ],
  folders: [
    {
      id: "remote-folder-root",
      name: "Remote Root",
      order: 0,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    },
    {
      id: "remote-folder-child",
      name: "Remote Child",
      parentId: "remote-folder-root",
      order: 1,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    },
  ],
  rules: [
    {
      id: "project:remote-site",
      platformId: "workspace",
      platformName: "Remote Site",
      platformIcon: "FolderRoot",
      platformDescription: "Remote rules",
      name: "AGENTS.md",
      description: "Remote project rules",
      path: "/remote/AGENTS.md",
      targetPath: "/remote/AGENTS.md",
      projectRootPath: "/remote",
      syncStatus: "synced",
      content: "# Remote rules",
      versions: [],
    },
  ],
  skills: [
    {
      id: "remote-skill-1",
      name: "remote-skill",
      content: "echo remote",
      instructions: "echo remote",
      protocol_type: "skill",
      is_favorite: false,
      created_at: 1712700000000,
      updated_at: 1712786400000,
    },
  ],
  skillVersions: [
    {
      id: "remote-skill-version-1",
      skillId: "remote-skill-1",
      version: 1,
      content: "echo remote",
      createdAt: "2026-04-10T00:00:00.000Z",
    },
  ],
  skillFiles: {
    "remote-skill-1": [
      {
        relativePath: "SKILL.md",
        content: "echo remote",
      },
      {
        relativePath: "templates/review.md",
        content: "# Remote review checklist",
      },
    ],
  },
  settings: {
    theme: "dark",
    language: "en",
    autoSave: false,
    customPlatformRootPaths: {
      claude: "/tmp/remote-root",
    },
    sync: {
      enabled: false,
      provider: "manual",
      autoSync: false,
    },
  },
};

export function buildRemotePayload() {
  return structuredClone(REMOTE_PAYLOAD);
}

export function buildDeepFolderPayload(folderCount: number) {
  const folders = Array.from({ length: folderCount }, (_, index) => ({
    id: `deep-folder-${index}`,
    name: `Deep Folder ${index}`,
    parentId: index === 0 ? undefined : `deep-folder-${index - 1}`,
    order: index,
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  })).reverse();

  return {
    version: "web-backup-v2",
    exportedAt: "2026-04-22T00:00:00.000Z",
    prompts: [
      {
        id: "deep-folder-prompt",
        title: "Should Not Import",
        userPrompt: "This prompt must not survive a rejected import",
        variables: [],
        tags: [],
        images: ["deep-image.png"],
        videos: [],
        isFavorite: false,
        isPinned: false,
        version: 1,
        currentVersion: 1,
        usageCount: 0,
        folderId: `deep-folder-${folderCount - 1}`,
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ],
    promptVersions: [],
    folders,
    rules: [],
    skills: [],
    skillVersions: [],
    images: {
      "deep-image.png": Buffer.from("deep-image-binary").toString("base64"),
    },
    videos: {},
    settings: DEFAULT_SETTINGS,
  };
}

const DEEP_SKILL_PAYLOAD = {
  version: "web-backup-v2",
  exportedAt: "2026-04-22T00:00:00.000Z",
  prompts: [
    {
      id: "deep-skill-prompt",
      title: "Should Not Import",
      userPrompt: "This prompt must not survive a rejected import",
      variables: [],
      tags: [],
      images: ["deep-skill-image.png"],
      videos: [],
      isFavorite: false,
      isPinned: false,
      version: 1,
      currentVersion: 1,
      usageCount: 0,
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
    },
  ],
  promptVersions: [],
  folders: [],
  rules: [],
  skills: [
    {
      id: "deep-skill",
      name: "Skill ".repeat(70),
      content: "echo too long",
      instructions: "echo too long",
      protocol_type: "skill",
      is_favorite: false,
      created_at: 1776816000000,
      updated_at: 1776816000000,
    },
  ],
  skillVersions: [],
  images: {
    "deep-skill-image.png": Buffer.from("deep-skill-image-binary").toString(
      "base64",
    ),
  },
  videos: {},
  settings: DEFAULT_SETTINGS,
};

export function buildDeepSkillPayload() {
  return structuredClone(DEEP_SKILL_PAYLOAD);
}

const UNSAFE_RULE_PAYLOAD = {
  version: "web-backup-v2",
  exportedAt: "2026-04-22T00:00:00.000Z",
  prompts: [
    {
      id: "unsafe-rule-prompt",
      title: "Should Not Import",
      userPrompt: "This prompt must not survive a rejected import",
      variables: [],
      tags: [],
      images: ["unsafe-rule-image.png"],
      videos: [],
      isFavorite: false,
      isPinned: false,
      version: 1,
      currentVersion: 1,
      usageCount: 0,
      createdAt: "2026-04-22T00:00:00.000Z",
      updatedAt: "2026-04-22T00:00:00.000Z",
    },
  ],
  promptVersions: [],
  folders: [],
  rules: [
    {
      id: "project:../escape",
      platformId: "workspace",
      platformName: "Unsafe Rule",
      platformIcon: "FolderRoot",
      platformDescription: "Unsafe imported rule",
      name: "../AGENTS.md",
      description: "Should be rejected",
      path: "/unsafe/AGENTS.md",
      targetPath: "/unsafe/AGENTS.md",
      projectRootPath: "/unsafe",
      syncStatus: "synced",
      content: "# Unsafe",
      versions: [],
    },
  ],
  skills: [],
  skillVersions: [],
  images: {
    "unsafe-rule-image.png": Buffer.from("unsafe-rule-image-binary").toString(
      "base64",
    ),
  },
  videos: {},
  settings: DEFAULT_SETTINGS,
};

export function buildUnsafeRulePayload() {
  return structuredClone(UNSAFE_RULE_PAYLOAD);
}
