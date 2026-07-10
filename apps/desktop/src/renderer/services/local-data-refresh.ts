export interface LocalDataRefreshDependencies {
  fetchPrompts: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  isVisible?: () => boolean;
}

export interface LocalDataRefreshController {
  refresh: () => Promise<void>;
}

export function createLocalDataRefreshController(
  dependencies: LocalDataRefreshDependencies,
): LocalDataRefreshController {
  let inFlight: Promise<void> | null = null;

  return {
    refresh: () => {
      if (dependencies.isVisible?.() === false) {
        return Promise.resolve();
      }
      if (inFlight) {
        return inFlight;
      }

      inFlight = Promise.all([
        dependencies.fetchPrompts(),
        dependencies.fetchFolders(),
      ])
        .then(() => undefined)
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
  };
}
