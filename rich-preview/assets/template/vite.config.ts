import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const virtualSourceId = "\0rich-preview:source";
const virtualManifestId = "\0rich-preview:manifest";

function contentFallback(): Plugin {
  return {
    name: "rich-preview-content-fallback",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer) {
        return null;
      }

      const [path] = id.split("?", 1);
      const resolvedPath = resolve(dirname(importer), path);
      if (existsSync(resolvedPath)) {
        return null;
      }
      if (id.endsWith("/content/source.md?raw")) {
        return virtualSourceId;
      }
      if (id.endsWith("/content/preview-manifest.json")) {
        return virtualManifestId;
      }
      return null;
    },
    load(id) {
      if (id === virtualSourceId) {
        return 'export default "# Preview\\n\\nAdd canonical source with init_preview.py.\\n";';
      }
      if (id === virtualManifestId) {
        return `export default ${JSON.stringify({
          slug: "preview",
          source_filename: "source.md",
          source_path: "src/content/source.md",
          source_sha256: "template",
        })};`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [contentFallback(), mdx(), react()],
  build: {
    chunkSizeWarningLimit: 600,
  },
});
