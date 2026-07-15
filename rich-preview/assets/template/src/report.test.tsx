import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompleteDocument } from "./components/editorial";
import {
  BarChart,
  ComparisonChart,
  LineChart,
  StackedBar,
} from "./components/graphs/charts";
import {
  BranchFlow,
  DependencyMap,
  ProcessFlow,
  SequenceFlow,
} from "./components/graphs/processes";
import {
  type ChartPoint,
  type ChartSpec,
  type ProcessSpec,
  validateChartPoint,
  validateChartSpec,
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

const quantitativeEvidence = [
  "A very long standard plan label Current 12%",
  "A very long standard plan label Target 18%",
  "Premium plan Current -4%",
  "Premium plan Target -2%",
  "Zero plan Current 0%",
  "Zero plan Target 0%",
].join("; ");
const quantitativeSourceNodes = [
  {
    id: "paragraph:20-20",
    type: "paragraph",
    text: quantitativeEvidence,
    startLine: 20,
    endLine: 20,
    urls: [],
  },
];
const quantitativeSpec: ChartSpec = {
  id: "plan-performance",
  title: "Plan performance",
  explanation: "Current and target performance by plan.",
  points: [
    ["A very long standard plan label", 12, "Current"],
    ["A very long standard plan label", 18, "Target"],
    ["Premium plan", -4, "Current"],
    ["Premium plan", -2, "Target"],
    ["Zero plan", 0, "Current"],
    ["Zero plan", 0, "Target"],
  ].map(([label, value, series]) => ({
    label: String(label),
    value: Number(value),
    unit: "%",
    series: String(series),
    source: {
      nodeId: "paragraph:20-20",
      evidence: `${String(label)} ${String(series)} ${String(value)}%`,
    },
  })),
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
  it("rejects a chart value not present in its exact source span", () => {
    const sourceNodes = [
      {
        id: "tableCell:4-4",
        type: "tableCell",
        text: "Premium | 20%",
        startLine: 4,
        endLine: 4,
        urls: [],
      },
    ];
    const result = validateChartPoint(
      {
        label: "Premium",
        value: 120,
        unit: "%",
        source: {
          nodeId: "tableCell:4-4",
          evidence: "Premium | 20%",
        },
      },
      sourceNodes,
    );

    expect(result.valid).toBe(false);
  });

  it("rejects a chart value embedded inside a different numeric literal", () => {
    const evidence = "Premium | 120%";
    const sourceNodes = [
      {
        id: "tableCell:5-5",
        type: "tableCell",
        text: evidence,
        startLine: 5,
        endLine: 5,
        urls: [],
      },
    ];

    expect(
      validateChartPoint(
        {
          label: "Premium",
          value: 20,
          unit: "%",
          source: { nodeId: "tableCell:5-5", evidence },
        },
        sourceNodes,
      ).valid,
    ).toBe(false);
  });

  it.each([
    ["comma grouping", 1, "Metric 1,200%"],
    ["underscore grouping", 1, "Metric 1_200%"],
    ["apostrophe grouping", 1, "Metric 1'200%"],
    ["curly-apostrophe grouping", 1, "Metric 1’200%"],
    ["decimal prefix", 1, "Metric 1.25%"],
    ["decimal suffix", 25, "Metric 1.25%"],
    ["explicit positive sign", 1, "Metric +1%"],
    ["different negative sign", 1, "Metric -1%"],
    ["lost negative-zero sign", -0, "Metric 0%"],
    ["invented negative-zero sign", 0, "Metric -0%"],
  ])("rejects a numeric fragment from %s", (_case, value, evidence) => {
    const sourceNodes = [
      {
        id: "tableCell:6-6",
        type: "tableCell",
        text: evidence,
        startLine: 6,
        endLine: 6,
        urls: [],
      },
    ];

    expect(
      validateChartPoint(
        {
          label: "Metric",
          value,
          unit: "%",
          source: { nodeId: "tableCell:6-6", evidence },
        },
        sourceNodes,
      ).valid,
    ).toBe(false);
  });

  it("preserves a literal negative zero", () => {
    const evidence = "Metric -0%";
    const sourceNodes = [
      {
        id: "tableCell:7-7",
        type: "tableCell",
        text: evidence,
        startLine: 7,
        endLine: 7,
        urls: [],
      },
    ];

    expect(
      validateChartPoint(
        {
          label: "Metric",
          value: -0,
          unit: "%",
          source: { nodeId: "tableCell:7-7", evidence },
        },
        sourceNodes,
      ),
    ).toEqual({ valid: true });
  });

  it("normalizes only whitespace when validating a chart point", () => {
    const evidence = "Net \n revenue | -12.5 $";
    const sourceNodes = [
      {
        id: "tableCell:8-9",
        type: "tableCell",
        text: evidence,
        startLine: 8,
        endLine: 9,
        urls: [],
      },
    ];
    const point: ChartPoint = {
      label: "Net revenue",
      value: -12.5,
      unit: "$",
      source: { nodeId: "tableCell:8-9", evidence },
    };

    expect(validateChartPoint(point, sourceNodes)).toEqual({ valid: true });
  });

  it.each([
    ["sign", { label: "Net", value: -12, unit: "$" }, "Net | 12 $"],
    ["currency", { label: "Net", value: 12, unit: "$" }, "Net | 12 USD"],
    ["percentage", { label: "Rate", value: 12, unit: "%" }, "Rate | 12 percent"],
    [
      "date",
      { label: "2026-07-15", value: 12, unit: "%" },
      "15 July 2026 | 12%",
    ],
  ])("does not normalize a chart point's %s", (_case, point, evidence) => {
    const sourceNodes = [
      {
        id: "tableCell:12-12",
        type: "tableCell",
        text: evidence,
        startLine: 12,
        endLine: 12,
        urls: [],
      },
    ];

    expect(
      validateChartPoint(
        {
          ...point,
          source: { nodeId: "tableCell:12-12", evidence },
        },
        sourceNodes,
      ).valid,
    ).toBe(false);
  });

  it("rejects an empty chart spec", () => {
    expect(
      validateChartSpec(
        {
          id: "empty-chart",
          title: "Empty chart",
          explanation: "There are no values to plot.",
          points: [],
        },
        [],
      ),
    ).toEqual({
      valid: false,
      error: "Chart spec must include at least one point",
    });
  });

  const chartSourceNodes = [
    {
      id: "paragraph:16-16",
      type: "paragraph",
      text: "Standard 12%; Premium -4%",
      startLine: 16,
      endLine: 16,
      urls: [],
    },
  ];
  const chartSpec: ChartSpec = {
    id: "plan-mix",
    title: "Plan mix",
    explanation: "Premium trails the standard plan.",
    points: [
      {
        label: "Standard",
        value: 12,
        unit: "%",
        series: "Current",
        source: {
          nodeId: "paragraph:16-16",
          evidence: "Standard 12%",
        },
      },
      {
        label: "Premium",
        value: -4,
        unit: "%",
        series: "Current",
        source: {
          nodeId: "paragraph:16-16",
          evidence: "Premium -4%",
        },
      },
    ],
  };

  const invalidChartCases: Array<[string, ChartSpec, string]> = [
    ["blank chart IDs", { ...chartSpec, id: " " }, "Chart ID is required"],
    [
      "collision-prone chart IDs",
      { ...chartSpec, id: "plan mix" },
      "Chart ID must be SVG-safe",
    ],
    [
      "blank chart titles",
      { ...chartSpec, title: "\t" },
      "Chart title is required",
    ],
    [
      "blank chart explanations",
      { ...chartSpec, explanation: "\n" },
      "Chart explanation is required",
    ],
    [
      "blank point labels",
      {
        ...chartSpec,
        points: [{ ...chartSpec.points[0], label: " " }],
      },
      "points[0]: Chart point label is required",
    ],
    [
      "non-finite point values",
      {
        ...chartSpec,
        points: [{ ...chartSpec.points[0], value: Number.NaN }],
      },
      "points[0]: Chart point value must be finite",
    ],
    [
      "blank point units",
      {
        ...chartSpec,
        points: [{ ...chartSpec.points[0], unit: "\t" }],
      },
      "points[0]: Chart point unit is required",
    ],
    [
      "blank series names",
      {
        ...chartSpec,
        points: [{ ...chartSpec.points[0], series: " " }],
      },
      "points[0]: Chart point series cannot be blank",
    ],
  ];

  it.each(invalidChartCases)("rejects %s", (_case, spec, error) => {
    expect(validateChartSpec(spec, chartSourceNodes)).toEqual({
      valid: false,
      error,
    });
  });

  it("validates every chart point's exact source span", () => {
    expect(validateChartSpec(chartSpec, chartSourceNodes)).toEqual({
      valid: true,
    });
    expect(
      validateChartSpec(
        {
          ...chartSpec,
          points: [
            chartSpec.points[0],
            { ...chartSpec.points[1], value: -40 },
          ],
        },
        chartSourceNodes,
      ),
    ).toEqual({
      valid: false,
      error: "points[1]: Chart point is not present in paragraph:16-16",
    });
  });

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

  it("rejects whitespace-only evidence", () => {
    expect(
      validateSourceRef(
        {
          nodeId: "paragraph:3-3",
          evidence: " ",
        },
        processSourceNodes,
      ),
    ).toEqual({
      valid: false,
      error: "Evidence is required for paragraph:3-3",
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

  const invalidProcessCases: Array<[string, ProcessSpec, string]> = [
    [
      "blank process IDs",
      { ...processSpec, id: " " },
      "Process ID is required",
    ],
    [
      "collision-prone process IDs",
      { ...processSpec, id: "release workflow" },
      "Process ID must be SVG-safe",
    ],
    [
      "blank process titles",
      { ...processSpec, title: "\t" },
      "Process title is required",
    ],
    [
      "blank process explanations",
      { ...processSpec, explanation: "\n" },
      "Process explanation is required",
    ],
    [
      "blank node IDs",
      {
        ...processSpec,
        nodes: [
          { ...processSpec.nodes[0], id: " " },
          ...processSpec.nodes.slice(1),
        ],
      },
      "nodes[0]: Process node ID is required",
    ],
    [
      "collision-prone node IDs",
      {
        ...processSpec,
        nodes: [
          { ...processSpec.nodes[0], id: "draft step" },
          ...processSpec.nodes.slice(1),
        ],
      },
      "nodes[0]: Process node ID must be SVG-safe",
    ],
    [
      "blank node labels",
      {
        ...processSpec,
        nodes: [
          { ...processSpec.nodes[0], label: "\t" },
          ...processSpec.nodes.slice(1),
        ],
      },
      "nodes[0]: Process node label is required",
    ],
  ];

  it.each(invalidProcessCases)("rejects %s", (_case, spec, error) => {
    expect(validateProcessSpec(spec, processSourceNodes)).toEqual({
      valid: false,
      error,
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

  it("keeps starter data graph-free when the source states no relationship", () => {
    expect(reportData).not.toHaveProperty("processes");
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

  it("uses unique SVG IDs when the same graph spec is rendered twice", () => {
    const markup = renderToStaticMarkup(
      <>
        <ProcessFlow spec={processSpec} sourceNodes={processSourceNodes} />
        <ProcessFlow spec={processSpec} sourceNodes={processSourceNodes} />
      </>,
    );
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(
      ([, id]) => id,
    );

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps dependency arrows directed across adjacent layout rows", () => {
    const nodes = ["source", "peer-a", "peer-b", "target"].map(
      (id, index) => ({
        ...processSpec.nodes[0],
        id,
        label: `Dependency ${index + 1}`,
      }),
    );
    const spec = {
      ...processSpec,
      id: "multi-row-dependencies",
      nodes,
      edges: [
        {
          ...processSpec.edges[0],
          from: "source",
          to: "target",
        },
      ],
    };
    const markup = renderToStaticMarkup(
      <DependencyMap spec={spec} sourceNodes={processSourceNodes} />,
    );
    const edge = markup.match(
      /<line class="process-graph__edge" data-edge-shape="arrow"[^>]* y1="([^"]+)" y2="([^"]+)"/,
    );

    expect(edge).not.toBeNull();
    expect(Number(edge?.[1])).toBeLessThan(Number(edge?.[2]));
  });
});

describe("quantitative chart vocabulary", () => {
  const chartCases = [
    ["bar-chart", BarChart],
    ["line-chart", LineChart],
    ["stacked-bar", StackedBar],
    ["comparison-chart", ComparisonChart],
  ] as const;
  const manySeriesEvidence = Array.from(
    { length: 6 },
    (_, index) => `Shared plan Series ${index + 1}; value ${index + 1}%`,
  ).join("; ");
  const manySeriesSourceNodes = [
    {
      id: "paragraph:24-24",
      type: "paragraph",
      text: manySeriesEvidence,
      startLine: 24,
      endLine: 24,
      urls: [],
    },
  ];
  const manySeriesSpec: ChartSpec = {
    id: "many-series",
    title: "Many series",
    explanation: "Every series remains visibly distinguishable.",
    points: Array.from({ length: 6 }, (_, index) => ({
      label: "Shared plan",
      value: index + 1,
      unit: "%",
      series: `Series ${index + 1}`,
      source: {
        nodeId: "paragraph:24-24",
        evidence: `Shared plan Series ${index + 1}; value ${index + 1}%`,
      },
    })),
  };
  const longTokenLabel =
    "ExtremelyLongUnbrokenCategoryIdentifierWithoutAnyWhitespaceAtAll";
  const manyWordLabel =
    "This category label contains enough separate words to exceed " +
    "the safe SVG line limit without colliding";
  const longLabelEvidence = `${longTokenLabel} 8%; ${manyWordLabel} 9%`;
  const longLabelSourceNodes = [
    {
      id: "paragraph:26-26",
      type: "paragraph",
      text: longLabelEvidence,
      startLine: 26,
      endLine: 26,
      urls: [],
    },
  ];
  const longLabelSpec: ChartSpec = {
    id: "long-labels",
    title: "Long labels",
    explanation: "Labels remain readable without clipping.",
    points: [
      {
        label: longTokenLabel,
        value: 8,
        unit: "%",
        series: "Current",
        source: {
          nodeId: "paragraph:26-26",
          evidence: `${longTokenLabel} 8%`,
        },
      },
      {
        label: manyWordLabel,
        value: 9,
        unit: "%",
        series: "Current",
        source: {
          nodeId: "paragraph:26-26",
          evidence: `${manyWordLabel} 9%`,
        },
      },
    ],
  };

  it.each(chartCases)(
    "renders an accessible, source-linked %s with a complete data table",
    (visualType, Chart) => {
      const markup = renderToStaticMarkup(
        <Chart spec={quantitativeSpec} sourceNodes={quantitativeSourceNodes} />,
      );

      expect(markup).toContain("<svg");
      expect(markup).toMatch(/<svg[^>]+viewBox="[^"]+"/);
      expect(markup).toContain('role="img"');
      expect(markup).toContain("<title ");
      expect(markup).toContain("<desc ");
      expect(markup).toContain(quantitativeSpec.title);
      expect(markup).toContain(quantitativeSpec.explanation);
      expect(markup).toContain(
        `data-visual-id="${visualType}-${quantitativeSpec.id}"`,
      );
      expect(markup).toContain("<pattern");
      expect(markup).toContain("<text");
      expect(markup).toContain("<table");
      expect(markup).toContain("<caption");
      expect(markup).toContain("Series");
      expect(markup).toContain("Value");
      expect(markup.match(/<tr data-chart-point=/g)).toHaveLength(
        quantitativeSpec.points.length,
      );
      expect(markup).toContain("A very long standard plan label");
      expect(markup).toContain("Current");
      expect(markup).toContain("Target");
      expect(markup).toContain("-4");
      expect(markup).toContain("0");
      expect(markup).toContain("%");
      expect(markup).toContain("Derived from");
      expect(markup).toContain('href="#source-paragraph:20-20"');
      expect(markup).toContain(
        'aria-label="Current, Premium plan: -4 %; derived from paragraph:20-20"',
      );
    },
  );

  it.each(chartCases)(
    "keeps six series visibly distinguishable in the %s SVG",
    (_visualType, Chart) => {
      const markup = renderToStaticMarkup(
        <Chart spec={manySeriesSpec} sourceNodes={manySeriesSourceNodes} />,
      );
      const svg = markup.slice(
        markup.indexOf("<svg"),
        markup.indexOf("</svg>") + "</svg>".length,
      );
      const patterns = [...svg.matchAll(/<pattern[^>]*>/g)].map(
        ([element]) => element,
      );
      const patternWidths = patterns.map(
        (element) => element.match(/width="([^"]+)"/)?.[1],
      );
      const seriesLabels = [
        ...svg.matchAll(
          /<text[^>]*data-series-label-for="(\d+)"[^>]*>([^<]+)<\/text>/g,
        ),
      ];

      expect(patterns).toHaveLength(manySeriesSpec.points.length);
      expect(new Set(patternWidths)).toHaveLength(manySeriesSpec.points.length);
      expect(seriesLabels).toHaveLength(manySeriesSpec.points.length);
      for (const [index, point] of manySeriesSpec.points.entries()) {
        expect(seriesLabels[index]?.[1]).toBe(String(index));
        expect(seriesLabels[index]?.[2]).toContain(point.series);
      }
    },
  );

  it.each(chartCases)(
    "hard-wraps and safely constrains long labels in the %s",
    (_visualType, Chart) => {
      const markup = renderToStaticMarkup(
        <Chart spec={longLabelSpec} sourceNodes={longLabelSourceNodes} />,
      );
      const svg = markup.slice(
        markup.indexOf("<svg"),
        markup.indexOf("</svg>") + "</svg>".length,
      );
      const table = markup.slice(
        markup.indexOf("<table"),
        markup.indexOf("</table>") + "</table>".length,
      );
      const viewBoxHeight = Number(
        svg.match(/viewBox="0 0 [^ ]+ ([^"]+)"/)?.[1],
      );
      const labels = [
        ...svg.matchAll(
          /<text[^>]*data-chart-label="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g,
        ),
      ];

      expect(viewBoxHeight).toBeGreaterThan(430);
      expect(labels).toHaveLength(longLabelSpec.points.length);
      for (const [, fullLabel, contents] of labels) {
        const lines = [...contents.matchAll(/<tspan[^>]*>([^<]+)<\/tspan>/g)].map(
          ([, line]) => line,
        );
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.length).toBeLessThanOrEqual(4);
        expect(lines.every((line) => line.length <= 18)).toBe(true);
        expect(table).toContain(fullLabel);
        expect(svg).toContain(`, ${fullLabel}:`);
      }
      expect(labels[1]?.[2]).toContain("…");
    },
  );

  it("places bar series labels below their wrapped category labels", () => {
    const markup = renderToStaticMarkup(
      <BarChart spec={longLabelSpec} sourceNodes={longLabelSourceNodes} />,
    );
    const labelElements = [
      ...markup.matchAll(/<text[^>]*data-chart-label="[^"]+"[^>]*>.*?<\/text>/g),
    ].map(([element]) => element);
    const seriesElements = [
      ...markup.matchAll(/<text[^>]*data-series-label-for="\d+"[^>]*>/g),
    ].map(([element]) => element);

    expect(labelElements).toHaveLength(longLabelSpec.points.length);
    expect(seriesElements).toHaveLength(longLabelSpec.points.length);
    for (const [index, labelElement] of labelElements.entries()) {
      const labelY = Number(labelElement.match(/ y="([^"]+)"/)?.[1]);
      const lineCount = [...labelElement.matchAll(/<tspan/g)].length;
      const lastLabelY = labelY + (lineCount - 1) * 15;
      const seriesY = Number(
        seriesElements[index]?.match(/ y="([^"]+)"/)?.[1],
      );
      expect(seriesY).toBeGreaterThan(lastLabelY);
    }
  });

  it.each(chartCases)("renders no %s for empty data", (_kind, Chart) => {
    const markup = renderToStaticMarkup(
      <Chart
        spec={{ ...quantitativeSpec, points: [] }}
        sourceNodes={quantitativeSourceNodes}
      />,
    );

    expect(markup).toBe("");
  });

  it("rejects a chart whose plotted value is not grounded", () => {
    expect(() =>
      renderToStaticMarkup(
        <BarChart
          spec={{
            ...quantitativeSpec,
            points: [{ ...quantitativeSpec.points[0], value: 120 }],
          }}
          sourceNodes={quantitativeSourceNodes}
        />,
      ),
    ).toThrow(
      "points[0]: Chart point is not present in paragraph:20-20",
    );
  });

  it("preserves negative zero in visible and accessible chart values", () => {
    const evidence = "Loss -0%";
    const sourceNodes = [
      {
        id: "paragraph:22-22",
        type: "paragraph",
        text: evidence,
        startLine: 22,
        endLine: 22,
        urls: [],
      },
    ];
    const markup = renderToStaticMarkup(
      <BarChart
        spec={{
          id: "negative-zero",
          title: "Negative zero",
          explanation: "The sign remains source-faithful.",
          points: [
            {
              label: "Loss",
              value: -0,
              unit: "%",
              source: { nodeId: "paragraph:22-22", evidence },
            },
          ],
        }}
        sourceNodes={sourceNodes}
      />,
    );

    expect(markup).toContain(
      'aria-label="Value, Loss: -0 %; derived from paragraph:22-22"',
    );
    expect(markup).toContain("<td>-0</td>");
    expect(markup).toContain(">-0 %</text>");
  });

  it("places positive, negative, and zero bars around the zero baseline", () => {
    const markup = renderToStaticMarkup(
      <BarChart
        spec={quantitativeSpec}
        sourceNodes={quantitativeSourceNodes}
      />,
    );
    const baseline = markup.match(/<line[^>]*data-zero-baseline="true"[^>]*>/)?.[0];
    const positive = markup.match(/<rect[^>]*data-value="12"[^>]*>/)?.[0];
    const negative = markup.match(/<rect[^>]*data-value="-4"[^>]*>/)?.[0];
    const zero = markup.match(/<rect[^>]*data-value="0"[^>]*>/)?.[0];
    const numberAttribute = (element: string | undefined, name: string) =>
      Number(element?.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
    const baselineY = numberAttribute(baseline, "y1");

    expect(numberAttribute(baseline, "y2")).toBe(baselineY);
    expect(numberAttribute(positive, "y")).toBeLessThan(baselineY);
    expect(
      numberAttribute(positive, "y") + numberAttribute(positive, "height"),
    ).toBeCloseTo(baselineY);
    expect(numberAttribute(negative, "y")).toBeCloseTo(baselineY);
    expect(numberAttribute(negative, "height")).toBeGreaterThan(0);
    expect(numberAttribute(zero, "height")).toBe(0);
  });

  it("draws a distinct line for every series", () => {
    const markup = renderToStaticMarkup(
      <LineChart
        spec={quantitativeSpec}
        sourceNodes={quantitativeSourceNodes}
      />,
    );

    expect(markup.match(/<polyline[^>]*data-series=/g)).toHaveLength(2);
    expect(markup.match(/data-line-point="true"/g)).toHaveLength(
      quantitativeSpec.points.length,
    );
  });

  it("stacks series by label on both sides of zero", () => {
    const markup = renderToStaticMarkup(
      <StackedBar
        spec={quantitativeSpec}
        sourceNodes={quantitativeSourceNodes}
      />,
    );
    const segments = [
      ...markup.matchAll(/<rect[^>]*data-stack-segment="true"[^>]*>/g),
    ].map(([element]) => element);
    const xPositions = new Set(
      segments.map((element) => element.match(/ x="([^"]+)"/)?.[1]),
    );

    expect(segments).toHaveLength(quantitativeSpec.points.length);
    expect(xPositions).toHaveLength(3);
    expect(markup).toContain('data-stack-direction="positive"');
    expect(markup).toContain('data-stack-direction="negative"');
  });

  it("uses unique SVG IDs for repeated chart instances", () => {
    const markup = renderToStaticMarkup(
      <>
        <BarChart
          spec={quantitativeSpec}
          sourceNodes={quantitativeSourceNodes}
        />
        <BarChart
          spec={quantitativeSpec}
          sourceNodes={quantitativeSourceNodes}
        />
      </>,
    );
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders deterministic chart geometry", () => {
    const first = renderToStaticMarkup(
      <ComparisonChart
        spec={quantitativeSpec}
        sourceNodes={quantitativeSourceNodes}
      />,
    );
    const second = renderToStaticMarkup(
      <ComparisonChart
        spec={quantitativeSpec}
        sourceNodes={quantitativeSourceNodes}
      />,
    );

    expect(second).toBe(first);
  });
});

describe("CompleteDocument", () => {
  it("anchors every supported formatted source node exactly once", () => {
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
    const markup = renderToStaticMarkup(
      <CompleteDocument source={source} manifest={reportManifest} />,
    );
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(
      ([, id]) => id,
    );

    for (const node of nodes) {
      expect(
        ids.filter((id) => id === `source-${node.id}`),
        node.id,
      ).toHaveLength(1);
    }
  });

  it("does not let a raw HTML anchor steal a Markdown link's source ID", () => {
    const source =
      '<a id="source-link:1-1" href="https://raw.example">Raw</a> and [Markdown](https://markdown.example)\n';
    const nodes = extractSourceNodes(source);
    const markup = renderToStaticMarkup(
      <CompleteDocument source={source} manifest={reportManifest} />,
    );
    const escapedSource = source
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    expect(nodes.filter(({ type }) => type === "link")).toMatchObject([
      { id: "link:1-1", text: "Markdown" },
    ]);
    expect(markup).toMatch(
      /<a(?=[^>]*href="https:\/\/markdown\.example")(?=[^>]*id="source-link:1-1")[^>]*>Markdown<\/a>/,
    );
    expect(markup).not.toMatch(
      /<a(?=[^>]*href="https:\/\/raw\.example")(?=[^>]*id="source-link:1-1")/,
    );
    expect(markup).toContain(`<pre>${escapedSource}</pre>`);
  });

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
      <Report
        source={"# Plan\n\nAdd canonical source with init_preview.py.\n"}
        manifest={reportManifest}
      />,
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
        source={"# Plan\n"}
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
        source={"# Plan\n\nDecision evidence\n"}
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

  it("suppresses derived editorial claims with invalid evidence", () => {
    const invalidTitle = "Unsupported editorial claim";
    const invalidBody = "This statement has no source support.";
    const editorialData = {
      ...emptyEditorialData,
      highlights: [
        {
          label: "Claim",
          title: invalidTitle,
          body: invalidBody,
          source: [
            {
              nodeId: "paragraph:3-3",
              evidence: "invented evidence",
            },
          ],
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <Report
        source={"# Plan\n\nGrounded source text.\n"}
        manifest={reportManifest}
        editorialData={editorialData}
      />,
    );

    expect(markup).not.toContain(invalidTitle);
    expect(markup).not.toContain(invalidBody);
    expect(markup).toContain("Grounded source text.");
  });

  it("does not present starter process relationships as sourced facts", () => {
    const markup = renderToStaticMarkup(
      <Report
        source={"# Preview\n\nAdd canonical source with init_preview.py.\n"}
        manifest={reportManifest}
      />,
    );

    expect(markup).not.toContain("data-visual-id");
    expect(markup).not.toContain("Source readiness branch");
    expect(markup).not.toContain("Preview dependencies");
  });

  it("links graph provenance to unique canonical formatted-source anchors", () => {
    const markup = renderToStaticMarkup(
      <Report
        source={processSource}
        manifest={reportManifest}
        editorialData={emptyEditorialData}
      >
        <ProcessFlow spec={processSpec} sourceNodes={processSourceNodes} />
      </Report>,
    );
    const hrefTargets = [...markup.matchAll(/href="#([^"]+)"/g)].map(
      ([, target]) => target,
    );
    const elementIds = [...markup.matchAll(/\sid="([^"]+)"/g)].map(
      ([, id]) => id,
    );

    expect(markup).toContain('data-visual-id="process-flow-release-workflow"');
    expect(hrefTargets).toContain("source-paragraph:3-3");
    for (const target of new Set(hrefTargets)) {
      expect(elementIds.filter((id) => id === target)).toHaveLength(1);
    }
    for (const node of processSourceNodes) {
      expect(elementIds).toContain(`source-${node.id}`);
    }
  });
});
