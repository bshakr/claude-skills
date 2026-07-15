import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { collectContentValidation } from "./validate-content";

const source = "# Plan\n\nShip 5 sites. See https://example.com/plan.\n";
const sourceRef = {
  nodeId: "paragraph:3-3",
  evidence: "Ship 5 sites.",
};
const emptyEditorial = {
  title: "Plan",
  eyebrow: "Decision",
  lede: "Ship the plan.",
  status: "Ready",
  highlights: [],
  comparisons: [],
  timeline: [],
  risks: [],
  actions: [],
};

describe("content validation script", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  async function writePreview(reportData: unknown): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "rich-preview-validation-"));
    roots.push(root);
    const content = join(root, "src", "content");
    await mkdir(content, { recursive: true });
    await writeFile(join(content, "source.md"), source);
    await writeFile(
      join(content, "preview-manifest.json"),
      JSON.stringify({
        slug: "plan",
        source_filename: "plan.md",
        source_path: "/tmp/plan.md",
        source_sha256: "digest",
      }),
    );
    await writeFile(
      join(content, "report-data.json"),
      JSON.stringify(reportData),
    );
    return root;
  }

  it("analyzes actual editorial, process, and chart data", async () => {
    const root = await writePreview({
      ...emptyEditorial,
      highlights: [
        {
          label: "Decision",
          title: "Ship",
          body: "Ship to five sites.",
          source: [sourceRef],
        },
      ],
      processes: [
        {
          id: "rollout",
          title: "Rollout",
          explanation: "Ship the rollout.",
          nodes: [{ id: "ship", label: "Ship", source: sourceRef }],
          edges: [],
        },
      ],
      charts: [
        {
          id: "sites",
          title: "Sites",
          explanation: "Sites in the plan.",
          points: [
            {
              label: "Ship",
              value: 5,
              unit: "sites",
              source: sourceRef,
            },
          ],
        },
      ],
    });

    await expect(collectContentValidation(root)).resolves.toEqual({
      sourceNodes: 3,
      sourceUrls: 2,
      coveragePercent: 100,
      visuals: 3,
      provenanceValid: true,
    });
  });

  it.each([
    ["missing", emptyEditorial],
    ["empty", { ...emptyEditorial, processes: [], charts: [] }],
  ])("accepts %s optional visual collections", async (_label, reportData) => {
    const root = await writePreview(reportData);

    await expect(collectContentValidation(root)).resolves.toMatchObject({
      visuals: 1,
      provenanceValid: true,
    });
  });

  it("marks a malformed optional visual collection invalid", async () => {
    const root = await writePreview({
      ...emptyEditorial,
      processes: { id: "not-an-array" },
    });

    await expect(collectContentValidation(root)).resolves.toMatchObject({
      visuals: 2,
      provenanceValid: false,
    });
  });
});
