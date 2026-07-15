import type { Nodes } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
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
