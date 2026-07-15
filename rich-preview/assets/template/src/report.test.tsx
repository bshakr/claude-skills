import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompleteDocument } from "./components/editorial";
import {
  BranchFlow,
  DependencyMap,
  ProcessFlow,
  SequenceFlow,
} from "./components/graphs/processes";
import {
  type ProcessSpec,
  validateEditorialData,
  validateProcessSpec,
  validateSourceRef,
} from "./lib/provenance";
import { extractSourceNodes, sourceCoverage } from "./lib/source";
import reportData from "./content/report-data.json";
import Report from "./report.mdx";

const reportManifest = {
  slug: "plan",
  source_filename: "plan.md",
  source_path: "/tmp/plan.md",
  source_sha256:
    "eee82b2be304875b7f6ea3f8c9cc3c8d3a2cfcad892b549b936f8fcd5709de7c",
};

const emptyEditorialData = {
  title: "A complete, decision-ready preview",
  eyebrow: "Editorial brief",
  lede: "The source remains available in full after this overview.",
  status: "Ready for review",
  highlights: [],
  comparisons: [],
  timeline: [],
  risks: [],
  actions: [],
};

const processSource = [
  "# Release workflow",
  "",
  "Draft the proposal, review it, and publish the approved change.",
  "",
  "Approval sends accepted changes to release and rejected changes back to drafting.",
  "",
  "The client calls the API before the API stores the record.",
  "",
  "The dashboard depends on the API, and the API depends on the datastore.",
  "",
].join("\n");
const processSourceNodes = extractSourceNodes(processSource);
const processSpec: ProcessSpec = {
  id: "release-workflow",
  title: "Release workflow",
  explanation: "A proposal moves from drafting through review to publication.",
  nodes: [
    {
      id: "draft",
      label: "Draft proposal",
      source: {
        nodeId: "paragraph:3-3",
        evidence: "Draft the proposal",
      },
    },
    {
      id: "review",
      label: "Review",
      source: {
        nodeId: "paragraph:3-3",
        evidence: "review it",
      },
    },
    {
      id: "publish",
      label: "Publish",
      source: {
        nodeId: "paragraph:3-3",
        evidence: "publish the approved change",
      },
    },
  ],
  edges: [
    {
      from: "draft",
      to: "review",
      label: "submit",
      source: {
        nodeId: "paragraph:3-3",
        evidence: "Draft the proposal, review it",
      },
    },
    {
      from: "review",
      to: "publish",
      label: "approve",
      source: {
        nodeId: "paragraph:3-3",
        evidence: "review it, and publish the approved change",
      },
    },
  ],
};

describe("extractSourceNodes", () => {
  it("extracts supported source nodes in source order", () => {
    const source = [
      "# Release plan",
      "",
      "Read the [runbook](https://example.com/runbook) before visiting https://status.example.com.",
      "",
      "- Keep this item",
      "",
      "| Owner | State |",
      "| --- | --- |",
      "| Alex | Ready |",
      "",
      "```ts",
      "const ready = true;",
      "```",
      "",
    ].join("\n");

    const nodes = extractSourceNodes(source);

    expect(nodes.map(({ type, text }) => ({ type, text }))).toEqual([
      { type: "heading", text: "Release plan" },
      {
        type: "paragraph",
        text: "Read the runbook before visiting https://status.example.com.",
      },
      { type: "link", text: "runbook" },
      { type: "link", text: "https://status.example.com" },
      { type: "listItem", text: "Keep this item" },
      { type: "paragraph", text: "Keep this item" },
      { type: "tableCell", text: "Owner" },
      { type: "tableCell", text: "State" },
      { type: "tableCell", text: "Alex" },
      { type: "tableCell", text: "Ready" },
      { type: "code", text: "const ready = true;" },
    ]);
    expect(nodes.map((node) => node.startLine)).toEqual([
      1, 3, 3, 3, 5, 5, 7, 7, 9, 9, 11,
    ]);
    expect(nodes[0]).toMatchObject({
      id: "heading:1-1",
      endLine: 1,
      urls: [],
    });
    expect(nodes[1].urls).toEqual([
      "https://example.com/runbook",
      "https://status.example.com",
    ]);
    expect(nodes[2].urls).toEqual(["https://example.com/runbook"]);
    expect(nodes[3].urls).toEqual(["https://status.example.com"]);
  });

  it("reports every extracted node as covered", () => {
    const coverage = sourceCoverage("## Notes\n\nKeep every line.\n");

    expect(coverage.coveredNodes).toBe(coverage.totalNodes);
    expect(coverage.percentage).toBe(100);
  });

  it("assigns unique deterministic IDs to same-line links", () => {
    const source =
      "[First](https://example.com/first) and [Second](https://example.com/second)\n";

    const firstPass = extractSourceNodes(source).filter(
      (node) => node.type === "link",
    );
    const secondPass = extractSourceNodes(source).filter(
      (node) => node.type === "link",
    );

    expect(new Set(firstPass.map((node) => node.id))).toHaveLength(
      firstPass.length,
    );
    expect(secondPass.map((node) => node.id)).toEqual(
      firstPass.map((node) => node.id),
    );
  });

  it("assigns unique deterministic IDs to same-row table cells", () => {
    const source = [
      "| First | Second | Third |",
      "| --- | --- | --- |",
      "| One | Two | Three |",
      "",
    ].join("\n");

    const firstPass = extractSourceNodes(source).filter(
      (node) => node.type === "tableCell",
    );
    const secondPass = extractSourceNodes(source).filter(
      (node) => node.type === "tableCell",
    );

    expect(new Set(firstPass.map((node) => node.id))).toHaveLength(
      firstPass.length,
    );
    expect(secondPass.map((node) => node.id)).toEqual(
      firstPass.map((node) => node.id),
    );
  });
});

describe("provenance validation", () => {
  it("rejects evidence that is absent from an existing source node", () => {
    const result = validateSourceRef(
      {
        nodeId: "paragraph:3-3",
        evidence: "invented relationship",
      },
      processSourceNodes,
    );

    expect(result).toEqual({
      valid: false,
      error: "Evidence not found in paragraph:3-3",
    });
  });

  it("rejects process edges whose endpoints are not declared", () => {
    const result = validateProcessSpec(
      {
        ...processSpec,
        edges: [
          {
            ...processSpec.edges[0],
            to: "missing-step",
          },
        ],
      },
      processSourceNodes,
    );

    expect(result).toEqual({
      valid: false,
      error: "Unknown process edge endpoint: draft -> missing-step",
    });
  });

  it("validates every editorial item's exact source span", () => {
    const source = [
      { nodeId: "paragraph:3-3", evidence: "Draft the proposal" },
    ];
    const editorialData = {
      ...emptyEditorialData,
      highlights: [
        { label: "Decision", title: "Draft", body: "Start here.", source },
      ],
      comparisons: [
        { label: "State", before: "Idea", after: "Draft", source },
      ],
      timeline: [
        { label: "First", title: "Draft", body: "Write it.", source },
      ],
      risks: [
        {
          level: "low" as const,
          title: "Delay",
          body: "Start promptly.",
          source,
        },
      ],
      actions: [{ title: "Draft", body: "Write the proposal.", source }],
    };

    expect(validateEditorialData(editorialData, processSourceNodes)).toEqual({
      valid: true,
    });
    expect(
      validateEditorialData(
        {
          ...editorialData,
          actions: [
            {
              ...editorialData.actions[0],
              source: [
                {
                  nodeId: "paragraph:3-3",
                  evidence: "invented action",
                },
              ],
            },
          ],
        },
        processSourceNodes,
      ),
    ).toEqual({
      valid: false,
      error: "actions[0]: Evidence not found in paragraph:3-3",
    });
  });

  it("keeps every starter process grounded in the canonical source", () => {
    const nodes = extractSourceNodes(
      "# Preview\n\nAdd canonical source with init_preview.py.\n",
    );

    for (const spec of Object.values(reportData.processes)) {
      expect(validateProcessSpec(spec, nodes)).toEqual({ valid: true });
    }
  });
});

describe("process graph vocabulary", () => {
  const graphCases = [
    ["process-flow", ProcessFlow],
    ["branch-flow", BranchFlow],
    ["sequence-flow", SequenceFlow],
    ["dependency-map", DependencyMap],
  ] as const;

  it.each(graphCases)(
    "renders an accessible, source-linked %s",
    (visualType, Graph) => {
      const markup = renderToStaticMarkup(
        <Graph spec={processSpec} sourceNodes={processSourceNodes} />,
      );

      expect(markup).toContain("<svg");
      expect(markup).toMatch(/<svg[^>]+viewBox="[^"]+"/);
      expect(markup).toContain("<title ");
      expect(markup).toContain("<desc ");
      expect(markup).toContain(processSpec.explanation);
      expect(markup).toContain(
        `data-visual-id="${visualType}-${processSpec.id}"`,
      );
      expect(markup).toContain("Derived from");
      expect(markup).toContain('href="#source-paragraph:3-3"');
      expect(markup).toContain('data-node-shape="');
      expect(markup).toContain("Draft proposal");
    },
  );
});

describe("CompleteDocument", () => {
  it("renders the complete canonical source and raw verification", () => {
    const source = "# Plan\n\nFirst paragraph.\n\n- Keep this item\n";
    const manifest = {
      slug: "plan",
      source_filename: "plan.md",
      source_path: "/tmp/plan.md",
      source_sha256:
        "eee82b2be304875b7f6ea3f8c9cc3c8d3a2cfcad892b549b936f8fcd5709de7c",
    };
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const markup = renderToStaticMarkup(
      <CompleteDocument source={source} manifest={manifest} />,
    );

    expect(markup).toContain('data-complete-document="true"');
    expect(markup).toContain("First paragraph.");
    expect(markup).toContain("Keep this item");
    expect(markup).toContain(escapeHtml(source));
    expect(markup).toContain(manifest.source_sha256);
    expect(markup).toContain("100% coverage");
  });

  it("keeps untrusted HTML and MDX inert", () => {
    const source = [
      '<script>globalThis.__previewExecuted = true</script>',
      '<img src="x" onerror="globalThis.__previewExecuted = true">',
      "{globalThis.__previewExecuted = true}",
    ].join("\n");
    const manifest = {
      slug: "unsafe",
      source_filename: "unsafe.md",
      source_path: "/tmp/unsafe.md",
      source_sha256: "unsafe-source-hash",
    };

    const markup = renderToStaticMarkup(
      <CompleteDocument source={source} manifest={manifest} />,
    );
    const formattedMarkup = markup.slice(
      markup.indexOf("<article"),
      markup.indexOf("</article>"),
    );

    expect(formattedMarkup).not.toContain("<script>");
    expect(formattedMarkup).not.toContain("onerror=");
    expect(formattedMarkup).not.toContain("dangerouslySetInnerHTML");
    expect(markup).toContain("globalThis.__previewExecuted = true");
  });

  it("renders Markdown images without a live source", () => {
    const source =
      "![Remote chart](https://assets.example.invalid/chart.png)\n";
    const manifest = {
      slug: "markdown-image",
      source_filename: "markdown-image.md",
      source_path: "/tmp/markdown-image.md",
      source_sha256: "markdown-image-source-hash",
    };

    const markup = renderToStaticMarkup(
      <CompleteDocument source={source} manifest={manifest} />,
    );
    const formattedMarkup = markup.slice(
      markup.indexOf("<article"),
      markup.indexOf("</article>"),
    );

    expect(formattedMarkup).not.toContain("<img");
    expect(formattedMarkup).not.toContain(
      "https://assets.example.invalid/chart.png",
    );
    expect(markup).not.toContain('rel="preload" as="image"');
    expect(formattedMarkup).toContain("Remote chart");
    expect(markup).toContain(source.trim());
  });

  it("renders raw HTML images without a live source", () => {
    const source =
      '<img src="https://assets.example.invalid/badge.png" alt="Remote badge">\n';
    const manifest = {
      slug: "html-image",
      source_filename: "html-image.md",
      source_path: "/tmp/html-image.md",
      source_sha256: "html-image-source-hash",
    };

    const markup = renderToStaticMarkup(
      <CompleteDocument source={source} manifest={manifest} />,
    );
    const formattedMarkup = markup.slice(
      markup.indexOf("<article"),
      markup.indexOf("</article>"),
    );

    expect(formattedMarkup).not.toContain("<img");
    expect(formattedMarkup).not.toContain(
      "https://assets.example.invalid/badge.png",
    );
    expect(markup).not.toContain('rel="preload" as="image"');
    expect(formattedMarkup).toContain("Remote badge");
    expect(markup).toContain(
      "&lt;img src=&quot;https://assets.example.invalid/badge.png&quot; alt=&quot;Remote badge&quot;&gt;",
    );
  });
});

describe("Report", () => {
  it("renders a verdict-led editorial layer before the canonical document", () => {
    const markup = renderToStaticMarkup(
      <Report source="# Plan\n\nKeep the complete source.\n" manifest={reportManifest} />,
    );

    expect(markup.indexOf('data-editorial-layer="true"')).toBeLessThan(
      markup.indexOf('data-complete-document="true"'),
    );
    expect(markup).toContain("Key decisions");
    expect(markup).toContain("Next actions");
  });

  it("suppresses empty editorial sections instead of rendering filler", () => {
    const markup = renderToStaticMarkup(
      <Report
        source="# Plan\n"
        manifest={reportManifest}
        editorialData={emptyEditorialData}
      />,
    );

    expect(markup).toContain('data-editorial-layer="true"');
    expect(markup).toContain(emptyEditorialData.title);
    expect(markup).not.toContain("Key decisions");
    expect(markup).not.toContain("What changes");
    expect(markup).not.toContain("Timeline");
    expect(markup).not.toContain("Risks to watch");
    expect(markup).not.toContain("Next actions");
  });

  it("attaches source node IDs to every editorial item", () => {
    const source = [
      { nodeId: "heading:1-1", evidence: "Plan" },
      { nodeId: "paragraph:3-3", evidence: "Decision evidence" },
    ];
    const editorialData = {
      ...emptyEditorialData,
      highlights: [
        { label: "Decision", title: "Proceed", body: "Approved.", source },
      ],
      comparisons: [
        { label: "Flow", before: "Manual", after: "Guided", source },
      ],
      timeline: [
        { label: "Now", title: "Review", body: "Read the plan.", source },
      ],
      risks: [
        {
          level: "medium",
          title: "Adoption",
          body: "Confirm the owner.",
          source,
        },
      ],
      actions: [{ title: "Confirm", body: "Name the owner.", source }],
    };

    const markup = renderToStaticMarkup(
      <Report
        source="# Plan\n"
        manifest={reportManifest}
        editorialData={editorialData}
      />,
    );

    expect(
      markup.match(
        /data-source-node-ids="heading:1-1 paragraph:3-3"/g,
      ),
    ).toHaveLength(5);
  });
});
