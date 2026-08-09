/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injetado pelo Vite em tempo de compilação (ver vite.config.ts). */
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_POKEMONTCG_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
