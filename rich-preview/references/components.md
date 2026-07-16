# Components

Import in `src/report.mdx`:

```mdx
import { Hero, HighlightGrid, ComparisonGrid, Timeline, RiskList, ActionList, CompleteDocument } from "./components/editorial"
import { Mermaid } from "./components/mermaid"
```

Every component takes plain strings and arrays. Use only facts the source states; omit any component you have no material for.

## Hero

Top of the page. `status` is optional (a short badge like "Shipped" or "Draft").

```mdx
<Hero
  eyebrow="Investigation"
  title="Linked shift types double-count overtime"
  lede="Overtime hours are attributed to both shift types, inflating the payroll export."
  status="Root cause found"
/>
```

## HighlightGrid

Cards for the key findings or decisions. `kicker` and `title` are optional overrides.

```mdx
<HighlightGrid items={[
  { label: "Cause", title: "Shared FK", body: "Both types resolve to one pay element." },
  { label: "Impact", title: "3 brands", body: "Only brands using linked types are affected." },
]} />
```

## ComparisonGrid

Before/after pairs. `before`/`after` are one-line summaries. Optional
`beforeDetail`/`afterDetail` render as monospace panels beneath the summary — use
them to carry a wireframe, exact UI copy, or a config diff verbatim from the source
instead of paraphrasing it away. Include a detail only for the side the source
actually shows one for.

```mdx
<ComparisonGrid items={[
  { label: "Approve button", before: "[Approve]", after: "[Approve & submit to HMRC]" },
  {
    label: "Pay run detail page",
    before: "Plain approve button, no submission context.",
    after: "Info banner spells out that approving submits RTI and generates BACS.",
    beforeDetail: `┌─ Pay run detail ─────────────┐
│ ← All pay runs      [Approve] │
└──────────────────────────────┘`,
    afterDetail: `┌─ Pay run detail ─────────────────────────┐
│ ← All pay runs  [Approve & submit to HMRC] │
│ ℹ Approving submits RTI and generates BACS │
└────────────────────────────────────────────┘`,
  },
]} />
```

## Timeline

Ordered steps or a sequence of events.

```mdx
<Timeline items={[
  { label: "Step 1", title: "Ingest shifts", body: "Middleware pulls the roster." },
  { label: "Step 2", title: "Map pay elements", body: "Each shift type resolves its element." },
]} />
```

## RiskList

`level` is `"low" | "medium" | "high"` and colors the card.

```mdx
<RiskList items={[
  { level: "high", title: "Silent overpayment", body: "No validation catches the double count." },
  { level: "low", title: "Reporting only", body: "The underlying hours are correct." },
]} />
```

## ActionList

Numbered next actions.

```mdx
<ActionList items={[
  { title: "Add a uniqueness guard", body: "Reject two shift types sharing one element." },
]} />
```

## CompleteDocument

Renders the full source (collapsible) plus the raw text. Always include it last:

```mdx
<CompleteDocument source={source} />
```

## Mermaid

Client-rendered diagrams — only diagram structure the source actually states. `title`
is optional. Use `flowchart` for processes/branches/dependencies, `sequenceDiagram`
for message exchanges, `xychart-beta` for quantitative comparisons:

```mdx
<Mermaid title="Ingestion flow" chart={`
flowchart LR
  Roster --> Map[Map pay elements] --> Export
`} />
```

The `chart` string is standard mermaid: swap the header for `sequenceDiagram`
(message exchanges) or `xychart-beta` (bar/line charts).
