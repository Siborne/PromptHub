export interface ElectronChildForRestart {
  exitCode: number | null;
  pid: number | undefined;
  signalCode: NodeJS.Signals | null;
  once(event: "exit", listener: () => void): unknown;
  removeAllListeners(event: "exit"): unknown;
}

export interface ElectronRestartCoordinator {
  request(restart: () => Promise<void>): Promise<void>;
}

export function createElectronRestartCoordinator(): ElectronRestartCoordinator {
  let latestGeneration = 0;
  let queue = Promise.resolve();

  return {
    request(restart) {
      const generation = ++latestGeneration;
      const runLatest = async () => {
        if (generation !== latestGeneration) return;
        await restart();
      };
      queue = queue.then(runLatest, runLatest);
      return queue;
    },
  };
}

export async function stopElectronBeforeRestart(
  child: ElectronChildForRestart | undefined,
  stopTree: (pid: number) => void,
  timeoutMs = 5_000,
): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (!child.pid) throw new Error("Electron child is missing a process id");

  child.removeAllListeners("exit");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exited = new Promise<void>((resolve) => child.once("exit", resolve));
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`Electron child did not exit within ${timeoutMs} ms`)),
      timeoutMs,
    );
  });

  try {
    stopTree(child.pid);
    await Promise.race([exited, timedOut]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
