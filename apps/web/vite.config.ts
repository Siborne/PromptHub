import path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3000';

  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@prompthub/shared/utils': path.resolve(
          __dirname,
          '../../packages/shared/utils',
        ),
        '@prompthub/shared/constants': path.resolve(
          __dirname,
          '../../packages/shared/constants',
        ),
        '@desktop-renderer-app': path.resolve(
          __dirname,
          '../desktop/src/renderer/App.tsx',
        ),
        '@desktop-toast-provider': path.resolve(
          __dirname,
          '../desktop/src/renderer/components/ui/Toast.tsx',
        ),
        '@desktop-renderer-i18n': path.resolve(
          __dirname,
          'src/client/i18n.ts',
        ),
        '@desktop-renderer-globals-css': path.resolve(
          __dirname,
          '../desktop/src/renderer/styles/globals.css',
        ),
      },
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/health': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
