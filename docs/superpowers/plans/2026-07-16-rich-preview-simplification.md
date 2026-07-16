# Rich Preview simplification plan (2026-07-16)

## Why

The initial implementation (PR #3) optimizes for provenance attestation — SHA-256
manifests, exact-substring citations for every editorial claim, a hand-rolled SVG
chart library, and three redundant validation layers. The actual goal is much
smaller: after a planning session, an agent turns a markdown plan/summary into a
beautiful, consistent local web page with minimal friction.

Cost of the current design per use: full template copy + `npm ci` (minutes,
hundreds of MB), authoring a `report-data.json` with exact evidence spans, running
an 1,867-line vitest suite plus `tsc -b && vite build`, all before serving. Known
defects: `sourceCoverage()` hardcodes 100% (the coverage gate can never fail), and
`report.mdx` silently blanks the entire editorial layer if any single citation is
invalid.

Target: ~1,200 lines total (excluding lockfile), zero per-preview install, agent
authors one MDX file directly, and the design language (styles.css, editorial
components) is preserved.

## New architecture

```
rich-preview/
  SKILL.md                      # ≤60 lines: workflow + editorial recipe
  references/components.md      # ≤100 lines: component vocabulary with prop examples
  agents/openai.yaml            # updated to match new workflow
  scripts/
    init_preview.py             # copy template (minus node_modules), symlink node_modules,
                                # write source.md verbatim; auto-run `npm ci` in the
                                # template on first use if node_modules is missing
    serve_preview.py            # unchanged behavior (port probe + vite dev)
    validate_preview.py         # ~20 lines: run `npm run build` in the preview, that's it
  assets/template/
    package.json                # trimmed deps (see below)
    package-lock.json           # regenerated
    index.html, vite.config.ts, tsconfig.json, src/mdx.d.ts
    src/main.tsx                # imports source.md?raw + report.mdx, renders <Report source={...}>
    src/report.mdx              # starter the agent overwrites: Hero + example sections + CompleteDocument
    src/content/source.md       # placeholder, replaced by init
    src/components/editorial.tsx  # Hero, HighlightGrid, ComparisonGrid, Timeline,
                                   # RiskList, ActionList, CompleteDocument — plain props,
                                   # no SourceRef, no validation, keep visual markup/classes
    src/components/mermaid.tsx  # small <Mermaid> component (client-side render of a
                                # mermaid string) for diagrams/flows/charts
    src/styles.css              # keep, minus provenance-anchor/citation rules
  tests/                        # slim pytest suite: init (copy/symlink/source verbatim/
                                # force semantics), serve (port selection), skill contract
                                # (SKILL.md frontmatter, referenced files exist)
    fixtures/short-plan.md
```

## Delete entirely

- `assets/template/src/lib/provenance.ts` and `src/lib/source.ts`
- `assets/template/scripts/validate-content.ts` + `validate-content.test.ts`
- `assets/template/src/report.test.tsx` and `vite.config.test.ts` (the template ships
  no test suite; previews are disposable outputs, not codebases)
- `assets/template/src/content/report-data.json` and the whole EditorialData/SourceRef
  JSON layer — the agent writes MDX with literal props instead
- `assets/template/src/components/graphs/` (charts.tsx, processes.tsx) — replaced by
  the `<Mermaid>` component
- `references/authoring-contract.md` — replaced by `references/components.md`
- SHA-256 digest, `preview-manifest.json`, and all digest checks
- `tests/test_validate_preview.py`, `tests/test_public_repository.py`, and fixtures
  tied to the provenance flow (`authored-report-data.json`, `authored-plan.md` if
  no longer used)
- `docs/superpowers/plans/2026-07-15-rich-preview.md` and
  `docs/superpowers/specs/2026-07-15-rich-preview-design.md` — superseded by this
  plan; delete rather than keep stale specs

## Keep / adapt

- **styles.css**: keep the visual system (typography, cards, hero, timeline, risk
  levels, print rules, dark-mode if present). Remove citation/anchor/verification-view
  styles that no longer have markup.
- **editorial.tsx**: same components and DOM/classes, props simplified to plain
  strings/arrays. `RiskList` keeps `level: "low" | "medium" | "high"`.
  `CompleteDocument` takes `{ source: string }`, renders the full markdown via
  react-markdown + remark-gfm inside a collapsible "Full document" section, plus a
  `<details>` with the raw text. No node anchors, no manifest.
- **main.tsx**: `import source from "./content/source.md?raw"` and render
  `<Report source={source} />`. No manifest import.
- **report.mdx**: starter showing the intended shape —

  ```mdx
  import { Hero, HighlightGrid, Timeline, RiskList, ActionList, CompleteDocument } from "./components/editorial"
  import { Mermaid } from "./components/mermaid"
  import "./styles.css"

  export const Report = ({ source }) => (
    <div className="preview-shell">
      {/* agent-authored sections */}
      <CompleteDocument source={source} />
    </div>
  )

  <Report {...props} />
  ```

- **init_preview.py**: copy template excluding `node_modules`; then
  `os.symlink(template/node_modules, preview/node_modules)`. If the template has no
  `node_modules`, run `npm ci` in the template first (print a one-line notice).
  Keep `--force` semantics (refuse to clobber a non-empty dir without it). Write the
  source file byte-identical to `src/content/source.md`.
- **serve_preview.py**: keep as-is (loopback pin, port probe, `--strictPort`).
- **package.json deps**: `react`, `react-dom`, `@mdx-js/react`, `react-markdown`,
  `remark-gfm`, `mermaid`. Dev: `vite`, `@vitejs/plugin-react`, `@mdx-js/rollup`,
  `typescript`, `@types/react`, `@types/react-dom`. Drop `rehype-raw`,
  `rehype-sanitize`, `remark-parse`, `unified`, `unist-util-visit`, `vitest`, `tsx`,
  `@types/node`. Use whatever versions npm resolves; do NOT pin-check versions
  anywhere outside package.json. `build` script = `vite build` (no `tsc -b`).
- **SKILL.md** (≤60 lines): workflow =
  1. Save the source markdown verbatim.
  2. `python scripts/init_preview.py <source.md> --output <dir>` (the `--slug`
     argument was dropped — its only consumer was the deleted manifest)
  3. Read `references/components.md`; overwrite `src/report.mdx` with an editorial
     page: hero, a few grounded highlights, timeline/risks/actions only when the
     source states them, mermaid diagrams only for structure the source describes,
     and ALWAYS `<CompleteDocument source={source} />` at the end. Don't invent
     facts, numbers, or owners that aren't in the source. Sparse source → sparse page.
  4. `python scripts/validate_preview.py <dir>` (runs the vite build; fix errors)
  5. `python scripts/serve_preview.py <dir> --port <n>`, curl the printed URL for
     HTTP 200, hand the URL to the user, keep the server running.
- **references/components.md**: one section per component with a realistic MDX
  usage snippet; one short section on mermaid (flowchart, sequence, xychart) with
  the guidance "only diagram structure the source actually states".
- **README.md**: update the rich-preview section to the new workflow.
- **agents/openai.yaml**: update descriptions/steps to match.

## Verification (must actually run, not just tests)

1. `python -m pytest rich-preview/tests` — green.
2. End-to-end dry run: `init_preview.py` on `tests/fixtures/short-plan.md` into a
   temp dir, author a small real `report.mdx` (hero + 2 highlights + mermaid
   flowchart + CompleteDocument), `validate_preview.py` (build passes),
   `serve_preview.py`, `curl` the URL → 200 and page HTML contains the hero title.
   Then stop the server and delete the temp preview.
3. `wc -l` over `rich-preview/` excluding `package-lock.json`: report the total in
   the commit message; target ≤ ~1,500.

## Out of scope

- No provenance/citation system of any kind.
- No per-preview or in-template JS test suites.
- No changes to other skills in the repo.
