/// <reference types="vite/client" />

/** Injected at build time (vite.config.ts `define`) — also mirrored into dist/version.json for the new-version check (see hooks/useVersionCheck.ts). */
declare const __BUILD_ID__: string;
