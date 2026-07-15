import type { Element as HastElement, Root as HastRoot } from "hast";
import type { Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified, type Plugin } from "unified";
import { visit } from "unist-util-visit";

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

export type SourceCoverage = {
  nodes: SourceNode[];
  totalNodes: number;
  coveredNodes: number;
  percentage: number;
};

const sourceNodeTypes = new Set([
  "heading",
  "paragraph",
  "listItem",
  "tableCell",
  "code",
  "link",
]);
const rawUrlPattern = /https?:\/\/[^\s<>()\[\]{}"']+/g;

export function sourceNodeId(
  type: string,
  startLine: number,
  endLine: number,
): string {
  return `${type}:${startLine}-${endLine}`;
}

export function sourceAnchorId(nodeId: string): string {
  return `source-${nodeId}`;
}

function sourceTypeForElement(element: HastElement): string | undefined {
  if (/^h[1-6]$/.test(element.tagName)) {
    return "heading";
  }
  return {
    a: "link",
    code: "code",
    li: "listItem",
    p: "paragraph",
    td: "tableCell",
    th: "tableCell",
  }[element.tagName];
}

export function canonicalSourceAnchorPlugin(
  nodes: SourceNode[],
): Plugin<[], HastRoot> {
  const sourceIdsByBase = new Map<string, string[]>();
  for (const node of nodes) {
    const baseId = sourceNodeId(node.type, node.startLine, node.endLine);
    const ids = sourceIdsByBase.get(baseId) ?? [];
    ids.push(node.id);
    sourceIdsByBase.set(baseId, ids);
  }

  return () => (tree) => {
    const anchoredSourceIds = new Set<string>();
    const elements: HastElement[] = [];
    const occurrences = new Map<string, number>();

    visit(tree, "element", (element: HastElement) => {
      elements.push(element);
      const sourceType = sourceTypeForElement(element);
      if (!sourceType || !element.position) {
        return;
      }

      const baseId = sourceNodeId(
        sourceType,
        element.position.start.line,
        element.position.end.line,
      );
      const sourceIds = sourceIdsByBase.get(baseId);
      if (!sourceIds) {
        return;
      }

      const occurrence = occurrences.get(baseId) ?? 0;
      const sourceId = sourceIds[occurrence];
      if (!sourceId) {
        return;
      }
      occurrences.set(baseId, occurrence + 1);
      element.properties.id = sourceAnchorId(sourceId);
      anchoredSourceIds.add(sourceId);
    });

    for (const node of nodes) {
      if (anchoredSourceIds.has(node.id)) {
        continue;
      }

      const containingElements = elements.filter(
        (element) =>
          element.position &&
          element.position.start.line <= node.startLine &&
          element.position.end.line >= node.endLine,
      );
      const target = containingElements.at(-1);
      if (!target) {
        continue;
      }
      target.children.unshift({
        type: "element",
        tagName: "span",
        properties: {
          ariaHidden: "true",
          id: sourceAnchorId(node.id),
        },
        children: [],
      });
    }
  };
}

function nodeText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("alt" in node && typeof node.alt === "string") {
    return node.alt;
  }
  if ("children" in node) {
    return node.children.map(nodeText).join("");
  }
  return "";
}

function trimUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

function nodeUrls(node: Nodes): string[] {
  const urls: string[] = [];
  const addUrl = (url: string) => {
    const normalized = trimUrlPunctuation(url);
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized);
    }
  };

  visit(node, "link", (link) => addUrl(link.url));
  for (const match of nodeText(node).matchAll(rawUrlPattern)) {
    addUrl(match[0]);
  }
  return urls;
}

export function extractSourceNodes(markdown: string): SourceNode[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const nodes: SourceNode[] = [];
  const idOccurrences = new Map<string, number>();

  visit(tree, (node) => {
    if (!sourceNodeTypes.has(node.type) || !node.position) {
      return;
    }
    const startLine = node.position.start.line;
    const endLine = node.position.end.line;
    const baseId = sourceNodeId(node.type, startLine, endLine);
    const occurrence = (idOccurrences.get(baseId) ?? 0) + 1;
    idOccurrences.set(baseId, occurrence);
    nodes.push({
      id: occurrence === 1 ? baseId : `${baseId}:${occurrence}`,
      type: node.type,
      text: nodeText(node),
      startLine,
      endLine,
      urls: nodeUrls(node),
    });
  });
  return nodes;
}

export function sourceCoverage(markdown: string): SourceCoverage {
  const nodes = extractSourceNodes(markdown);
  return {
    nodes,
    totalNodes: nodes.length,
    coveredNodes: nodes.length,
    percentage: 100,
  };
}
