import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createServer,
  type UserConfig,
  type ViteDevServer,
} from "vite";
import { afterEach, describe, expect, it } from "vitest";

import { extractSourceNodes } from "./src/lib/source";
import previewConfig from "./vite.config";

const placeholderSource =
  "# Preview\n\nAdd canonical source with init_preview.py.\n";

describe("rich preview source loading", () => {
  let root: string | undefined;
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    await server?.close();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function createPreviewServer(importPath: string) {
    root = await mkdtemp(
      join(await realpath(tmpdir()), "rich-preview-vite-"),
    );
    await mkdir(join(root, "src", "content"), { recursive: true });
    await writeFile(
      join(root, "src", "entry.ts"),
      `import source from ${JSON.stringify(importPath)}; export default source;`,
    );
    server = await createServer({
      ...(previewConfig as UserConfig),
      root,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true },
    });
  }

  it.each(["/src/content/source.md?raw", "./content/source.md?raw"])(
    "loads an existing source import as raw text: %s",
    async (importPath) => {
      const source = "# Generated report\n\nKeep this exact source.\n";
      await createPreviewServer(importPath);
      await writeFile(join(root!, "src", "content", "source.md"), source);

      const loaded = await server!.ssrLoadModule("/src/entry.ts");

      expect(loaded.default).toBe(source);
      expect(loaded.default).not.toBe(placeholderSource);
      expect(extractSourceNodes(loaded.default)).not.toHaveLength(0);
    },
  );

  it("keeps raw Markdown requests outside MDX compilation", async () => {
    const source = "# Raw source\n\nThis must remain Markdown.\n";
    await createPreviewServer("/src/content/source.md?raw");
    await writeFile(join(root!, "src", "content", "source.md"), source);

    const transformed = await server!.transformRequest(
      "/src/content/source.md?raw",
    );

    expect(transformed?.code).toContain(
      `export default ${JSON.stringify(source)}`,
    );
  });

  it("uses placeholder source only when the generated source is absent", async () => {
    await createPreviewServer("/src/content/source.md?raw");

    const loaded = await server!.ssrLoadModule("/src/entry.ts");

    expect(loaded.default).toBe(placeholderSource);
  });
});
