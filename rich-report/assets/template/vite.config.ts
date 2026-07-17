import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

const componentsDir = new URL("./src/components", import.meta.url).pathname;
const stylesFile = new URL("./src/styles.css", import.meta.url).pathname;

export default defineConfig({
  plugins: [
    { enforce: "pre", ...mdx({ include: /\.mdx$/, remarkPlugins: [remarkGfm] }) },
    react(),
  ],
  resolve: {
    alias: {
      "@components": componentsDir,
      "@styles": stylesFile,
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
