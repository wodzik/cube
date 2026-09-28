import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  build: {
    chunkSizeWarningLimit: 2048,
    // No modulepreload hints for dynamic imports. Vite's preload helper
    // touches `document` the moment a dep list is present — fatal in a chunk
    // that runs inside a module worker (cubecore's solver worker): "document
    // is not defined", no scrambles, in production only. Costs only the
    // preload hint, not correctness: imports still resolve normally.
    modulePreload: false,
    rolldownOptions: {
      output: {
        // Run modules in source order whatever chunk they land in. Automatic
        // splitting puts shared code (React, the icons, cubecore…) in chunks
        // that import each other in cycles; without this a module could run
        // before one it depends on — e.g. an icon before React ("reading
        // 'forwardRef'" of undefined): a blank page, in production only.
        strictExecutionOrder: true,
      },
    },
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        chunkFileNames: "assets/worker/[name]-[hash].js",
        assetFileNames: "assets/worker/[name]-[hash].js",
      },
    },
  },
});
