# Rich Preview Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portable `rich-preview` Agent Skill that turns Markdown or MDX plans and summaries into lossless, editorially composed localhost webpages with source-grounded diagrams, quantitative charts, print styling, and verifiable 100% source coverage.

**Architecture:** A Python initializer copies a pinned React/Vite/MDX template and the canonical source into `.rich-preview/<slug>/`, recording its SHA-256 digest. The agent authors only the additive editorial layer and structured visual specifications; shared React components render the entire source plus responsive SVG process graphs and charts, while Python and Vitest validators enforce digest, coverage, provenance, accessibility, build, and localhost contracts.

**Tech Stack:** Python 3 standard library; React 19.2.7; React DOM 19.2.7; TypeScript 7.0.2; Vite 8.1.4; MDX 3.1.1; React Markdown 10.1.0; Unified 11.0.5; Remark Parse 11.0.0; Remark GFM 4.0.1; Rehype Raw 7.0.0; Unist Visit 5.1.0; Vitest 4.1.1.

## Global Constraints

- Work only in `/Users/bass/code/agent-skills-worktrees/rich-preview` on branch `no-ticket/rich-preview-skill`.
- Keep `SKILL.md` portable across Claude Code, Codex, and other Agent Skills-compatible harnesses; harness-specific metadata belongs only in `agents/openai.yaml`.
- The generated presentation is additive: the byte-for-byte canonical source, full formatted document, raw verification block, SHA-256 digest, and 100% coverage result are mandatory.
- A generated node, edge, value, unit, sign, date, label, or conclusion must carry an exact source span and stable source-node ID.
- Ambiguous visual transformations fall back to a polished source block; they never guess.
- Graphs use local React, SVG, and CSS only. Do not install or require Chromium, browser automation, remote fonts, runtime images, or proprietary site builders.
- Treat canonical Markdown and MDX as untrusted data: display raw HTML or MDX constructs as inert source text and never execute embedded scripts or imported components.
- Generated outputs default to `.rich-preview/<slug>/` and must not overwrite an existing customized directory without an explicit `--force` argument.
- Private organization sources are local evaluation inputs only. Do not commit their paths, identifiers, or content to the public `https://github.com/bshakr/agent-skills` repository.
- Use exact dependency versions and commit `package-lock.json`.
- Use test-first implementation, run focused tests after each task, and do not use broad Pants test scopes.

---

## File Map

### Portable skill

- `rich-preview/SKILL.md` — trigger and end-to-end agent workflow.
- `rich-preview/agents/openai.yaml` — optional Codex display metadata.
- `rich-preview/references/authoring-contract.md` — editorial composition, graph-selection, provenance, and lossless-content rules.
- `rich-preview/scripts/init_preview.py` — safe template copy, source preservation, manifest creation.
- `rich-preview/scripts/validate_preview.py` — portable structural checks plus focused test/build orchestration.
- `rich-preview/scripts/serve_preview.py` — loopback port selection and retained Vite server.
- `rich-preview/assets/template/` — pinned generated-site template.

### Generated template

- `src/content/source.md` — byte-for-byte canonical source copied by the initializer.
- `src/content/preview-manifest.json` — source filename, original path, SHA-256 digest, and slug.
- `src/content/report-data.json` — editorial metadata and all structured visual specifications.
- `src/report.mdx` — additive editorial composition plus mandatory `CompleteDocument`.
- `src/lib/source.ts` — Markdown AST extraction, stable source-node IDs, node counts, URL extraction.
- `src/lib/provenance.ts` — exact-span and quantitative provenance validation.
- `scripts/validate-content.ts` — Node-side source-node, URL, coverage, and visual-provenance report consumed by Python validation.
- `src/components/editorial.tsx` — hero, cards, comparisons, timeline, actions, and complete-source components.
- `src/components/graphs/processes.tsx` — process, branch, sequence, and dependency SVGs.
- `src/components/graphs/charts.tsx` — bar, line, stacked-bar, and comparison SVGs with tabular alternatives.
- `src/styles.css` — shared screen, responsive, accessibility, and A4 print tokens.
- `src/report.test.tsx` — lossless, provenance, component, and build-contract tests.

### Repository support

- `rich-preview/tests/` — Python unit tests and synthetic Markdown fixtures only.
- `README.md` — renamed repository and Claude/Codex installation instructions.
- `.rich-preview/demo-index/` — ignored local demo hub generated after implementation; never committed.

---

### Task 1: Scaffold the skill and implement safe preview initialization

**Files:**
- Create: `rich-preview/SKILL.md`
- Create: `rich-preview/agents/openai.yaml`
- Create: `rich-preview/scripts/init_preview.py`
- Create: `rich-preview/tests/test_init_preview.py`
- Create: `rich-preview/assets/template/.gitkeep`

**Interfaces:**
- Consumes: a source `Path`, destination `Path`, template `Path`, slug string, and explicit force flag.
- Produces: `create_preview(source: Path, output: Path, template: Path, slug: str, force: bool = False) -> dict[str, object]` and a JSON manifest at `src/content/preview-manifest.json`.

- [ ] **Step 1: Initialize the portable skill skeleton**

Run:

```bash
python /Users/bass/.codex/skills/.system/skill-creator/scripts/init_skill.py rich-preview \
  --path /Users/bass/code/agent-skills-worktrees/rich-preview \
  --resources scripts,references,assets \
  --interface display_name='Rich Preview' \
  --interface short_description='Turn plans and summaries into polished webpages' \
  --interface default_prompt='Use $rich-preview to turn this completed plan into a polished, lossless local MDX webpage.'
```

Expected: `rich-preview/` exists with `SKILL.md`, resource directories, and `agents/openai.yaml`.

- [ ] **Step 2: Write failing initializer tests**

Create tests that assert the source is copied byte-for-byte, the manifest digest equals `hashlib.sha256(source_bytes).hexdigest()`, a customized existing directory raises `FileExistsError`, and `force=True` replaces it:

```python
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from init_preview import create_preview

class InitPreviewTest(unittest.TestCase):
    def test_create_preview_preserves_source_and_digest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_bytes(b"# Plan\n\nKeep every byte.\n")
            template = tmp_path / "template"
            (template / "src" / "content").mkdir(parents=True)
            (template / "index.html").write_text("<div id='root'></div>")

            manifest = create_preview(source, tmp_path / "out", template, "plan")

            self.assertEqual(
                (tmp_path / "out/src/content/source.md").read_bytes(),
                source.read_bytes(),
            )
            self.assertEqual(
                manifest["source_sha256"],
                hashlib.sha256(source.read_bytes()).hexdigest(),
            )
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `python -m unittest discover -s rich-preview/tests -p 'test_init_preview.py' -v`

Expected: FAIL because `rich-preview/scripts/init_preview.py` does not expose `create_preview`.

- [ ] **Step 4: Implement the minimal initializer**

Implement safe copy and manifest creation with this public shape:

```python
def create_preview(
    source: Path,
    output: Path,
    template: Path,
    slug: str,
    force: bool = False,
) -> dict[str, object]:
    source_bytes = source.read_bytes()
    if output.exists() and any(output.iterdir()):
        if not force:
            raise FileExistsError(f"Preview already exists: {output}")
        shutil.rmtree(output)
    shutil.copytree(template, output)
    canonical = output / "src" / "content" / "source.md"
    canonical.parent.mkdir(parents=True, exist_ok=True)
    canonical.write_bytes(source_bytes)
    manifest = {
        "slug": slug,
        "source_filename": source.name,
        "source_path": str(source.resolve()),
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
    }
    (canonical.parent / "preview-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    return manifest
```

Add an `argparse` CLI accepting `source`, `--output`, `--slug`, and `--force`.

- [ ] **Step 5: Run the test and verify GREEN**

Run: `python -m unittest discover -s rich-preview/tests -p 'test_init_preview.py' -v`

Expected: all initializer tests PASS.

- [ ] **Step 6: Commit the initializer**

```bash
git add rich-preview
git commit -m "feat: scaffold rich-preview skill"
```

---

### Task 2: Build the pinned lossless MDX template

**Files:**
- Create: `rich-preview/assets/template/package.json`
- Create: `rich-preview/assets/template/package-lock.json`
- Create: `rich-preview/assets/template/vite.config.ts`
- Create: `rich-preview/assets/template/tsconfig.json`
- Create: `rich-preview/assets/template/index.html`
- Create: `rich-preview/assets/template/src/main.tsx`
- Create: `rich-preview/assets/template/src/mdx.d.ts`
- Create: `rich-preview/assets/template/src/lib/source.ts`
- Create: `rich-preview/assets/template/src/components/editorial.tsx`
- Create: `rich-preview/assets/template/src/report.mdx`
- Create: `rich-preview/assets/template/src/report.test.tsx`
- Create: `rich-preview/tests/fixtures/short-plan.md`

**Interfaces:**
- Consumes: canonical Markdown string imported as `source.md?raw` and `PreviewManifest` JSON.
- Produces: `extractSourceNodes(markdown: string) -> SourceNode[]`, `sourceCoverage(markdown: string) -> SourceCoverage`, and `<CompleteDocument source manifest />`.

- [ ] **Step 1: Write the failing lossless-render tests**

Use `renderToStaticMarkup` and assert the same canonical string feeds the formatted document and raw verification block:

```tsx
it("renders the complete canonical source and raw verification", () => {
  const source = "# Plan\n\nFirst paragraph.\n\n- Keep this item\n";
  const manifest = {
    slug: "plan",
    source_filename: "plan.md",
    source_path: "/tmp/plan.md",
    source_sha256: "eee82b2be304875b7f6ea3f8c9cc3c8d3a2cfcad892b549b936f8fcd5709de7c",
  };
  const escapeHtml = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const markup = renderToStaticMarkup(
    <CompleteDocument source={source} manifest={manifest} />,
  );
  expect(markup).toContain('data-complete-document="true"');
  expect(markup).toContain("First paragraph.");
  expect(markup).toContain("Keep this item");
  expect(markup).toContain(escapeHtml(source));
  expect(markup).toContain(manifest.source_sha256);
});
```

Add AST tests for headings, paragraphs, list items, table cells, fenced code, link text, and raw URLs in source order.

- [ ] **Step 2: Run the template test and verify RED**

Run: `cd rich-preview/assets/template && npm test -- --run src/report.test.tsx`

Expected: FAIL because the package and source components do not exist.

- [ ] **Step 3: Add the exact pinned package configuration**

Use these dependencies in `package.json` and generate `package-lock.json` with `npm install`:

```json
{
  "name": "rich-preview-report",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest",
    "validate:content": "tsx scripts/validate-content.ts",
    "build": "tsc -b && vite build"
  },
  "dependencies": {
    "@mdx-js/react": "3.1.1",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-markdown": "10.1.0",
    "rehype-raw": "7.0.0",
    "rehype-sanitize": "6.0.0",
    "remark-gfm": "4.0.1",
    "remark-parse": "11.0.0",
    "unified": "11.0.5",
    "unist-util-visit": "5.1.0"
  },
  "devDependencies": {
    "@mdx-js/rollup": "3.1.1",
    "@types/node": "26.1.1",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "typescript": "7.0.2",
    "tsx": "4.23.1",
    "vite": "8.1.4",
    "vitest": "4.1.1"
  }
}
```

- [ ] **Step 4: Implement source analysis and the complete-document component**

Define stable node identities from type and positional range:

```ts
export type SourceNode = {
  id: string;
  type: string;
  text: string;
  startLine: number;
  endLine: number;
  urls: string[];
};

export type SourceRef = {
  nodeId: string;
  evidence: string;
};

export function sourceNodeId(type: string, startLine: number, endLine: number): string {
  return `${type}:${startLine}-${endLine}`;
}
```

`CompleteDocument` must render `ReactMarkdown` from the unmodified `source` prop, show the node count and 100% coverage badge, and include `<details><pre>{source}</pre></details>` for literal verification. Raw HTML and MDX constructs must render as inert code or sanitized content; never execute canonical source code.

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
cd rich-preview/assets/template
npm test -- --run src/report.test.tsx
npm run build
```

Expected: tests PASS and Vite emits `dist/index.html` without errors.

- [ ] **Step 6: Commit the lossless template**

```bash
git add rich-preview/assets/template rich-preview/tests/fixtures/short-plan.md
git commit -m "feat: add lossless preview template"
```

---

### Task 3: Add the editorial composition system

**Files:**
- Create: `rich-preview/assets/template/src/content/report-data.json`
- Modify: `rich-preview/assets/template/src/components/editorial.tsx`
- Modify: `rich-preview/assets/template/src/report.mdx`
- Create: `rich-preview/assets/template/src/styles.css`
- Modify: `rich-preview/assets/template/src/report.test.tsx`

**Interfaces:**
- Consumes: `EditorialData` with title, eyebrow, lede, status, highlights, comparisons, timeline, risks, and actions.
- Produces: `Hero`, `HighlightGrid`, `ComparisonGrid`, `Timeline`, `RiskList`, `ActionList`, `SourceBadge`, and `PrintButton` React components.

- [ ] **Step 1: Write failing editorial-component tests**

```tsx
it("renders a verdict-led editorial layer before the canonical document", () => {
  const markup = renderToStaticMarkup(<Report />);
  expect(markup.indexOf('data-editorial-layer="true"')).toBeLessThan(
    markup.indexOf('data-complete-document="true"'),
  );
  expect(markup).toContain("Key decisions");
  expect(markup).toContain("Next actions");
});
```

Assert that empty arrays suppress their section rather than rendering filler.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd rich-preview/assets/template && npm test -- --run src/report.test.tsx`

Expected: FAIL because the editorial components and data contract are absent.

- [ ] **Step 3: Implement the editorial data types and components**

Use a discriminated content contract:

```ts
export type EditorialData = {
  title: string;
  eyebrow: string;
  lede: string;
  status: string;
  highlights: Array<{ label: string; title: string; body: string; source: SourceRef[] }>;
  comparisons: Array<{ label: string; before: string; after: string; source: SourceRef[] }>;
  timeline: Array<{ label: string; title: string; body: string; source: SourceRef[] }>;
  risks: Array<{ level: "low" | "medium" | "high"; title: string; body: string; source: SourceRef[] }>;
  actions: Array<{ title: string; body: string; source: SourceRef[] }>;
};
```

Render only non-empty sections and attach the resolved `data-source-node-ids` to every editorial item. Task 4 extends provenance validation across these editorial source refs as well as graphs.

- [ ] **Step 4: Implement the shared visual and print system**

Add deep-ink/purple editorial tokens, warm surfaces, semantic status colours, responsive cards, keyboard focus, selectable text, `@page { size: A4; margin: 14mm; }`, and `break-inside: avoid` for cards and visuals.

- [ ] **Step 5: Run tests and build**

Run:

```bash
cd rich-preview/assets/template
npm test -- --run src/report.test.tsx
npm run build
```

Expected: editorial tests PASS and the production build succeeds.

- [ ] **Step 6: Commit the editorial system**

```bash
git add rich-preview/assets/template
git commit -m "feat: add editorial preview components"
```

---

### Task 4: Add process graphs and exact-span provenance

**Files:**
- Create: `rich-preview/assets/template/src/lib/provenance.ts`
- Create: `rich-preview/assets/template/src/components/graphs/processes.tsx`
- Modify: `rich-preview/assets/template/src/content/report-data.json`
- Modify: `rich-preview/assets/template/src/report.test.tsx`
- Modify: `rich-preview/assets/template/src/styles.css`

**Interfaces:**
- Consumes: `SourceNode[]`, `SourceRef` from `src/lib/source.ts`, editorial data, and process specs from `report-data.json`.
- Produces: `validateSourceRef(ref: SourceRef, nodes: SourceNode[]) -> ValidationResult`, `validateProcessSpec(spec, nodes)`, and four accessible SVG graph components.

- [ ] **Step 1: Write failing provenance and process-graph tests**

```ts
it("rejects an edge whose evidence is absent from the source node", () => {
  const result = validateSourceRef(
    { nodeId: "paragraph:8-9", evidence: "invented relationship" },
    sourceNodes,
  );
  expect(result).toEqual({ valid: false, error: "Evidence not found in paragraph:8-9" });
});
```

Server-render each graph and assert a non-empty `<svg>`, `viewBox`, `<title>`, `<desc>`, visible text explanation, `data-visual-id`, and canonical `Derived from` links.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd rich-preview/assets/template && npm test -- --run src/report.test.tsx`

Expected: FAIL because provenance and graph components are missing.

- [ ] **Step 3: Implement provenance types and validation**

```ts
export type ValidationResult = { valid: true } | { valid: false; error: string };
export type ProcessNodeSpec = { id: string; label: string; source: SourceRef };
export type ProcessEdgeSpec = { from: string; to: string; label?: string; source: SourceRef };
export type ProcessSpec = {
  id: string;
  title: string;
  explanation: string;
  nodes: ProcessNodeSpec[];
  edges: ProcessEdgeSpec[];
};
```

Validate that the node ID exists, evidence is an exact substring, edge endpoints exist, and every graph item has provenance. Add `validateEditorialData` so every generated finding, decision, risk, comparison, timeline item, and action is held to the same exact-span contract.

- [ ] **Step 4: Implement the process graph vocabulary**

Implement `ProcessFlow`, `BranchFlow`, `SequenceFlow`, and `DependencyMap` as deterministic SVG/CSS layouts. Use arrow markers, text labels, shapes plus colour, responsive `viewBox`, and source-anchor links. Do not use Mermaid or a browser-only layout engine.

- [ ] **Step 5: Run tests and build**

Run:

```bash
cd rich-preview/assets/template
npm test -- --run src/report.test.tsx
npm run build
```

Expected: all process and provenance tests PASS; production build succeeds.

- [ ] **Step 6: Commit process graphs**

```bash
git add rich-preview/assets/template
git commit -m "feat: add source-grounded process graphs"
```

---

### Task 5: Add quantitative charts with exact data provenance

**Files:**
- Create: `rich-preview/assets/template/src/components/graphs/charts.tsx`
- Modify: `rich-preview/assets/template/src/lib/provenance.ts`
- Modify: `rich-preview/assets/template/src/report.test.tsx`
- Modify: `rich-preview/assets/template/src/styles.css`

**Interfaces:**
- Consumes: source nodes and `ChartSpec` JSON.
- Produces: `validateChartPoint`, `validateChartSpec`, `BarChart`, `LineChart`, `StackedBar`, and `ComparisonChart` with SVG plus table alternatives.

- [ ] **Step 1: Write failing chart and provenance tests**

```ts
it("rejects a chart value not present in its exact source span", () => {
  const sourceNodes = [{
    id: "tableCell:4-4",
    type: "tableCell",
    text: "Premium | 20%",
    startLine: 4,
    endLine: 4,
    urls: [],
  }];
  const result = validateChartPoint(
    {
      label: "Premium",
      value: 120,
      unit: "%",
      source: { nodeId: "tableCell:4-4", evidence: "Premium | 20%" },
    },
    sourceNodes,
  );
  expect(result.valid).toBe(false);
});
```

Assert that rendered charts contain SVG titles/descriptions, labels, values, units, patterns or text in addition to colour, and a semantic `<table>` containing every plotted datum.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd rich-preview/assets/template && npm test -- --run src/report.test.tsx`

Expected: FAIL because chart components and quantitative validation are missing.

- [ ] **Step 3: Implement the chart contract and validator**

```ts
export type ChartPoint = {
  label: string;
  value: number;
  unit: string;
  series?: string;
  source: SourceRef;
};
export type ChartSpec = {
  id: string;
  title: string;
  explanation: string;
  points: ChartPoint[];
};
```

Normalize only whitespace when matching the literal label, signed value, and unit against the exact evidence span. Do not normalize signs, currencies, percentages, or dates.

- [ ] **Step 4: Implement SVG charts and data-table alternatives**

Use pure SVG geometry and deterministic scales. Handle negative baselines, zero values, multiple series, long labels, and empty data. An empty series renders no chart and reports a validation error.

- [ ] **Step 5: Run tests and build**

Run:

```bash
cd rich-preview/assets/template
npm test -- --run src/report.test.tsx
npm run build
```

Expected: chart tests PASS and the production build succeeds.

- [ ] **Step 6: Commit chart components**

```bash
git add rich-preview/assets/template
git commit -m "feat: add source-grounded charts"
```

---

### Task 6: Implement portable validation and serving scripts

**Files:**
- Create: `rich-preview/scripts/validate_preview.py`
- Create: `rich-preview/scripts/serve_preview.py`
- Create: `rich-preview/tests/test_validate_preview.py`
- Create: `rich-preview/tests/test_serve_preview.py`
- Create: `rich-preview/assets/template/scripts/validate-content.ts`
- Modify: `rich-preview/assets/template/package.json`

**Interfaces:**
- Consumes: generated preview directory and optional preferred port.
- Produces: `validate_preview(preview: Path) -> ValidationReport`, `find_available_port(host: str, preferred: int | None) -> int`, and a CLI that prints `http://127.0.0.1:<port>/` before waiting on Vite.

- [ ] **Step 1: Write failing validator and port-selection tests**

```python
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

def build_fixture_preview(root: Path) -> Path:
    preview = root / "preview"
    content = preview / "src" / "content"
    content.mkdir(parents=True)
    source = b"# Canonical\n"
    (content / "source.md").write_bytes(source)
    (content / "preview-manifest.json").write_text(json.dumps({
        "slug": "canonical",
        "source_filename": "source.md",
        "source_path": "/tmp/source.md",
        "source_sha256": hashlib.sha256(source).hexdigest(),
    }))
    return preview

class ValidatePreviewTest(unittest.TestCase):
    def test_validate_preview_rejects_changed_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/content/source.md").write_text("changed")
            with self.assertRaisesRegex(ValueError, "Source digest mismatch"):
                validate_preview(preview)
```

Mock `socket.bind` to prove the preferred occupied port advances to the next available port. Mock `subprocess.run` and assert `npm test -- --run src/report.test.tsx` precedes `npm run build`.

- [ ] **Step 2: Run focused Python tests and verify RED**

Run:

```bash
python -m unittest discover -s rich-preview/tests -p 'test_*preview.py' -v
```

Expected: FAIL because validation and server functions are absent.

- [ ] **Step 3: Implement deterministic validation**

`validate_preview` must check required files, manifest fields, SHA-256 equality, unresolved placeholders, mandatory `CompleteDocument`, raw verification, and exact package versions. It runs `npm run validate:content`, parses its single JSON line, rejects any coverage below 100% or invalid provenance, then runs focused Vitest and Vite build commands with `check=True` and returns:

Add `scripts/validate-content.ts` to read `src/content/source.md`, `preview-manifest.json`, and `report-data.json`, call the shared TypeScript source and provenance analyzers, and print exactly one JSON object:

```ts
process.stdout.write(JSON.stringify({
  sourceNodes: nodes.length,
  sourceUrls: nodes.flatMap((node) => node.urls).length,
  coveragePercent: 100,
  visuals: visualResults.length,
  provenanceValid: visualResults.every((result) => result.valid),
}) + "\n");
```

```python
@dataclass(frozen=True)
class ValidationReport:
    source_sha256: str
    source_nodes: int
    coverage_percent: int
    visuals: int
    tests_passed: bool
    build_passed: bool
```

- [ ] **Step 4: Implement loopback serving**

Bind-probe `127.0.0.1`, select the preferred port when available or the next free port, print the exact URL with `flush=True`, then run:

```python
subprocess.run(
    ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(port), "--strictPort"],
    cwd=preview,
    check=True,
)
```

- [ ] **Step 5: Run focused unit and integration checks**

Run:

```bash
python -m unittest discover -s rich-preview/tests -p 'test_*.py' -v
python rich-preview/scripts/init_preview.py rich-preview/tests/fixtures/short-plan.md \
  --output /tmp/rich-preview-short --slug short --force
cd /tmp/rich-preview-short && npm install && cd -
python rich-preview/scripts/validate_preview.py /tmp/rich-preview-short
```

Expected: Python tests PASS; validation reports digest match, 100% coverage, focused tests passed, and build passed.

- [ ] **Step 6: Commit validation and serving**

```bash
git add rich-preview/scripts rich-preview/tests rich-preview/assets/template/package.json rich-preview/assets/template/scripts/validate-content.ts
git commit -m "feat: validate and serve rich previews"
```

---

### Task 7: Write the agent-agnostic skill and authoring contract

**Files:**
- Modify: `rich-preview/SKILL.md`
- Modify: `rich-preview/agents/openai.yaml`
- Create: `rich-preview/references/authoring-contract.md`
- Create: `rich-preview/tests/test_skill_contract.py`

**Interfaces:**
- Consumes: completed source file or completed plan/summary in conversation.
- Produces: a validated generated preview and exact localhost URL using only portable files and shell commands.

- [ ] **Step 1: Write failing skill-contract tests**

Assert `SKILL.md` has only `name` and `description` frontmatter, the description begins with `Use when`, and the body requires initialization, editorial composition, provenance, validation, serving, and the exact URL handoff. Assert `agents/openai.yaml` mentions `$rich-preview`.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `python -m unittest discover -s rich-preview/tests -p 'test_skill_contract.py' -v`

Expected: FAIL because the scaffold text does not satisfy the workflow contract.

- [ ] **Step 3: Write concise portable skill instructions**

Use this exact frontmatter:

```yaml
---
name: rich-preview
description: Use when a completed plan, investigation, summary, or decision memo needs a polished, lossless local MDX webpage with editorial highlights, source-grounded diagrams or charts, print styling, or a shareable localhost preview.
---
```

The workflow must direct the agent to preserve the source, initialize the template, read `references/authoring-contract.md`, author `report-data.json` and `report.mdx`, reject unsupported visuals, validate, serve, verify HTTP 200, and return the exact URL.

- [ ] **Step 4: Write the authoring contract and Codex metadata**

Document the positive editorial recipe, component prop shapes, source-node lookup, exact-span provenance examples, graph-selection table, sparse-document restraint, fallback rules, accessibility, print, and raw URL requirements. Use this Codex interface:

```yaml
interface:
  display_name: Rich Preview
  short_description: Turn plans and summaries into polished webpages
  default_prompt: Use $rich-preview to turn this completed plan into a polished, lossless local MDX webpage.
```

- [ ] **Step 5: Validate the skill package**

Run:

```bash
python -m unittest discover -s rich-preview/tests -p 'test_skill_contract.py' -v
python /Users/bass/.codex/skills/.system/skill-creator/scripts/quick_validate.py rich-preview
```

If `skills-ref` is installed, also run `skills-ref validate ./rich-preview`.

Expected: contract tests and available validators PASS.

- [ ] **Step 6: Commit the skill instructions**

```bash
git add rich-preview/SKILL.md rich-preview/agents rich-preview/references rich-preview/tests/test_skill_contract.py
git commit -m "docs: define rich-preview workflow"
```

---

### Task 8: Update the renamed repository documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the repository's five skills and installation locations.
- Produces: agent-agnostic repository documentation with Claude and Codex symlink examples.

- [ ] **Step 1: Update repository identity and skill catalogue**

Change the title to `# agent-skills`, use `https://github.com/bshakr/agent-skills`, describe the collection as Agent Skills-compatible, and add `rich-preview` to the table.

- [ ] **Step 2: Add installation examples for both harnesses**

Document symlinks under both `~/.claude/skills/` and `~/.codex/skills/`, including `rich-preview`, while preserving existing per-skill setup notes.

- [ ] **Step 3: Verify documentation references**

Run:

```bash
rg -n 'claude-skills|github.com/bshakr/claude-skills' README.md
git diff --check
```

Expected: `rg` returns no obsolete repository references and `git diff --check` exits successfully.

- [ ] **Step 4: Commit repository documentation**

```bash
git add README.md
git commit -m "docs: update agent-skills catalogue"
```

---

### Task 9: Run independent forward tests and build the local demo index

**Files:**
- Create locally, ignored: `.rich-preview/demo-index/`
- Create locally, ignored: `.rich-preview/demos/<slug>/`
- Create locally, ignored: `.rich-preview/private-sources.json` mapping approved demo slugs to absolute source paths.

**Interfaces:**
- Consumes: the finished `rich-preview` skill and six approved real documents plus three synthetic fixtures.
- Produces: independently validated previews and a localhost demo hub linking every page.

- [ ] **Step 1: Dispatch three fresh synthetic evaluations**

Give each fresh subagent only the installed skill path and one fixture: implementation plan, investigation summary, or short decision memo. Require output under `/tmp/rich-preview-evals/<slug>`, forbid browser installation, and require the exact validation report and URL.

- [ ] **Step 2: Review synthetic outputs against the contract**

For every output, run `validate_preview.py`, confirm HTTP 200, inspect `report-data.json`, and verify no unsupported claims or visuals. Record and fix skill-level failures, then rerun the affected fresh evaluation.

- [ ] **Step 3: Generate the real local corpus**

Use the completed skill to generate local previews for the revised design specification, the private investigation that inspired the visual style, a short private plan, a medium private process plan, a calculation-heavy private plan, and a long private multi-system plan. Read their paths from ignored `.rich-preview/private-sources.json`; never write those paths into a tracked file. The design preview must be generated by the skill after all component changes are complete.

- [ ] **Step 4: Verify source-specific visuals**

Confirm the medium process page contains a branching graph derived from its ASCII data flow, the calculation-heavy page contains source-backed comparisons, the long page uses navigation and dependencies without hiding detail, and the sparse page contains no filler visuals.

- [ ] **Step 5: Build and serve the demo index**

Create an index at `.rich-preview/demo-index/index.html` with cards for all six pages, size/type labels, source digest, coverage badge, and direct localhost links. Start it on an available port other than 5173, 5188, and 5190; verify the index and every linked page return HTTP 200.

- [ ] **Step 6: Run the full focused verification set**

Run:

```bash
python -m unittest discover -s rich-preview/tests -p 'test_*.py' -v
cd rich-preview/assets/template && npm test -- --run src/report.test.tsx && npm run build
python /Users/bass/.codex/skills/.system/skill-creator/scripts/quick_validate.py rich-preview
git diff --check
```

Expected: all focused tests, template build, skill validation, and diff checks PASS.

- [ ] **Step 7: Commit any reviewed skill corrections**

```bash
git add rich-preview README.md
git commit -m "fix: refine rich-preview from evaluations"
```

Skip this commit when the evaluation produces no tracked corrections. Never stage `.rich-preview/`, `.superpowers/`, or private source content.

---

### Task 10: Install locally and submit the pull request with Graphite

**Files:**
- Create symlink when absent: `~/.claude/skills/rich-preview`
- Create symlink when absent: `~/.codex/skills/rich-preview`

**Interfaces:**
- Consumes: validated branch and local skill directory.
- Produces: live Claude/Codex installations and a published Graphite pull request.

- [ ] **Step 1: Install without overwriting existing paths**

Run `ls -ld` on both destinations. If absent:

```bash
mkdir -p ~/.claude/skills ~/.codex/skills
ln -s /Users/bass/code/agent-skills-worktrees/rich-preview/rich-preview ~/.claude/skills/rich-preview
ln -s /Users/bass/code/agent-skills-worktrees/rich-preview/rich-preview ~/.codex/skills/rich-preview
```

If either path exists, verify it already resolves to this worktree; do not replace another installation silently.

- [ ] **Step 2: Validate through both installed paths**

Run `quick_validate.py` against both symlink destinations and confirm the same `SKILL.md` digest.

- [ ] **Step 3: Verify branch state and Graphite tracking**

Run:

```bash
git status --short
gt track --parent main --force
gt log short
```

Expected: only intentionally ignored local demos remain untracked, and `no-ticket/rich-preview-skill` is directly above `main`.

- [ ] **Step 4: Synchronize trunk and submit**

Run:

```bash
gt sync --force --restack
gt submit --stack --no-interactive --publish --no-edit
```

Expected: Graphite creates or updates a published pull request in `https://github.com/bshakr/agent-skills`.

- [ ] **Step 5: Verify the pull request**

Use `gh pr view --json url,title,state,headRefName,baseRefName` and confirm the branch, `main` base, published state, concise title/body, and full raw PR URL. Do not post a GitHub comment, reply, or review without drafting it and obtaining explicit user approval.
