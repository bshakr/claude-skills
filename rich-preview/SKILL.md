---
name: rich-preview
description: Use when a completed plan, investigation, summary, or decision memo needs a polished, lossless local MDX webpage with editorial highlights, source-grounded diagrams or charts, print styling, or a shareable localhost preview.
---

# Rich Preview

Turn a completed source document into a local editorial webpage. The editorial layer is additive; the complete canonical source remains the authority.

## Workflow

1. Preserve the source. If the source is in the conversation, save the completed document verbatim as Markdown before continuing. Do not rewrite, condense, reorder, or omit source content.
2. From this skill directory, initialize a new preview. Use absolute source and output paths when they are outside the current directory:

   ```bash
   python scripts/init_preview.py <source.md> --output <preview-directory> --slug <slug>
   npm ci --prefix <preview-directory>
   ```

   Do not replace a non-empty output directory without explicit user approval. The initializer stores the byte-identical canonical source at `src/content/source.md` and records its SHA-256 digest.
3. Read `references/authoring-contract.md` completely before authoring the preview.
4. Inspect the canonical source nodes. Author the editorial data in `src/content/report-data.json`, then compose supported editorial sections, diagrams, and charts in `src/report.mdx`. When the source explicitly states a multi-step process, conditional branch, dependency, sequence, or quantitative comparison, include the smallest useful matching visual. Render every included visual spec with its supported component in `src/report.mdx`. Every derived claim and visual element must cite an exact source span. Sparse sources may remain editorial-only.
5. Reject unsupported visuals. If the source does not contain the relationships or numeric values required by a supported component, omit the visual and rely on the complete document.
6. Validate from the skill directory:

   ```bash
   python scripts/validate_preview.py <preview-directory>
   ```

   Resolve every digest, coverage, provenance, test, or build failure before serving.
7. Serve the validated preview in a persistent terminal session:

   ```bash
   python scripts/serve_preview.py <preview-directory> --port <preferred-port>
   ```

   Use the URL printed by the server because it may choose the next available port. Verify that URL returns HTTP 200, for example with `curl --fail --silent --output /dev/null --write-out '%{http_code}\n' <url>`.
8. Return the exact localhost URL to the user. Keep the server running so the page remains available.

Never report success from an unvalidated build or substitute an editorial summary for the complete source.
