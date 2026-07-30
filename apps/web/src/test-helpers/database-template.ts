import fs from 'node:fs';
import path from 'node:path';

export const TEST_DATABASE_TEMPLATE_ENV = 'PROMPTHUB_TEST_DATABASE_TEMPLATE';

export function seedTestDatabaseFromTemplate(databasePath: string): boolean {
  const templatePath = process.env[TEST_DATABASE_TEMPLATE_ENV];
  if (
    !process.env.VITEST ||
    !templatePath ||
    fs.existsSync(databasePath) ||
    !fs.statSync(templatePath, { throwIfNoEntry: false })?.isFile()
  ) {
    return false;
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.copyFileSync(templatePath, databasePath, fs.constants.COPYFILE_EXCL);
  return true;
}
