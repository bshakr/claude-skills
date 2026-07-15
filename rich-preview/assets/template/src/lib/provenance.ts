import type { EditorialData } from "../components/editorial";
import type { SourceNode, SourceRef } from "./source";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type ProcessNodeSpec = {
  id: string;
  label: string;
  source: SourceRef;
};

export type ProcessEdgeSpec = {
  from: string;
  to: string;
  label?: string;
  source: SourceRef;
};

export type ProcessSpec = {
  id: string;
  title: string;
  explanation: string;
  nodes: ProcessNodeSpec[];
  edges: ProcessEdgeSpec[];
};

const svgSafeIdPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function validateSourceRef(
  ref: SourceRef,
  nodes: SourceNode[],
): ValidationResult {
  const node = nodes.find(({ id }) => id === ref?.nodeId);

  if (!node) {
    return {
      valid: false,
      error: `Source node not found: ${ref?.nodeId ?? "missing"}`,
    };
  }
  if (!ref.evidence) {
    return {
      valid: false,
      error: `Evidence is required for ${ref.nodeId}`,
    };
  }
  if (!node.text.includes(ref.evidence)) {
    return {
      valid: false,
      error: `Evidence not found in ${ref.nodeId}`,
    };
  }
  return { valid: true };
}

function contextualize(
  context: string,
  result: ValidationResult,
): ValidationResult {
  if (result.valid) {
    return result;
  }
  return { valid: false, error: `${context}: ${result.error}` };
}

export function validateProcessSpec(
  spec: ProcessSpec,
  nodes: SourceNode[],
): ValidationResult {
  if (!spec.id.trim()) {
    return { valid: false, error: "Process ID is required" };
  }
  if (!svgSafeIdPattern.test(spec.id)) {
    return { valid: false, error: "Process ID must be SVG-safe" };
  }
  if (!spec.title.trim()) {
    return { valid: false, error: "Process title is required" };
  }
  if (!spec.explanation.trim()) {
    return { valid: false, error: "Process explanation is required" };
  }
  if (spec.nodes.length === 0) {
    return { valid: false, error: "Process spec must include at least one node" };
  }

  const nodeIds = new Set<string>();
  for (const [index, processNode] of spec.nodes.entries()) {
    if (!processNode.id.trim()) {
      return {
        valid: false,
        error: `nodes[${index}]: Process node ID is required`,
      };
    }
    if (!svgSafeIdPattern.test(processNode.id)) {
      return {
        valid: false,
        error: `nodes[${index}]: Process node ID must be SVG-safe`,
      };
    }
    if (!processNode.label.trim()) {
      return {
        valid: false,
        error: `nodes[${index}]: Process node label is required`,
      };
    }
    if (nodeIds.has(processNode.id)) {
      return {
        valid: false,
        error: `Duplicate process node ID: ${processNode.id}`,
      };
    }
    nodeIds.add(processNode.id);

    if (!processNode.source) {
      return {
        valid: false,
        error: `nodes[${index}]: Missing source provenance`,
      };
    }
    const result = contextualize(
      `nodes[${index}]`,
      validateSourceRef(processNode.source, nodes),
    );
    if (!result.valid) {
      return result;
    }
  }

  for (const [index, edge] of spec.edges.entries()) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return {
        valid: false,
        error: `Unknown process edge endpoint: ${edge.from} -> ${edge.to}`,
      };
    }
    if (!edge.source) {
      return {
        valid: false,
        error: `edges[${index}]: Missing source provenance`,
      };
    }
    const result = contextualize(
      `edges[${index}]`,
      validateSourceRef(edge.source, nodes),
    );
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

export function validateEditorialData(
  data: EditorialData,
  nodes: SourceNode[],
): ValidationResult {
  const groups = [
    ["highlights", data.highlights],
    ["comparisons", data.comparisons],
    ["timeline", data.timeline],
    ["risks", data.risks],
    ["actions", data.actions],
  ] as const;

  for (const [groupName, items] of groups) {
    for (const [itemIndex, item] of items.entries()) {
      const context = `${groupName}[${itemIndex}]`;
      if (!item.source?.length) {
        return { valid: false, error: `${context}: Missing source provenance` };
      }
      for (const ref of item.source) {
        const result = contextualize(
          context,
          validateSourceRef(ref, nodes),
        );
        if (!result.valid) {
          return result;
        }
      }
    }
  }

  return { valid: true };
}
