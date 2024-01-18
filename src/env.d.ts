/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly BASE_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare module '*.svg?react';
