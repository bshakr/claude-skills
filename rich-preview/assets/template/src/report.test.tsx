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
