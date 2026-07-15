import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompleteDocument } from "./components/editorial";
import { extractSourceNodes, sourceCoverage } from "./lib/source";

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
});
