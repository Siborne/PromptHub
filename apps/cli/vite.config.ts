import path from "path";
import { builtinModules } from "module";
import { defineConfig } from "vitest/config";

const externalModules = new Set([
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
  "node-sqlite3-wasm",
]);

export default defineConfig({
  test: {
    // CLI tests share process-wide runtime paths, database handles, cwd, and HOME.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@prompthub/core": path.resolve(__dirname, "../../packages/core/src"),
      "@prompthub/shared": path.resolve(__dirname, "../../packages/shared"),
      "@prompthub/db": path.resolve(__dirname, "../../packages/db/src"),
    },
  },
  build: {
    outDir: "out",
    minify: false,
    target: "node24",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["cjs"],
      fileName: () => "prompthub.cjs",
    },
    rollupOptions: {
      external: (id) =>
        externalModules.has(id) ||
        [...externalModules].some((item) => id.startsWith(`${item}/`)),
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
