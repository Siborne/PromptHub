/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROMPTHUB_CLOUD_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
