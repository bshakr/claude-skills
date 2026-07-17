# Rich Preview hub (2026-07-16)

Supersedes the per-preview layout from
[2026-07-16-rich-preview-simplification.md](2026-07-16-rich-preview-simplification.md)
(whose component/authoring decisions still stand).

## Why

One preview per directory means one dev server, one port, and one `node_modules`
symlink per document, and previews die with their temp dirs. Centralizing turns the
app into infrastructure and a report into pure data: a hub at `~/.rich-preview/`
holds every generated report, serves them from one long-running server on one fixed
port, and renders an index page of everything you've generated, grouped by project
(nory and maki docs stay separated by structure, not by separate apps).

## Architecture

```
~/.rich-preview/                  # the hub — bootstrapped from the skill template
  package.json, vite.config.ts, tsconfig.json, index.html, src/...
  node_modules/                   # installed once, ever
  content/<project>/<slug>/       # a report = pure data, three files
    source.md                     # verbatim source document
    report.mdx                    # agent-authored editorial page
    meta.json                     # { "title", "project", "slug", "date", "source_path" }
```

```
rich-preview/                     # the skill (in this repo)
  SKILL.md                        # workflow rewritten around the hub
  references/components.md       # unchanged vocabulary; imports become @components/...
  agents/openai.yaml
  scripts/
    package_manager.py            # unchanged
    add_report.py                 # replaces init_preview.py
    serve_hub.py                  # replaces serve_preview.py
    validate_hub.py               # replaces validate_preview.py
  assets/template/                # becomes the hub app (content/ starts empty)
  tests/
```

## Hub app (assets/template)

- **Routing**: no router library. `main.tsx` reads `location.pathname` once at
  startup: `/` renders the index, `/<project>/<slug>` renders that report, unknown
  paths render a small not-found with a link home. Index links are plain `<a href>`
  full-page loads. Vite dev's SPA fallback serves `index.html` for every path.
- **Discovery** via glob imports, so dropping a folder into `content/` is enough:
  - `import.meta.glob("../content/*/*/meta.json", { eager: true })` → index data
  - `import.meta.glob("../content/*/*/report.mdx")` → lazy MDX modules
  - `import.meta.glob("../content/*/*/source.md", { query: "?raw", import: "default" })` → lazy source
- **Index page**: hub-styled page listing reports grouped by project (section per
  project), sorted by date descending within each; each entry is a card with title,
  date, and source path, linking to `/<project>/<slug>`. Reuse the existing design
  language (styles.css vocabulary) — this page is part of the product, make it as
  considered as the reports.
- **Error isolation** (required): each report route lazy-loads its MDX inside a
  small class-component error boundary. A report whose MDX throws (bad import,
  runtime error) renders an error card with the message and a link back to the
  index — it must never blank the index or other reports. MDX *compile* errors in
  dev surface as Vite's overlay only when that report is visited; the index stays up
  because it imports only meta.json eagerly.
- **Report modules keep their current shape** — `export const Report = ({ source })`
  and `<Report {...props} />` — the route passes `source` as a prop.
- **Import aliases**: add `resolve.alias` for `@components` → `src/components` and
  `@styles` → `src/styles.css` so report.mdx files under `content/…` don't need
  `../../../src/…` paths. Update references/components.md and the starter to
  `import { Hero } from "@components/editorial"` / `import "@styles"`.
- Put a stable marker in `index.html` (e.g. `<meta name="generator" content="rich-preview-hub">`)
  so `serve_hub.py` can recognize a running hub.

## Scripts

- **add_report.py `<source.md> [--project P] [--slug S] [--hub DIR] [--force]`**
  1. Resolve hub dir (default `~/.rich-preview`, `--hub` mainly for tests).
  2. **Sync the app**: copy every template file EXCEPT `content/` and `node_modules`
     into the hub on every run (the hub app always mirrors the installed skill
     version; `content/` is the only state). If `package.json` changed or
     `node_modules` is missing, run the package-manager install (reuse
     `package_manager.py`).
  3. Infer `project` from the source file's git repo
     (`git -C <source-dir> rev-parse --show-toplevel` basename), fall back to the
     source's parent directory name; `--project` overrides. Infer `slug` from the
     source filename stem; `--slug` overrides.
  4. Create `content/<project>/<slug>/`: refuse if non-empty without `--force`;
     write `source.md` byte-identical; write `meta.json` (title = first `# ` heading
     of the source, else filename stem; date = today; source_path = resolved input
     path); write the starter `report.mdx`.
  5. Print the content dir and the report URL.
- **serve_hub.py `[--hub DIR] [--port 4400]`** — idempotent:
  1. GET `http://127.0.0.1:<port>/` — if it responds and the body contains the
     hub marker, print the URL and exit 0 (already running).
  2. If the port is occupied by something else, exit non-zero with a clear message.
  3. Otherwise start `<pm> run dev -- --host 127.0.0.1 --port <port> --strictPort`
     in the hub, printing the URL first (keep the loopback pin).
- **validate_hub.py `[--hub DIR]`** — run the hub's production build; it compiles
  every report, so it validates all of them (acceptable while the hub is small; the
  primary per-report check is visiting the URL).
- Delete `init_preview.py`, `serve_preview.py`, `validate_preview.py`.

## SKILL.md workflow (rewrite)

1. Save the source verbatim as a `.md` file if it lives in the conversation.
2. `python scripts/add_report.py <source.md>` — note the printed content dir + URL.
3. Read `references/components.md`; author `report.mdx` in the content dir (same
   editorial recipe as today: real hero, grounded sections, sparse source → sparse
   page, mermaid only for structure the source states, `CompleteDocument` last).
4. `python scripts/serve_hub.py` (idempotent), then curl the report URL for 200.
5. Hand the user the report URL (and mention the index at the hub root). Reports
   are data in `~/.rich-preview/content/` — never inside a repo, trivially deleted
   by removing the folder.

## Component compatibility discipline

Reports accumulate; the component vocabulary is now a public API for every past
report. Note at the top of references/components.md: changes must be additive
(new components or new optional props) — never rename, remove, or change the
meaning of existing props.

## Tests (rework)

- `test_add_report.py`: verbatim source copy; meta.json fields incl. title-from-
  heading and fallback; project inference from a real temp git repo + fallback +
  override; slug inference/override; refuse-non-empty vs `--force`; app-sync copies
  template files but never touches `content/`.
- `test_serve_hub.py`: already-running detection via marker (mock HTTP), foreign-
  process-on-port error, command construction (mock subprocess + package_manager).
- `test_skill_contract.py`: update required phrases (add_report.py, serve_hub.py,
  content dir, index).
- Keep `test_package_manager.py`. Delete `test_init_preview.py`/`test_serve_preview.py`
  (port them where behavior survives — the port-probe logic moves into serve_hub).

## Migration of the four demo previews

The demo previews under the session scratchpad (`demo-previews/{project-status,
rti-bacs-plan,ssp-sandbox,pay-run-504}`) were authored against the per-preview
layout. Migrate each into the real hub as `content/nory/<slug>/`: copy `src/content/
source.md` and `src/report.mdx`, rewrite the imports to the new aliases, and write
meta.json by hand (dates from the source docs). They become the index's first
entries and the proof the migration path works. Do not serve — the main session
will start the hub server.

## Verification (must actually run)

1. Pytest suite green.
2. Fresh-hub e2e with `--hub <temp dir>`: add a report from `tests/fixtures/
   short-plan.md`, confirm install ran once, author a small real report.mdx,
   `validate_hub.py` passes, `serve_hub.py` on a test port, curl index → 200 and
   contains the report title; curl the report URL → 200. Run `serve_hub.py` again →
   prints URL without starting a second server. Then kill and delete the temp hub.
3. Broken-report isolation: add a second report whose report.mdx has a deliberate
   runtime error, confirm the index still renders and the good report still loads.
4. Real hub: bootstrap `~/.rich-preview`, migrate the four demo reports, validate.

## Out of scope

- Auth, non-loopback serving, static export of the whole hub, report deletion CLI
  (rm -rf of the content folder is documented as the way).
