import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["performance/**/*.perf.ts"],
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    testTimeout: 60_000,
  },
});
