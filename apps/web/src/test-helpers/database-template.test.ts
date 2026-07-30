import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { seedTestDatabaseFromTemplate } from './database-template';

const originalVitest = process.env.VITEST;
const originalTemplate = process.env.PROMPTHUB_TEST_DATABASE_TEMPLATE;
const roots: string[] = [];

afterEach(() => {
  restoreEnv('VITEST', originalVitest);
  restoreEnv('PROMPTHUB_TEST_DATABASE_TEMPLATE', originalTemplate);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompthub-db-template-'));
  roots.push(root);
  return root;
}

describe('Web test database template', () => {
  it('copies a closed template into a missing test database path', () => {
    const root = makeRoot();
    const templatePath = path.join(root, 'template.db');
    const databasePath = path.join(root, 'case', 'data', 'prompthub.db');
    fs.writeFileSync(templatePath, 'template-content');
    process.env.VITEST = 'true';
    process.env.PROMPTHUB_TEST_DATABASE_TEMPLATE = templatePath;

    expect(seedTestDatabaseFromTemplate(databasePath)).toBe(true);
    expect(fs.readFileSync(databasePath, 'utf8')).toBe('template-content');
  });

  it('never overwrites existing data or runs outside Vitest', () => {
    const root = makeRoot();
    const templatePath = path.join(root, 'template.db');
    const databasePath = path.join(root, 'prompthub.db');
    fs.writeFileSync(templatePath, 'template-content');
    fs.writeFileSync(databasePath, 'existing-content');
    process.env.VITEST = 'true';
    process.env.PROMPTHUB_TEST_DATABASE_TEMPLATE = templatePath;

    expect(seedTestDatabaseFromTemplate(databasePath)).toBe(false);
    expect(fs.readFileSync(databasePath, 'utf8')).toBe('existing-content');

    fs.rmSync(databasePath);
    delete process.env.VITEST;
    expect(seedTestDatabaseFromTemplate(databasePath)).toBe(false);
    expect(fs.existsSync(databasePath)).toBe(false);
  });
});
