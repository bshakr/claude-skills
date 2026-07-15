import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { EditorialData } from "../src/components/editorial";
import {
  type ValidationResult,
  validateChartSpec,
  validateEditorialData,
  validateProcessSpec,
} from "../src/lib/provenance";
import {
  extractSourceNodes,
  sourceCoverage,
  type SourceNode,
} from "../src/lib/source";

type ReportData = EditorialData & {
  charts?: unknown;
  processes?: unknown;
};

type ContentValidation = {
  sourceNodes: number;
  sourceUrls: number;
  coveragePercent: number;
  visuals: number;
  provenanceValid: boolean;
};

function validateValue<T>(
  value: unknown,
  nodes: SourceNode[],
  validator: (value: T, nodes: SourceNode[]) => ValidationResult,
): ValidationResult {
  try {
    return validator(value as T, nodes);
  } catch {
    return { valid: false, error: "Invalid visual specification" };
  }
}

function validateOptionalCollection<T>(
  value: unknown,
  nodes: SourceNode[],
  validator: (value: T, nodes: SourceNode[]) => ValidationResult,
): ValidationResult[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [{ valid: false, error: "Visual collection must be an array" }];
  }
  return value.map((item) => validateValue(item, nodes, validator));
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
  const reportData = JSON.parse(reportDataText) as ReportData;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Preview manifest must be a JSON object");
  }

  const nodes = extractSourceNodes(source);
  const coverage = sourceCoverage(source);
  const visualResults: ValidationResult[] = [
    validateValue(reportData, nodes, validateEditorialData),
    ...validateOptionalCollection(
      reportData.processes,
      nodes,
      validateProcessSpec,
    ),
    ...validateOptionalCollection(
      reportData.charts,
      nodes,
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
