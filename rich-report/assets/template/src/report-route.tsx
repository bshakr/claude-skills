import { Suspense, lazy, useMemo, type ReactNode } from "react";

import { findMeta, loadReport, loadSource } from "./content";
import { ErrorBoundary } from "./error-boundary";
import { NotFound } from "./not-found";

const mdxComponents = {
  wrapper: ({ children }: { children?: ReactNode }) => (
    <div className="preview-shell">{children}</div>
  ),
};

export function ReportRoute({ project, slug }: { project: string; slug: string }) {
  const meta = findMeta(project, slug);
  const report = loadReport(project, slug);
  const source = loadSource(project, slug);

  const Report = useMemo(() => {
    if (!report || !source) {
      return null;
    }
    return lazy(async () => {
      const [module, text] = await Promise.all([report(), source()]);
      const Authored = module.default;
      return { default: () => <Authored source={text} components={mdxComponents} /> };
    });
  }, [report, source]);

  if (!meta || !Report) {
    return <NotFound />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="preview-shell hub-loading">Loading report…</div>}>
        <Report />
      </Suspense>
    </ErrorBoundary>
  );
}
