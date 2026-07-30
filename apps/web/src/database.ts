import { getDatabase, initDatabase } from '@prompthub/db';
import { getDatabasePath } from './runtime-paths.js';
import { seedTestDatabaseFromTemplate } from './test-helpers/database-template.js';

let initialized = false;

export function getServerDatabase() {
  if (!initialized) {
    // The Web image is a single-server deployment per mounted DATA_ROOT. Allow
    // the shared initializer to recover a lock left by a pre-lease/crashed run;
    // live registered clients are still protected by the lease scan.
    const databasePath = getDatabasePath();
    seedTestDatabaseFromTemplate(databasePath);
    initDatabase(databasePath, { recoverUnregisteredLock: true });
    initialized = true;
  }

  return getDatabase();
}
