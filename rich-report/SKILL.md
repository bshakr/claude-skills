---
name: rich-report
description: Use when a completed plan, investigation, summary, or decision memo needs a polished local webpage — an editorial layer of highlights, timelines, risks, and mermaid diagrams over the full source — added to a local report hub served on localhost.
---

# Rich Report

Turn a finished Markdown document into a beautiful local web page. Reports are added
to a single hub at `~/.rich-report` that serves them all from one long-running
server and shows an index grouped by project. You author one MDX file per report; the
full source is always preserved and rendered underneath the editorial layer.

## Workflow

1. Preserve the source. If it lives in the conversation, save it verbatim as a `.md`
   file first. Never rewrite, condense, or reorder it.
2. Add the report to the hub (use an absolute source path when it is elsewhere):

   ```bash
   python scripts/add_report.py <source.md>
   ```

   This syncs the hub app (installing dependencies once — pnpm when available, npm
   otherwise), then creates `~/.rich-report/content/<project>/<slug>/` with your
   source, a `meta.json`, and a starter `report.mdx`. It prints the content directory
   and the report URL. `project` is inferred from the source's git repo (override with
   `--project`), `slug` from the filename (override with `--slug`); `--force` replaces
   an existing report.
3. Read `references/components.md`, then author `report.mdx` in the printed content
   directory:
   - A `Hero` with the source's real title and a one-line summary.
   - Editorial sections (`HighlightGrid`, `ComparisonGrid`, `Timeline`, `RiskList`,
     `ActionList`) built only from facts the source states. Skip any section the
     source has no material for — a sparse source makes a sparse page.
   - `Mermaid` diagrams only for structure the source actually describes.
   - Author sections as top-level MDX blocks separated by blank lines (never
     wrap the page in a component or a `<div>` — the hub supplies the article
     shell), and always end with `<CompleteDocument source={props.source} />`.

   Do not invent titles, numbers, owners, or dates that are not in the source.
4. Serve the hub (idempotent — reuses the running server if one is up):

   ```bash
   python scripts/serve_hub.py
   ```

   The server detaches into its own session and keeps running after this Claude
   session ends; the command verifies the hub is live, prints the URL, and exits.
   Use `--status` to check whether it is up and `--stop` to shut it down.

   Verify the report with
   `curl --fail --silent -o /dev/null -w '%{http_code}\n' <report-url>`. To build-check
   every report at once, run `python scripts/validate_hub.py`.
5. Hand the user the report URL, and mention the index at the hub root
   (`http://127.0.0.1:4400/`). Reports are plain data under `~/.rich-report/content/`
   — never inside a repository, and deleted by removing the folder.

Never report success from a build you did not run, and never replace the complete
source with an editorial summary.
