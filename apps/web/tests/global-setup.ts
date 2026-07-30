import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase, initDatabase } from '@prompthub/db';
import { TEST_DATABASE_TEMPLATE_ENV } from '../src/test-helpers/database-template';

export default function setupWebDatabaseTemplate(): () => void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'prompthub-web-db-template-'),
  );
  const templatePath = path.join(root, 'prompthub.db');
  initDatabase(templatePath);
  closeDatabase();
  process.env[TEST_DATABASE_TEMPLATE_ENV] = templatePath;

  return () => {
    closeDatabase();
    delete process.env[TEST_DATABASE_TEMPLATE_ENV];
    fs.rmSync(root, { recursive: true, force: true });
  };
}
