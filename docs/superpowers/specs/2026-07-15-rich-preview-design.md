# Rich Preview skill design

## Goal

Create an Agent Skills-compatible `rich-preview` skill that turns a completed Markdown plan, investigation summary, decision memo, or similar structured document into a consistent, polished, print-friendly MDX webpage served on localhost without omitting any source content.

## Portability contract

The skill must work in Claude Code, Codex, and other Agent Skills-compatible harnesses that provide filesystem access, a shell, Python 3, Node.js, npm registry access for first install, and retained processes for a local server.

`SKILL.md` uses the portable Agent Skills specification and contains only the required `name` and `description` frontmatter. Product-specific Codex metadata may live in `agents/openai.yaml`; other harnesses can ignore it. The workflow must not depend on MCP tools, browser automation, proprietary site builders, or harness-specific task APIs.

## User experience

The skill triggers when a user requests a rich preview, visual webpage, MDX presentation, print-ready page, or a better way to share a completed plan or summary. Explicit invocation may appear as `/rich-preview` in Claude or `$rich-preview` in Codex.

The agent:

1. Resolves the source from a supplied Markdown/MDX path or the completed plan/summary in conversation.
2. Creates `.rich-preview/<slug>/` by default, with an explicit output override.
3. Initializes a pinned Vite, React, and MDX project from the bundled template.
4. Copies the source byte-for-byte and records its SHA-256 digest.
5. Performs an editorial composition pass that maps source-grounded conclusions, decisions, metrics, risks, dependencies, and actions into `src/report.mdx`, then renders the complete canonical source below it in its original order.
6. Validates structure, placeholder removal, lossless source coverage, links, print rules, tests, and the production build.
7. Starts the local server on an available loopback port and returns the exact URL.

Running the skill again for the same slug updates the report content without silently replacing customized template files. If the output exists and differs from the bundled template, stop and ask before overwriting it.

## Output contract

Every generated preview contains:

- a verdict-led hero with title, context, and status;
- a concise executive summary;
- the source's key findings, decisions, risks, or deliverables;
- comparisons, timelines, metrics, or flow steps only when the source supports them;
- next steps or a verification checklist when present in the source;
- full raw source URLs for cited tickets, pull requests, and references;
- responsive screen styles and A4 print styles;
- a visible Print / save as PDF action.

It also contains a visible **Complete document** section that renders the entire canonical source in its original order. Highlights may duplicate, group, or emphasize source material, but they never replace the complete document.

The page is an editorial brief rather than a generically styled Markdown document. The composition pass selects only source-supported components from a standard vocabulary:

- verdict-led heroes and executive summaries;
- decision, finding, metric, risk, and action cards;
- comparisons and worked examples;
- timelines, milestones, and dependency views;
- process, branch, sequence, and architecture graphs;
- quantitative bar, line, stacked-bar, and comparison charts.

Sparse documents use fewer components instead of visual filler. The composition may improve hierarchy and labels, but it does not add unsupported conclusions, relationships, or values.

## Lossless content contract

The source is canonical. `init_preview.py` copies it byte-for-byte into the preview and writes its SHA-256 digest to the preview manifest. The generated presentation is an additive layer above the complete source, not a rewritten substitute.

Canonical Markdown and MDX are treated as untrusted data. Raw HTML, scripts, and imported MDX components are displayed as inert source or sanitized content and are never executed by the complete-document renderer.

`validate_preview.py` fails unless:

- the preserved source digest still matches the input;
- the webpage includes the complete-document renderer;
- all ordered textual nodes from the source are present in the complete-document output, including headings, paragraphs, list items, table cells, code blocks, and link text;
- every source URL is present unchanged;
- no section is represented only by a generated highlight.

The validator reports source-node totals and rendered-node totals so a reviewer can verify 100% coverage. The page also displays the source filename, digest, and coverage result. Generated highlights are clearly labelled and may paraphrase only when the original material remains available in the complete document.

## Graph and chart contract

Process and architecture visuals use structured `ProcessFlow`, `BranchFlow`, `SequenceFlow`, and `DependencyMap` components. Quantitative visuals use `BarChart`, `LineChart`, `StackedBar`, and comparison-chart components. The bundled components render responsive SVG and CSS with local assets only, so they remain sharp on screen and in print without Chromium, browser automation, or runtime network requests.

Every generated visual includes provenance metadata containing its source node IDs, exact supporting source spans, original labels and values, and transformation type. A visible **Derived from** link takes the reader to the corresponding canonical section. Each node, edge, or data point must carry at least one exact supporting span so provenance can be checked mechanically rather than inferred by the validator.

Graph generation is additive and source-grounded:

- a process node or edge must be supported by referenced source content;
- a chart value, unit, sign, date, and category label must match the source exactly;
- a quantitative chart retains a readable data-table equivalent;
- every graph includes a concise text explanation, and colour is never the only signal;
- the original ASCII diagram, table, or metric remains in the complete-document section;
- ambiguous or invalid transformations fall back to a polished source block instead of a speculative graph.

`validate_preview.py` fails when provenance cannot be resolved, a supporting span is absent from its referenced source node, or visual values differ from their sources. Component tests require non-empty SVG output, accessible titles and descriptions, responsive `viewBox` behavior, readable tabular alternatives, and the required print classes. This provides portable structural verification without depending on a browser installation.

The visual system uses a consistent deep-ink and purple editorial palette, warm neutral surfaces, semantic green/amber/red states, strong typography, monospace evidence, generous spacing, responsive cards, and controlled print page breaks. It uses local system fonts and CSS shapes; it does not fetch runtime imagery or fonts.

## Skill contents

```text
rich-preview/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── init_preview.py
│   ├── validate_preview.py
│   └── serve_preview.py
├── references/
│   └── authoring-contract.md
└── assets/
    └── template/
        ├── package.json
        ├── package-lock.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── index.html
        └── src/
            ├── components/
            │   ├── editorial.tsx
            │   └── graphs/
            │       ├── processes.tsx
            │       └── charts.tsx
            ├── lib/
            │   ├── source.ts
            │   └── provenance.ts
            ├── main.tsx
            ├── mdx.d.ts
            ├── report.mdx
            ├── report.test.ts
            └── styles.css
```

`init_preview.py` performs deterministic template copying, byte-for-byte source preservation, and digest generation. `validate_preview.py` performs portable structural, ordered-node coverage, URL, and content checks before invoking project tests/builds. `serve_preview.py` chooses an available loopback port from an optional preferred value, starts the Vite server, and prints the exact URL without installing browser software.

`references/authoring-contract.md` defines the editorial recipe, graph-selection rules, provenance requirements, and MDX component vocabulary. It remains one level from `SKILL.md` and contains no harness-specific instructions.

## Evaluation strategy

The no-skill baseline demonstrated that agents can build a page but invent framework versions, layout, palette, print rules, port, validation steps, output location, and browser dependencies. The skill must remove those decisions.

Validate first with three fresh synthetic scenarios:

1. A multi-step implementation plan with dependencies and checkpoints.
2. An investigation summary with a verdict, comparison, timeline, evidence links, and risks.
3. A short decision memo with few sections and no natural timeline.

Then validate with an approved private payroll corpus that remains outside this public repository:

1. A short field-change plan proves restraint and compact composition.
2. A medium process plan converts an ASCII data flow into a branching graph.
3. A calculation-heavy plan exercises worked examples, quantitative comparisons, implementation stages, and test coverage.
4. A long multi-system plan exercises navigation, dependencies, timelines, and print pagination.
5. An eleven-thousand-word programme plan is an optional table-of-contents and scalability stress test.

For each scenario, require the expected `.rich-preview/<slug>/` structure, valid MDX, consistent components and visual tokens, a successful test/build, a responsive localhost URL, a matching source digest, 100% ordered-node and URL coverage, resolvable graph provenance, exact quantitative values and units, no invented factual claims, and no browser installation.

## Demo index

After the skill and component system are implemented, generate a local demo index that links to individually addressable previews for:

- the revised Rich Preview design specification;
- the private investigation that inspired the visual style;
- the short private plan;
- the medium private process plan;
- the calculation-heavy private plan;
- the long private multi-system plan.

The revised design specification must itself be generated with the completed skill, not maintained as a hand-authored exception. Each demo displays editorial highlights, any source-supported process or quantitative graphs, the complete canonical document, raw verification, source digest, and coverage result.

## Repository changes

Add the skill and update the root README to use the renamed repository `https://github.com/bshakr/agent-skills`, list `rich-preview`, and document symlink installation for both Claude and Codex. Leave existing skill internals unchanged so the pull request stays focused.

## Non-goals

- Publishing or deploying previews.
- Replacing the source plan or summary.
- Adding browser automation, screenshot generation, or Chromium installation.
- Integrating into an existing application frontend.
- Generating arbitrary dashboards or interactive applications.
