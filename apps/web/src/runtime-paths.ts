import path from 'node:path';
import { config } from './config.js';

/**
 * Web 端运行时路径解析器。
 *
 * 所有磁盘位置均派生自 `DATA_ROOT`（来自环境变量 / config.rootDir），布局
 * 与桌面端共享逻辑域，但物理拓扑保持 self-hosted 多用户边界：
 *
 * ```text
 * <DATA_ROOT>/
 *   data/
 *     prompthub.db          SQLite 数据库
 *     prompts/              共享文件投影，记录 ownerUserId / visibility
 *     skills/               共享文件投影，记录 ownerUserId / visibility
 *     rules/<userId>/       用户隔离的 Rule 文件与版本
 *     assets/<userId>/{images,videos}/   用户媒体
 *   config/
 *     settings/<userId>.json   用户设置镜像
 *     devices/<userId>.json    设备注册表
 *   logs/                   日志（预留）
 *   backups/                升级/手动备份（预留）
 * ```
 *
 * 本模块是**纯派生**的——没有 legacy fallback、没有自动迁移，因为 Web
 * 服务进程独占文件系统，用户不会手动动这些文件。兼容旧路径的工作由
 * 运维侧的卷挂载迁移完成（参考 README / docker-compose）。
 */

export type MediaKind = 'images' | 'videos';

function assertIdentitySegment(value: string, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value) ||
    value === '.' ||
    value === '..'
  ) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

export function getRootDir(): string {
  return config.rootDir;
}

export function getDataDir(): string {
  return path.join(getRootDir(), 'data');
}

export function getConfigDir(): string {
  return path.join(getRootDir(), 'config');
}

export function getLogsDir(): string {
  return path.join(getRootDir(), 'logs');
}

export function getBackupsDir(): string {
  return path.join(getRootDir(), 'backups');
}

export function getDatabasePath(): string {
  return path.join(getDataDir(), 'prompthub.db');
}

export function getPromptsDir(): string {
  return path.join(getDataDir(), 'prompts');
}

export function getSkillsDir(): string {
  return path.join(getDataDir(), 'skills');
}

export function getRulesDir(): string {
  return path.join(getDataDir(), 'rules');
}

export function getAssetsDir(): string {
  return path.join(getDataDir(), 'assets');
}

export function getMediaDir(userId: string, kind: MediaKind): string {
  return path.join(
    getAssetsDir(),
    assertIdentitySegment(userId, 'storage user id'),
    kind,
  );
}

export function getSettingsDir(): string {
  return path.join(getConfigDir(), 'settings');
}

export function getDevicesDir(): string {
  return path.join(getConfigDir(), 'devices');
}

export function getUserRulesDir(userId: string): string {
  return path.join(
    getRulesDir(),
    assertIdentitySegment(userId, 'storage user id'),
  );
}

export function getUserSettingsPath(userId: string): string {
  return path.join(
    getSettingsDir(),
    `${assertIdentitySegment(userId, 'storage user id')}.json`,
  );
}

export function getUserDevicesPath(userId: string): string {
  return path.join(
    getDevicesDir(),
    `${assertIdentitySegment(userId, 'storage user id')}.json`,
  );
}

export function getWebStorageTopology(userId: string) {
  return {
    kind: 'self-hosted-multi-user' as const,
    databasePath: getDatabasePath(),
    shared: {
      promptsPath: getPromptsDir(),
      skillsPath: getSkillsDir(),
    },
    user: {
      rulesPath: getUserRulesDir(userId),
      imagesPath: getMediaDir(userId, 'images'),
      videosPath: getMediaDir(userId, 'videos'),
      settingsPath: getUserSettingsPath(userId),
      devicesPath: getUserDevicesPath(userId),
    },
  };
}
