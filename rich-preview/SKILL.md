---
name: rich-preview
description: Use when a completed plan, investigation, summary, or decision memo needs a polished local webpage — an editorial layer of highlights, timelines, risks, and mermaid diagrams over the full source document, served on localhost.
---

# Rich Preview

Turn a finished Markdown document into a beautiful local web page. You author one MDX
file directly; the full source is always preserved and rendered underneath the
editorial layer.

## Workflow

1. Preserve the source. If it lives in the conversation, save it verbatim as a `.md`
   file first. Never rewrite, condense, or reorder it.
2. Initialize a preview (use absolute paths when the source or output is elsewhere):

   ```bash
   python scripts/init_preview.py <source.md> --output <preview-dir>
   ```

   This copies the template, symlinks its shared `node_modules` (running `npm ci`
   in the template once on first use), and writes your source to
   `src/content/source.md`. Pass `--force` to replace a non-empty output directory.
3. Read `references/components.md`, then overwrite `<preview-dir>/src/report.mdx`:
   - A `Hero` with the source's real title and a one-line summary.
   - Editorial sections (`HighlightGrid`, `ComparisonGrid`, `Timeline`, `RiskList`,
     `ActionList`) built only from facts the source states. Skip any section the
     source has no material for — a sparse source makes a sparse page.
   - `Mermaid` diagrams only for structure the source actually describes.
   - Always end with `<CompleteDocument source={source} />`.

   Do not invent titles, numbers, owners, or dates that are not in the source.
4. Validate (runs the production build; fix any error it reports):

   ```bash
   python scripts/validate_preview.py <preview-dir>
   ```

5. Serve it in a persistent session and confirm it is up:

   ```bash
   python scripts/serve_preview.py <preview-dir> --port <preferred-port>
   ```

   The server prints the URL and may pick the next free port. Verify HTTP 200 with
   `curl --fail --silent -o /dev/null -w '%{http_code}\n' <url>`, then hand the URL
   to the user and keep the server running.

Never report success from a build you did not run, and never replace the complete
source with an editorial summary.
