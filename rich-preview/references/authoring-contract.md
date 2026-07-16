# Rich Preview authoring contract

Use the generated template as a constrained visual vocabulary. The agent authors the editorial judgment and grounded specs; the renderer validates and presents them.

## No omissions

`src/content/source.md` is canonical and must stay byte-identical to the input recorded in `preview-manifest.json`. Keep `<CompleteDocument {...documentProps} />` in `src/report.mdx`. The editorial layer may highlight, compare, sequence, or visualize source material, but it never replaces the formatted complete document or its raw verification view.

Preserve every heading, paragraph, list item, task marker, table cell, code block, link, image reference, and raw URL. Do not move content out of the canonical source to make the editorial layer look cleaner.

## Positive editorial recipe

Compose the page in this order:

1. Write a direct title, contextual eyebrow, one-sentence lede, and honest status.
2. Add a small set of source-grounded highlights that surface the verdict or key decisions.
3. Add comparisons only for explicit before/after or current/proposed deltas.
4. Add a timeline only when the source states an order.
5. Add risks and actions only when the source states them or supports the exact wording.
6. When the source explicitly states a multi-step process, conditional branch, dependency, sequence, or quantitative comparison, add the smallest useful matching diagram or chart. Render every visual spec in `report-data.json` with the corresponding supported component in `report.mdx`.
7. Finish with the complete canonical document and raw verification view.

An editorial sentence may paraphrase cited evidence, but it may not introduce a fact, decision, relationship, number, owner, status, or priority absent from that evidence.

## Source-node lookup

After `npm ci`, run this command from the generated preview directory:

```bash
npx tsx -e 'import { readFileSync } from "node:fs"; import { extractSourceNodes } from "./src/lib/source.ts"; console.log(JSON.stringify(extractSourceNodes(readFileSync("./src/content/source.md", "utf8")), null, 2))'
```

The output lists each canonical node's `id`, `type`, exact `text`, line range, and URLs. Use those values; do not infer node IDs by eye. Supported node types include `heading`, `paragraph`, `listItem`, `tableCell`, `code`, and `link`.

## Exact-span provenance

Every editorial item uses a non-empty `source` array of `SourceRef` objects. Every process node, process edge, and chart point uses one `SourceRef`:

```json
{
  "nodeId": "paragraph:3-3",
  "evidence": "Prepare the launch, then ship 5 sites."
}
```

`nodeId` must exist in the lookup output. `evidence` must be an exact, contiguous substring of that node's text. Use the smallest span that fully supports the derived item.

Chart evidence has a stricter contract: the same exact span must contain the point's label, numeric value, and unit. Do not calculate, aggregate, normalize, or estimate a value. Process evidence must explicitly support each node and edge relationship.

## `report-data.json` shapes

The required `EditorialData` shape is:

```ts
type SourceRef = { nodeId: string; evidence: string }

type EditorialData = {
  title: string
  eyebrow: string
  lede: string
  status: string
  highlights: Array<{
    label: string
    title: string
    body: string
    source: SourceRef[]
  }>
  comparisons: Array<{
    label: string
    before: string
    after: string
    source: SourceRef[]
  }>
  timeline: Array<{
    label: string
    title: string
    body: string
    source: SourceRef[]
  }>
  risks: Array<{
    level: "low" | "medium" | "high"
    title: string
    body: string
    source: SourceRef[]
  }>
  actions: Array<{
    title: string
    body: string
    source: SourceRef[]
  }>
  processes?: ProcessSpec[]
  charts?: ChartSpec[]
}
```

Use empty arrays for inapplicable editorial groups. Optional visuals use these exact shapes:

```ts
type ProcessSpec = {
  id: string
  title: string
  explanation: string
  nodes: Array<{ id: string; label: string; source: SourceRef }>
  edges: Array<{
    from: string
    to: string
    label?: string
    source: SourceRef
  }>
}

type ChartSpec = {
  id: string
  title: string
  explanation: string
  points: Array<{
    label: string
    value: number
    unit: string
    series?: string
    source: SourceRef
  }>
}
```

All `id` values must be SVG-safe: start with a letter or underscore, then use only letters, digits, underscores, or hyphens. Process edge endpoints must name nodes in the same spec.

## `report.mdx` composition

Keep the template's `Report` wrapper, source extraction, editorial validation, and `<CompleteDocument {...documentProps} />`. Import only the supported components needed by the document:

```mdx
import reportData from "./content/report-data.json"
import { CompleteDocument, EditorialLayer } from "./components/editorial"
import { ProcessFlow } from "./components/graphs/processes"
import { BarChart } from "./components/graphs/charts"
import { validateEditorialData } from "./lib/provenance"
import { extractSourceNodes } from "./lib/source"
import "./styles.css"

export const Report = ({ editorialData = reportData, children, ...documentProps }) => {
  const sourceNodes = extractSourceNodes(documentProps.source ?? "")
  const validation = validateEditorialData(editorialData, sourceNodes)
  const safeEditorialData = validation.valid
    ? editorialData
    : { ...editorialData, highlights: [], comparisons: [], timeline: [], risks: [], actions: [] }

  return (
    <div className="preview-shell">
      <EditorialLayer data={safeEditorialData} />
      <ProcessFlow spec={reportData.processes[0]} sourceNodes={sourceNodes} />
      <BarChart spec={reportData.charts[0]} sourceNodes={sourceNodes} />
      {children}
      <CompleteDocument {...documentProps} />
    </div>
  )
}

<Report {...props} />
```

The exported authoring components accept these props:

| Component | Prop shape |
|---|---|
| `EditorialLayer` | `{ data: EditorialData }` |
| `Hero` | `{ title, eyebrow, lede, status }` |
| `HighlightGrid` | `{ items: EditorialData["highlights"] }` |
| `ComparisonGrid` | `{ items: EditorialData["comparisons"] }` |
| `Timeline` | `{ items: EditorialData["timeline"] }` |
| `RiskList` | `{ items: EditorialData["risks"] }` |
| `ActionList` | `{ items: EditorialData["actions"] }` |
| `ProcessFlow`, `BranchFlow`, `SequenceFlow`, `DependencyMap` | `{ spec: ProcessSpec, sourceNodes: SourceNode[] }` |
| `BarChart`, `LineChart`, `StackedBar`, `ComparisonChart` | `{ spec: ChartSpec, sourceNodes: SourceNode[] }` |
| `CompleteDocument` | `{ source: string, manifest: PreviewManifest }` |

`PreviewManifest` contains `slug`, `source_filename`, `source_path`, and `source_sha256`, all strings supplied through `documentProps`. Omit unused imports and elements. Do not hand-build SVG, canvas, graph libraries, custom data transforms, or custom visual components.

## Visual selection

| Source relationship | Component | Use only when |
|---|---|---|
| Linear ordered stages | `ProcessFlow` | The source states each stage and transition |
| Conditional paths | `BranchFlow` | The source states the decision and branches |
| Actor-to-actor messages over time | `SequenceFlow` | The source names participants and message order |
| Prerequisites or dependencies | `DependencyMap` | The source states dependency edges |
| Categorical quantities | `BarChart` | Each category, value, and unit appears together in evidence |
| Values over an ordered axis | `LineChart` | The source states the order and every point |
| Multiple series forming category totals | `StackedBar` | Each segment is independently grounded |
| Side-by-side series or scenarios | `ComparisonChart` | Comparable values and series names are explicit |

Graphs communicate relationships; charts communicate quantities. A source code block that merely resembles a diagram is not permission to recreate it unless its relationships can be cited node by node and edge by edge.

## Sparse documents

Sparse documents should produce sparse previews. A short source may need only the hero and one highlight or action. Keep other arrays empty and omit visuals when the source lacks a grounded structure or quantitative comparison. Visual density must follow information density.

## Fallback

When a claim or visual cannot pass exact provenance validation, remove that derived item. If no derived items are supported, render the hero plus the complete document. Never repair provenance by broadening evidence to an unrelated span, copying a number from another node, or inventing connective text.

## Accessibility

Use the supplied components so diagrams and charts retain SVG titles and descriptions, visible explanations, source links, deterministic patterns, and semantic data tables. Keep labels concise and meaningful. Do not use color as the only distinction or replace the semantic fallback with decorative graphics.

## Print

Keep `src/styles.css`, the supplied page shell, and `EditorialLayer` so the print button and A4 print rules remain active. Check print preview for clipped labels, split cards, horizontal overflow, and orphaned headings.

## Links, images, and raw URLs

The complete document must retain Markdown links and visible raw URLs from the canonical source. Remote images stay inert by design; preserve their alt text and source syntax rather than fetching or embedding them. Do not add remote scripts, fonts, trackers, or assets.
