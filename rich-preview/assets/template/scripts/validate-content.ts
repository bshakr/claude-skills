import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { EditorialData } from "../src/components/editorial";
import {
  type ChartSpec,
  type ProcessSpec,
  type ValidationResult,
  validateChartSpec,
  validateEditorialData,
  validateProcessSpec,
} from "../src/lib/provenance";
import {
  extractSourceNodes,
  sourceCoverage,
  type SourceNode,
  type SourceRef,
} from "../src/lib/source";

type ContentValidation = {
  sourceNodes: number;
  sourceUrls: number;
  coveragePercent: number;
  visuals: number;
  provenanceValid: boolean;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasStrings(value: JsonObject, fields: string[]): boolean {
  return fields.every((field) => isNonEmptyString(value[field]));
}

function isSourceRef(value: unknown): value is SourceRef {
  return isObject(value) && hasStrings(value, ["nodeId", "evidence"]);
}

function isSourceRefArray(value: unknown): value is SourceRef[] {
  return Array.isArray(value) && value.length > 0 && value.every(isSourceRef);
}

function isEditorialItems(value: unknown, stringFields: string[]): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isObject(item) &&
        hasStrings(item, stringFields) &&
        isSourceRefArray(item.source),
    )
  );
}

function isEditorialData(value: unknown): value is EditorialData {
  if (
    !isObject(value) ||
    !hasStrings(value, ["title", "eyebrow", "lede", "status"])
  ) {
    return false;
  }
  if (
    !isEditorialItems(value.highlights, ["label", "title", "body"]) ||
    !isEditorialItems(value.comparisons, ["label", "before", "after"]) ||
    !isEditorialItems(value.timeline, ["label", "title", "body"]) ||
    !isEditorialItems(value.risks, ["level", "title", "body"]) ||
    !isEditorialItems(value.actions, ["title", "body"])
  ) {
    return false;
  }
  return (
    Array.isArray(value.risks) &&
    value.risks.every(
      (risk) =>
        isObject(risk) &&
        (risk.level === "low" ||
          risk.level === "medium" ||
          risk.level === "high"),
    )
  );
}

function isProcessSpec(value: unknown): value is ProcessSpec {
  if (
    !isObject(value) ||
    !hasStrings(value, ["id", "title", "explanation"]) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    return false;
  }
  const nodesValid = value.nodes.every(
    (node) =>
      isObject(node) &&
      hasStrings(node, ["id", "label"]) &&
      isSourceRef(node.source),
  );
  const edgesValid = value.edges.every(
    (edge) =>
      isObject(edge) &&
      hasStrings(edge, ["from", "to"]) &&
      (edge.label === undefined || isNonEmptyString(edge.label)) &&
      isSourceRef(edge.source),
  );
  return nodesValid && edgesValid;
}

function isChartSpec(value: unknown): value is ChartSpec {
  if (
    !isObject(value) ||
    !hasStrings(value, ["id", "title", "explanation"]) ||
    !Array.isArray(value.points)
  ) {
    return false;
  }
  return value.points.every(
    (point) =>
      isObject(point) &&
      hasStrings(point, ["label", "unit"]) &&
      typeof point.value === "number" &&
      Number.isFinite(point.value) &&
      (point.series === undefined || isNonEmptyString(point.series)) &&
      isSourceRef(point.source),
  );
}

function invalidShape(): ValidationResult {
  return { valid: false, error: "Invalid visual specification" };
}

function validateValue<T>(
  value: unknown,
  nodes: SourceNode[],
  validator: (value: T, nodes: SourceNode[]) => ValidationResult,
): ValidationResult {
  try {
    return validator(value as T, nodes);
  } catch {
    return invalidShape();
  }
}

function validateOptionalCollection<T>(
  value: unknown,
  nodes: SourceNode[],
  shape: (value: unknown) => value is T,
  validator: (value: T, nodes: SourceNode[]) => ValidationResult,
): ValidationResult[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [{ valid: false, error: "Visual collection must be an array" }];
  }
  return value.map((item) =>
    shape(item) ? validateValue(item, nodes, validator) : invalidShape(),
  );
}

export async function collectContentValidation(
  root: string = process.cwd(),
): Promise<ContentValidation> {
  const contentRoot = resolve(root, "src", "content");
  const [source, manifestText, reportDataText] = await Promise.all([
    readFile(resolve(contentRoot, "source.md"), "utf8"),
    readFile(resolve(contentRoot, "preview-manifest.json"), "utf8"),
    readFile(resolve(contentRoot, "report-data.json"), "utf8"),
  ]);
  const manifest: unknown = JSON.parse(manifestText);
  const reportData: unknown = JSON.parse(reportDataText);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Preview manifest must be a JSON object");
  }

  const nodes = extractSourceNodes(source);
  const coverage = sourceCoverage(source);
  const reportDataObject = isObject(reportData) ? reportData : {};
  const visualResults: ValidationResult[] = [
    isEditorialData(reportData)
      ? validateValue(reportData, nodes, validateEditorialData)
      : invalidShape(),
    ...validateOptionalCollection(
      reportDataObject.processes,
      nodes,
      isProcessSpec,
      validateProcessSpec,
    ),
    ...validateOptionalCollection(
      reportDataObject.charts,
      nodes,
      isChartSpec,
      validateChartSpec,
    ),
  ];

  return {
    sourceNodes: nodes.length,
    sourceUrls: nodes.flatMap((node) => node.urls).length,
    coveragePercent: coverage.percentage,
    visuals: visualResults.length,
    provenanceValid: visualResults.every((result) => result.valid),
  };
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const result = await collectContentValidation();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
