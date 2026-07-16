import type { ComponentType } from "react";

export type ReportMeta = {
  title: string;
  project: string;
  slug: string;
  date: string;
  source_path: string;
};

type ReportModule = () => Promise<{ default: ComponentType<{ source: string }> }>;
type SourceModule = () => Promise<string>;

const metaModules = import.meta.glob("../content/*/*/meta.json", {
  eager: true,
}) as Record<string, { default: ReportMeta }>;
const reportModules = import.meta.glob(
  "../content/*/*/report.mdx",
) as Record<string, ReportModule>;
const sourceModules = import.meta.glob("../content/*/*/source.md", {
  query: "?raw",
  import: "default",
}) as Record<string, SourceModule>;

const folder = (project: string, slug: string) => `../content/${project}/${slug}`;

export function allReports(): ReportMeta[] {
  return Object.values(metaModules).map((module) => module.default);
}

export function findMeta(project: string, slug: string): ReportMeta | undefined {
  return metaModules[`${folder(project, slug)}/meta.json`]?.default;
}

export function loadReport(project: string, slug: string): ReportModule | undefined {
  return reportModules[`${folder(project, slug)}/report.mdx`];
}

export function loadSource(project: string, slug: string): SourceModule | undefined {
  return sourceModules[`${folder(project, slug)}/source.md`];
}
