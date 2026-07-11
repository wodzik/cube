import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// smartcube-web-bluetooth is installed straight from GitHub and ships no
// prebuilt dist/ (its package.json "main"/"module"/"types" point at dist
// paths that only exist after running its own build, which itself needs
// devDependencies — vitest, etc. — that aren't installed for a nested git
// dependency). Point directly at its TS source instead: esbuild transpiles
// it like any other source file, no prebuild step needed. Matched by a
// "paths" entry in tsconfig.json so `tsc --noEmit` resolves the same way.
const smartcubeSrc = fileURLToPath(
  new URL("./node_modules/smartcube-web-bluetooth/src/index.ts", import.meta.url)
);

const workerImportMetaUrlRE =
  /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\))/g;

// Build identity for the "new version available" check: baked into the
// bundle as __BUILD_ID__ AND emitted as dist/version.json. A deployed page
// polls version.json (see hooks/useVersionCheck.ts) and prompts a reload
// when the served id no longer matches its own baked-in one.
const buildId = new Date().toISOString();

export default defineConfig({
  // Relative base — required for GitHub Pages, which serves project sites
  // under /<repo-name>/ (unknown at build time). All asset URLs become
  // relative to index.html, so the build works from any subpath.
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "emit-version-json",
      apply: "build",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ buildId }) });
      },
    },
  ],
  resolve: {
    alias: {
      "smartcube-web-bluetooth": smartcubeSrc,
    },
  },
  build: {
    chunkSizeWarningLimit: 2048,
  },
  optimizeDeps: {
    // cubing ships its own workers/wasm — pre-bundling breaks it.
    exclude: ["cubing"],
  },
  worker: {
    format: "es",
    plugins: () => [
      {
        name: "disable-nested-workers",
        enforce: "pre",
        transform(code: string, _id: string) {
          if (
            code.includes("new Worker") &&
            code.includes("new URL") &&
            code.includes("import.meta.url")
          ) {
            return code.replace(
              workerImportMetaUrlRE,
              `((() => { throw new Error('Nested workers are disabled') })()`
            );
          }
        },
      },
    ],
    rollupOptions: {
      output: {
        chunkFileNames: "assets/worker/[name]-[hash].js",
        assetFileNames: "assets/worker/[name]-[hash].js",
      },
    },
  },
});
