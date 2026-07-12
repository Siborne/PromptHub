import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDataRoot = process.env.DATA_ROOT;
const originalJwtSecret = process.env.JWT_SECRET;
let dataRoot: string | undefined;

describe('self-hosted Web database bootstrap', () => {
  afterEach(async () => {
    const db = await import('@prompthub/db');
    db.closeDatabase();
    vi.resetModules();

    if (dataRoot) {
      fs.rmSync(dataRoot, { recursive: true, force: true });
      dataRoot = undefined;
    }

    if (originalDataRoot === undefined) {
      delete process.env.DATA_ROOT;
    } else {
      process.env.DATA_ROOT = originalDataRoot;
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('recovers an ownerless legacy lock before opening the mounted database', async () => {
    dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prompthub-web-db-lock-'));
    process.env.DATA_ROOT = dataRoot;
    process.env.JWT_SECRET = 'test-secret-for-web-db-lock-1234567890';

    const databasePath = path.join(dataRoot, 'data', 'prompthub.db');
    fs.mkdirSync(`${databasePath}.lock`, { recursive: true });

    const { getServerDatabase } = await import('./database');

    expect(() => getServerDatabase()).not.toThrow();
    expect(fs.existsSync(`${databasePath}.lock`)).toBe(false);
  });
});
