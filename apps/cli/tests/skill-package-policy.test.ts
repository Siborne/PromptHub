import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  closeDatabase,
  createCliSkillService,
  resetRuntimePaths,
} from "@prompthub/core";
import { SKILL_SECRET_SCAN_MAX_FILE_BYTES } from "@prompthub/core/skills/package-policy";
import {
  createSkillPackageIgnoreMatcher,
  MAX_SKILL_PACKAGE_SECRET_FINDINGS,
  scanSkillPackageSecrets,
} from "@prompthub/shared/utils/skill-package-policy";

import {
  execCli,
  makeTempRoot,
  withDataDir,
  withTempHome,
} from "./helpers/cli-harness";

function writeSkill(root: string, name: string): string {
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    ["---", `name: ${name}`, "version: 1.0.0", "---", "", `# ${name}`].join(
      "\n",
    ),
    "utf8",
  );
  return skillDir;
}

function fixtureSecret(...parts: string[]): string {
  return parts.join("");
}

describe("Skill package policy", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("combines built-in ignores, gitignore-style custom rules, and protected SKILL.md", () => {
    const shouldIgnore = createSkillPackageIgnoreMatcher(
      ["*.scratch", "!keep.scratch", "SKILL.md"].join("\n"),
    );

    expect(shouldIgnore(".DS_Store")).toBe(true);
    expect(shouldIgnore("node_modules/pkg/index.js")).toBe(true);
    expect(shouldIgnore(".env.local")).toBe(true);
    expect(shouldIgnore("build/report.txt")).toBe(true);
    expect(shouldIgnore("dist/package.js")).toBe(true);
    expect(shouldIgnore("target/release/tool")).toBe(true);
    expect(shouldIgnore("notes/private.scratch")).toBe(true);
    expect(shouldIgnore("keep.scratch")).toBe(false);
    expect(shouldIgnore("文档/指南.md")).toBe(false);
    expect(shouldIgnore("SKILL.md")).toBe(false);
  });

  it("returns only redacted secret metadata and permits documented placeholders", () => {
    const findings = scanSkillPackageSecrets([
      {
        path: "credentials.txt",
        content: [
          fixtureSecret(
            "github_token=gh",
            "p_abcdefghijklmnopqrstuvwxyz1234567890",
          ),
          "node_password: correct-horse-battery-staple",
        ].join("\n"),
      },
      {
        path: "examples/config.env.example",
        content: "TOKEN=${TOKEN}\npassword=<password>\napi_key=your-api-key",
      },
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        code: "provider-token",
        path: "credentials.txt",
        line: 1,
      }),
      expect.objectContaining({
        code: "credential-assignment",
        path: "credentials.txt",
        line: 2,
      }),
    ]);
    expect(JSON.stringify(findings)).not.toContain("ghp_");
    expect(JSON.stringify(findings)).not.toContain("correct-horse");
  });

  it("recognizes additional provider and key formats with bounded diagnostics", () => {
    const repeatedTokens = Array.from(
      { length: MAX_SKILL_PACKAGE_SECRET_FINDINGS + 20 },
      () => fixtureSecret("token=gh", "p_abcdefghijklmnopqrstuvwxyz1234567890"),
    );
    const findings = scanSkillPackageSecrets([
      {
        path: "secrets.txt",
        content: [
          "-----BEGIN PGP PRIVATE KEY BLOCK-----",
          fixtureSecret("AI", "za12345678901234567890123456789012345"),
          ...repeatedTokens,
        ].join("\n"),
      },
    ]);

    expect(findings[0]).toMatchObject({ code: "private-key", line: 1 });
    expect(findings[1]).toMatchObject({ code: "provider-token", line: 2 });
    expect(findings).toHaveLength(MAX_SKILL_PACKAGE_SECRET_FINDINGS + 1);
  });

  it("bounds every secret category without exposing matched values", () => {
    const privateKeys = scanSkillPackageSecrets([
      {
        path: "keys.txt",
        content: Array.from(
          { length: MAX_SKILL_PACKAGE_SECRET_FINDINGS + 20 },
          () => "-----BEGIN PRIVATE KEY-----",
        ).join("\n"),
      },
    ]);
    const credentials = scanSkillPackageSecrets([
      {
        path: "credentials.txt",
        content: Array.from(
          { length: MAX_SKILL_PACKAGE_SECRET_FINDINGS + 20 },
          (_, index) => `password=bounded-secret-${index}`,
        ).join("\n"),
      },
    ]);

    expect(privateKeys).toHaveLength(MAX_SKILL_PACKAGE_SECRET_FINDINGS + 1);
    expect(privateKeys.every((finding) => finding.code === "private-key")).toBe(
      true,
    );
    expect(credentials).toHaveLength(MAX_SKILL_PACKAGE_SECRET_FINDINGS + 1);
    expect(
      credentials.every((finding) => finding.code === "credential-assignment"),
    ).toBe(true);
    expect(JSON.stringify(credentials)).not.toContain("bounded-secret");
  });

  it("keeps ignored files out of managed copies, snapshots, and platform distributions", async () => {
    const root = makeTempRoot(tempDirs);
    const skillDir = writeSkill(root, "package-policy-skill");
    fs.mkdirSync(path.join(skillDir, "build"));
    fs.mkdirSync(path.join(skillDir, "node_modules", "pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(skillDir, ".prompthubignore"),
      ["build/", "*.scratch", "!keep.scratch"].join("\n"),
      "utf8",
    );
    fs.writeFileSync(path.join(skillDir, ".DS_Store"), "metadata", "utf8");
    fs.writeFileSync(path.join(skillDir, ".env"), "TOKEN=real-secret", "utf8");
    fs.writeFileSync(
      path.join(skillDir, "build", "bundle.js"),
      "build",
      "utf8",
    );
    fs.writeFileSync(
      path.join(skillDir, "node_modules", "pkg", "index.js"),
      "dependency",
      "utf8",
    );
    fs.writeFileSync(path.join(skillDir, "private.scratch"), "private", "utf8");
    fs.writeFileSync(path.join(skillDir, "keep.scratch"), "keep", "utf8");
    fs.writeFileSync(path.join(skillDir, "guide.md"), "guide", "utf8");

    const install = await execCli([
      ...withDataDir(root),
      "--full",
      "skill",
      "install",
      skillDir,
    ]);
    expect(install.exitCode).toBe(0);

    const managedDir = path.join(
      root,
      "user-data",
      "data",
      "skills",
      "package-policy-skill",
    );
    for (const ignored of [
      ".DS_Store",
      ".env",
      "build/bundle.js",
      "node_modules/pkg/index.js",
      "private.scratch",
    ]) {
      expect(fs.existsSync(path.join(managedDir, ignored))).toBe(false);
    }
    expect(fs.readFileSync(path.join(managedDir, "keep.scratch"), "utf8")).toBe(
      "keep",
    );

    const version = await execCli([
      ...withDataDir(root),
      "--full",
      "skill",
      "create-version",
      "package-policy-skill",
    ]);
    expect(version.exitCode).toBe(0);
    expect(
      version.json.filesSnapshot.map(
        (entry: { relativePath: string }) => entry.relativePath,
      ),
    ).toEqual(
      expect.arrayContaining([
        "SKILL.md",
        ".prompthubignore",
        "guide.md",
        "keep.scratch",
      ]),
    );
    expect(
      version.json.filesSnapshot.some((entry: { relativePath: string }) =>
        entry.relativePath.includes("private.scratch"),
      ),
    ).toBe(false);

    await withTempHome(root, async (homeDir) => {
      const distribute = await execCli([
        ...withDataDir(root),
        "skill",
        "install-md",
        "package-policy-skill",
        "--platform",
        "claude",
      ]);
      expect(distribute.exitCode).toBe(0);
      const platformDir = path.join(
        homeDir,
        ".claude",
        "skills",
        "package-policy-skill",
      );
      expect(fs.existsSync(path.join(platformDir, "guide.md"))).toBe(true);
      expect(fs.existsSync(path.join(platformDir, "private.scratch"))).toBe(
        false,
      );
    });
  });

  it("blocks secrets before managed copy and before a later version snapshot", async () => {
    const root = makeTempRoot(tempDirs);
    const unsafeDir = writeSkill(root, "unsafe-package-skill");
    fs.writeFileSync(
      path.join(unsafeDir, "private-key.pem"),
      "-----BEGIN OPENSSH PRIVATE KEY-----\nfake-test-material\n-----END OPENSSH PRIVATE KEY-----",
      "utf8",
    );

    const unsafeInstall = await execCli([
      ...withDataDir(root),
      "skill",
      "install",
      unsafeDir,
    ]);
    expect(unsafeInstall.exitCode).toBe(4);
    expect(unsafeInstall.errorJson).toMatchObject({
      error: {
        code: "SKILL_PACKAGE_SECRETS_DETECTED",
        details: {
          findings: [
            {
              code: "private-key",
              path: "private-key.pem",
              line: 1,
            },
          ],
        },
      },
    });
    expect(unsafeInstall.joinedStderr).not.toContain("fake-test-material");
    expect(
      fs.existsSync(
        path.join(root, "user-data", "data", "skills", "unsafe-package-skill"),
      ),
    ).toBe(false);

    const safeDir = writeSkill(root, "snapshot-guard-skill");
    expect(
      (await execCli([...withDataDir(root), "skill", "install", safeDir]))
        .exitCode,
    ).toBe(0);
    expect(
      (
        await execCli([
          ...withDataDir(root),
          "skill",
          "repo-write",
          "snapshot-guard-skill",
          "--path",
          "credentials.txt",
          "--content",
          "node_password=correct-horse-battery-staple",
        ])
      ).exitCode,
    ).toBe(0);

    const snapshot = await execCli([
      ...withDataDir(root),
      "skill",
      "create-version",
      "snapshot-guard-skill",
    ]);
    expect(snapshot.exitCode).toBe(4);
    expect(snapshot.errorJson.error.code).toBe(
      "SKILL_PACKAGE_SECRETS_DETECTED",
    );

    const projectTargets = path.join(root, "project-skills");
    const existingTarget = path.join(projectTargets, "snapshot-guard-skill");
    fs.mkdirSync(existingTarget, { recursive: true });
    fs.writeFileSync(path.join(existingTarget, "sentinel.txt"), "old", "utf8");
    const projectCopy = await execCli([
      ...withDataDir(root),
      "skill",
      "project-install",
      "snapshot-guard-skill",
      "--target",
      projectTargets,
      "--force",
    ]);
    expect(projectCopy.exitCode).toBe(4);
    expect(
      fs.readFileSync(path.join(existingTarget, "sentinel.txt"), "utf8"),
    ).toBe("old");

    const symlinkTargets = path.join(root, "symlink-targets");
    const projectSymlink = await execCli([
      ...withDataDir(root),
      "skill",
      "project-install",
      "snapshot-guard-skill",
      "--target",
      symlinkTargets,
      "--mode",
      "symlink",
    ]);
    expect(projectSymlink.exitCode).toBe(4);
    expect(
      fs.existsSync(path.join(symlinkTargets, "snapshot-guard-skill")),
    ).toBe(false);

    const versions = await execCli([
      ...withDataDir(root),
      "--full",
      "skill",
      "versions",
      "snapshot-guard-skill",
    ]);
    expect(versions.json).toEqual([]);
  });

  it("reports bounded scan limits without echoing package contents", async () => {
    const root = makeTempRoot(tempDirs);
    const skillDir = writeSkill(root, "oversized-policy-skill");
    fs.writeFileSync(
      path.join(skillDir, "large.txt"),
      Buffer.alloc(SKILL_SECRET_SCAN_MAX_FILE_BYTES + 1, 0x63),
    );

    const result = await execCli([
      ...withDataDir(root),
      "skill",
      "import",
      skillDir,
    ]);
    expect(result.exitCode).toBe(4);
    expect(result.errorJson.error).toMatchObject({
      code: "SKILL_PACKAGE_SCAN_LIMIT_EXCEEDED",
      details: {
        path: "large.txt",
        limitKind: "file",
        limitBytes: SKILL_SECRET_SCAN_MAX_FILE_BYTES,
      },
    });
    expect(result.joinedStderr).not.toContain("cccc");
  });

  it("fails closed when the filtered package exceeds the entry budget", async () => {
    const root = makeTempRoot(tempDirs);
    const skillDir = writeSkill(root, "entry-limit-skill");
    for (let index = 0; index < 500; index += 1) {
      fs.writeFileSync(
        path.join(skillDir, `note-${String(index).padStart(3, "0")}.txt`),
        "safe",
        "utf8",
      );
    }
    fs.writeFileSync(
      path.join(skillDir, "zz-secret.txt"),
      "node_password=correct-horse-battery-staple",
      "utf8",
    );

    const result = await execCli([
      ...withDataDir(root),
      "skill",
      "import",
      skillDir,
    ]);

    expect(result.exitCode).toBe(4);
    expect(result.errorJson.error).toMatchObject({
      code: "SKILL_PACKAGE_ENTRY_LIMIT_EXCEEDED",
      details: {
        limitEntries: 500,
      },
    });
    expect(result.joinedStderr).not.toContain("correct-horse");
    expect(
      fs.existsSync(
        path.join(root, "user-data", "data", "skills", "entry-limit-skill"),
      ),
    ).toBe(false);
  });

  it("scans a temporary GitHub checkout before creating the managed package", async () => {
    const root = makeTempRoot(tempDirs);
    const gitCloneImpl = async (_url: string, destinationDir: string) => {
      fs.mkdirSync(destinationDir, { recursive: true });
      fs.writeFileSync(
        path.join(destinationDir, "SKILL.md"),
        "---\nname: unsafe-github-skill\n---\n\n# Unsafe",
        "utf8",
      );
      fs.writeFileSync(
        path.join(destinationDir, "credentials.txt"),
        fixtureSecret(
          "github_token=gh",
          "p_abcdefghijklmnopqrstuvwxyz1234567890",
        ),
        "utf8",
      );
    };

    const result = await execCli(
      [
        ...withDataDir(root),
        "skill",
        "import",
        "https://github.com/acme/unsafe-github-skill",
      ],
      createCliSkillService({ gitCloneImpl }),
    );

    expect(result.exitCode).toBe(4);
    expect(result.errorJson.error.code).toBe("SKILL_PACKAGE_SECRETS_DETECTED");
    expect(result.joinedStderr).not.toContain("ghp_");
    const managedRoot = path.join(root, "user-data", "data", "skills");
    expect(
      fs.existsSync(path.join(managedRoot, "acme-unsafe-github-skill")),
    ).toBe(false);
    expect(
      fs.existsSync(managedRoot) ? fs.readdirSync(managedRoot) : [],
    ).toEqual([]);
  });

  it("rejects secret-bearing JSON imports before creating a database record", async () => {
    const root = makeTempRoot(tempDirs);
    const sourcePath = path.join(root, "unsafe-skill.json");
    fs.writeFileSync(
      sourcePath,
      JSON.stringify({
        name: "unsafe-json-skill",
        instructions: fixtureSecret(
          "api_key=s",
          "k-abcdefghijklmnopqrstuvwxyz1234567890",
        ),
      }),
      "utf8",
    );

    const rejected = await execCli([
      ...withDataDir(root),
      "skill",
      "import",
      sourcePath,
    ]);
    expect(rejected.exitCode).toBe(4);
    expect(rejected.errorJson.error.code).toBe(
      "SKILL_PACKAGE_SECRETS_DETECTED",
    );
    expect(rejected.joinedStderr).not.toContain("sk-");

    const listed = await execCli([...withDataDir(root), "skill", "list"]);
    expect(listed.json).toEqual([]);
  });
});
