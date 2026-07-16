# Components

This vocabulary is a public API: reports accumulate in the hub and every past report
keeps importing it. Changes must be additive — new components or new optional props
only. Never rename, remove, or change the meaning of an existing prop.

Import at the top of a report's `report.mdx` (the `@components` / `@styles` aliases
resolve into the hub app, so reports never need `../../../src` paths):

```mdx
import { Hero, HighlightGrid, FindingRows, StatGrid, Callout, ComparisonGrid, Timeline, RiskList, ActionList, Checklist, Terminal, PullQuote, CompleteDocument } from "@components/editorial"
import { Mermaid } from "@components/mermaid"
import "@styles"
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

Cards for the key findings or decisions. `kicker`/`title` are optional overrides.
`variant="tinted"` swaps to borderless soft-tinted panels with a filled chip label.

Use when: 2–3 punchy takeaways. For 4+ findings or text-heavy bodies, use FindingRows.

```mdx
<HighlightGrid variant="tinted" items={[
  { label: "Cause", title: "Shared FK", body: "Both types resolve to one pay element." },
  { label: "Impact", title: "3 brands", body: "Only brands using linked types are affected." },
]} />
```

## FindingRows

Hairline-separated rows in one container — a numeral + label column beside a title and
body. Same item shape as HighlightGrid; reads like a document rather than a card wall.

Use when: 4+ findings, or bodies long enough that cards would look ragged.

```mdx
<FindingRows kicker="Findings" title="What the probe confirmed" items={[
  { label: "Finding 1", title: "Leave creation is pay-run-independent", body: "POST leave returns 201 with no covering run." },
  { label: "Finding 2", title: "SSP lives in totals.ssp", body: "Observed totals.ssp 123.25 for a 5-day leave; payLines stays empty." },
]} />
```

## StatGrid

Big-number tiles. `detail` is an optional muted line under the label.

Use when: the report has quantitative punchlines — a latency win, a row count, a ratio.

```mdx
<StatGrid items={[
  { value: "158s → 0.25s", label: "Summary latency", detail: "Serial fan-out vs one list call." },
  { value: "134", label: "Zombie rows", detail: "Soft-deleted but still joined." },
]} />
```

## Callout

One emphasized block. `tone` is `"info" | "success" | "warning" | "insight"` (insight is
purple); `title` is optional.

Use when: a single takeaway the report hinges on. One per section at most.

```mdx
<Callout tone="insight" title="The insight" body="The 504 is the front ALB idle timeout — nothing upstream bails." />
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

## Checklist

Status snapshot. `state` is `"done" | "pending" | "blocked"`, rendered as a
check/dash/cross marker in the state color.

Use when: reporting plan or task status — what's shipped, in flight, or blocked.

```mdx
<Checklist items={[
  { state: "done", title: "Migration applied", body: "Additive column shipped." },
  { state: "blocked", title: "Enable flag", body: "Waiting on ops sign-off." },
]} />
```

## Terminal

Standalone monospace evidence panel. `children` is the raw text; `title` optional.

Use when: showing a log, API response, SQL output, or an ASCII wireframe outside a
ComparisonGrid. (Inside a comparison, use `beforeDetail`/`afterDetail` instead.)

```mdx
<Terminal title="Response">{`GET /payrun?pageSize=20  200  0.245s
{"employeeCount": 567, "totals": {"gross": 49125.41}}`}</Terminal>
```

## PullQuote

Large hanging-quote treatment. `source` is an optional attribution line.

Use when: exact wording matters — regulatory copy, an error message, a user quote.

```mdx
<PullQuote quote="This cannot be undone from Nory." source="Confirmation modal copy" />
```

## Tables

Plain Markdown tables (GFM pipe syntax) inside a report get the system treatment —
small-caps header, hairline rows — automatically. Use them for small, tabular facts.

```mdx
| Metric | Before | After |
| --- | --- | --- |
| Latency | 158s | 0.25s |
| Provider calls | 569 | 1 |
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
