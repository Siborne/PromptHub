/**
 * Skill Validator
 * 技能验证器 - 用于验证 SKILL.md 格式和技能名称
 */

import {
  parseSkillMd,
  type ParsedSkillMd,
  type SkillFrontmatter,
} from "@prompthub/core/skills/skill-frontmatter";

export { parseSkillMd };
export type { ParsedSkillMd, SkillFrontmatter };

/**
 * Skill name validation regex
 * 技能名称验证正则：小写字母数字 + 单个连字符分隔
 * - Length: 1-64 characters
 * - Format: lowercase alphanumeric with single hyphen separators
 * - Cannot start or end with `-`
 * - Cannot contain consecutive `--`
 */
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validation result
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: ParsedSkillMd;
}

/**
 * Validate skill name format
 * 验证技能名称格式
 *
 * @param name - Skill name to validate
 * @returns true if valid, false otherwise
 */
export function validateSkillName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }

  // Check length
  if (name.length < 1 || name.length > 64) {
    return false;
  }

  // Check format
  return SKILL_NAME_REGEX.test(name);
}

/**
 * Get skill name validation error message
 * 获取技能名称验证错误信息
 *
 * @param name - Skill name to validate
 * @returns Error message or null if valid
 */
export function getSkillNameError(name: string): string | null {
  if (!name || typeof name !== "string") {
    return "Skill name is required";
  }

  if (name.length < 1) {
    return "Skill name cannot be empty";
  }

  if (name.length > 64) {
    return "Skill name cannot exceed 64 characters";
  }

  if (!SKILL_NAME_REGEX.test(name)) {
    if (name !== name.toLowerCase()) {
      return "Skill name must be lowercase";
    }
    if (name.startsWith("-") || name.endsWith("-")) {
      return "Skill name cannot start or end with a hyphen";
    }
    if (name.includes("--")) {
      return "Skill name cannot contain consecutive hyphens";
    }
    if (/[^a-z0-9-]/.test(name)) {
      return "Skill name can only contain lowercase letters, numbers, and hyphens";
    }
    return "Invalid skill name format";
  }

  return null;
}

/**
 * Validate a SKILL.md file content
 * 验证 SKILL.md 文件内容
 *
 * @param content - Raw SKILL.md content
 * @param directoryName - Optional directory name to match against skill name
 * @returns Validation result with errors and warnings
 */
export function validateSkillMd(
  content: string,
  directoryName?: string,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse content
  const parsed = parseSkillMd(content);

  if (!parsed) {
    return {
      valid: false,
      errors: ["Failed to parse SKILL.md content"],
      warnings: [],
    };
  }

  // Validate name
  if (!parsed.frontmatter.name) {
    errors.push("Missing required field: name");
  } else {
    const nameError = getSkillNameError(parsed.frontmatter.name);
    if (nameError) {
      errors.push(`Invalid name: ${nameError}`);
    }

    // Check if name matches directory name
    if (directoryName && parsed.frontmatter.name !== directoryName) {
      warnings.push(
        `Skill name "${parsed.frontmatter.name}" does not match directory name "${directoryName}"`,
      );
    }
  }

  // Validate description
  if (!parsed.frontmatter.description) {
    warnings.push("Missing recommended field: description");
  } else if (parsed.frontmatter.description.length > 1024) {
    errors.push("Description cannot exceed 1024 characters");
  }

  // Check for body content
  if (!parsed.body || parsed.body.length === 0) {
    warnings.push("SKILL.md has no content after frontmatter");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: parsed,
  };
}

/**
 * Validate a complete skill package (folder structure)
 * 验证完整的技能包（文件夹结构）
 *
 * @param folderPath - Path to skill folder
 * @returns Validation result
 */
export async function validateSkillPackage(
  folderPath: string,
  fs: {
    readFile: (path: string, encoding: string) => Promise<string>;
    access: (path: string) => Promise<void>;
    stat: (path: string) => Promise<{ isDirectory: () => boolean }>;
  },
  path: {
    join: (...args: string[]) => string;
    basename: (p: string) => string;
  },
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if folder exists and is a directory
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      return {
        valid: false,
        errors: ["Path is not a directory"],
        warnings: [],
      };
    }

    const directoryName = path.basename(folderPath);

    // Check for SKILL.md
    const skillMdPath = path.join(folderPath, "SKILL.md");
    let skillMdContent: string;

    try {
      skillMdContent = await fs.readFile(skillMdPath, "utf-8");
    } catch {
      return {
        valid: false,
        errors: ["SKILL.md file not found"],
        warnings: [],
      };
    }

    // Validate SKILL.md
    const skillMdResult = validateSkillMd(skillMdContent, directoryName);
    errors.push(...skillMdResult.errors);
    warnings.push(...skillMdResult.warnings);

    // Check for optional manifest.json
    try {
      const manifestPath = path.join(folderPath, "manifest.json");
      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      try {
        JSON.parse(manifestContent);
      } catch {
        warnings.push("manifest.json contains invalid JSON");
      }
    } catch {
      // manifest.json is optional
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      data: skillMdResult.data,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate skill package: ${error}`],
      warnings: [],
    };
  }
}
