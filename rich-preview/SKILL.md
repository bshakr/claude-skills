---
name: rich-preview
description: Turn completed Markdown plans, summaries, reports, and similar source documents into polished, lossless local MDX webpages. Use when a user wants a rich visual preview of an existing document while preserving its full source content.
---

# Rich Preview

Create a local webpage project from a source document without changing or discarding the source.

## Initialize a preview

Run the initializer from this skill directory:

```bash
python scripts/init_preview.py <source> --output <directory> --slug <slug>
```

The initializer copies `assets/template/` to the output directory, preserves the source byte-for-byte at `src/content/source.md`, and writes its provenance and SHA-256 digest to `src/content/preview-manifest.json`.

If the output directory contains files, stop and ask the user before replacing it. Pass `--force` only when the user explicitly authorizes replacement.

## Build the preview

Treat `src/content/source.md` as canonical. Preserve every section, list item, table cell, code block, and link when adapting the source into MDX. Use the copied template as the webpage project and keep generated presentation separate from canonical source content.
