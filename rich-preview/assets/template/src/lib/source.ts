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

type RawHtmlOrigin = {
  startOffset: number;
  endOffset: number;
  tagName?: string;
};

type SourceAnchorIdentity = {
  nodeId: string;
  type: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
};

export type SourceAnchorModel = {
  identities: SourceAnchorIdentity[];
  rawHtmlOrigins: RawHtmlOrigin[];
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
  model: SourceAnchorModel,
): Plugin<[], HastRoot> {
  const sourceNodesByIdentity = new Map<string, SourceAnchorIdentity>();
  for (const identity of model.identities) {
    sourceNodesByIdentity.set(
      `${identity.type}:${identity.startOffset}-${identity.endOffset}`,
      identity,
    );
  }

  return () => (tree) => {
    const anchoredSourceIds = new Set<string>();
    const elements: HastElement[] = [];

    visit(tree, "element", (element: HastElement) => {
      const sourceType = sourceTypeForElement(element);
      const startOffset = element.position?.start.offset;
      const endOffset = element.position?.end.offset;
      if (startOffset === undefined || endOffset === undefined) {
        return;
      }

      const hasRawOrigin = model.rawHtmlOrigins.some(
        (origin) =>
          (origin.startOffset <= startOffset && origin.endOffset >= endOffset) ||
          (origin.startOffset === startOffset &&
            origin.tagName === element.tagName),
      );
      if (hasRawOrigin) {
        return;
      }
      elements.push(element);

      if (!sourceType) {
        return;
      }
      const identity = sourceNodesByIdentity.get(
        `${sourceType}:${startOffset}-${endOffset}`,
      );
      if (!identity) {
        return;
      }
      element.properties.id = sourceAnchorId(identity.nodeId);
      anchoredSourceIds.add(identity.nodeId);
    });

    for (const identity of model.identities) {
      if (anchoredSourceIds.has(identity.nodeId)) {
        continue;
      }

      const containingElements = elements.filter(
        (element) =>
          element.position &&
          element.position.start.line <= identity.startLine &&
          element.position.end.line >= identity.endLine,
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
          id: sourceAnchorId(identity.nodeId),
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

export function extractSourceAnchorModel(markdown: string): SourceAnchorModel {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const identities: SourceAnchorIdentity[] = [];
  const rawHtmlOrigins: RawHtmlOrigin[] = [];
  const idOccurrences = new Map<string, number>();

  visit(tree, (node) => {
    if (!sourceNodeTypes.has(node.type) || !node.position) {
      return;
    }
    const startOffset = node.position.start.offset;
    const endOffset = node.position.end.offset;
    if (startOffset === undefined || endOffset === undefined) {
      return;
    }
    const startLine = node.position.start.line;
    const endLine = node.position.end.line;
    const baseId = sourceNodeId(node.type, startLine, endLine);
    const occurrence = (idOccurrences.get(baseId) ?? 0) + 1;
    idOccurrences.set(baseId, occurrence);
    identities.push({
      nodeId: occurrence === 1 ? baseId : `${baseId}:${occurrence}`,
      type: node.type,
      startLine,
      endLine,
      startOffset,
      endOffset,
    });
  });

  visit(tree, "html", (node) => {
    const startOffset = node.position?.start.offset;
    const endOffset = node.position?.end.offset;
    if (startOffset === undefined || endOffset === undefined) {
      return;
    }
    const tagName = node.value
      .match(/^<\s*([A-Za-z][A-Za-z0-9:-]*)\b/)?.[1]
      ?.toLowerCase();
    rawHtmlOrigins.push({ startOffset, endOffset, tagName });
  });
  return { identities, rawHtmlOrigins };
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
