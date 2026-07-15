import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { sourceCoverage } from "../lib/source";

export type PreviewManifest = {
  slug: string;
  source_filename: string;
  source_path: string;
  source_sha256: string;
};

type CompleteDocumentProps = {
  source: string;
  manifest: PreviewManifest;
};

export function CompleteDocument({ source, manifest }: CompleteDocumentProps) {
  const coverage = sourceCoverage(source);

  return (
    <main data-complete-document="true">
      <header>
        <p>{manifest.source_filename}</p>
        <h1>Complete document</h1>
        <p>
          {coverage.totalNodes} source nodes · {coverage.percentage}% coverage
        </p>
        <code>{manifest.source_sha256}</code>
      </header>
      <article aria-label="Formatted source">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
        >
          {source}
        </ReactMarkdown>
      </article>
      <details>
        <summary>Verify canonical source</summary>
        <pre>{source}</pre>
      </details>
    </main>
  );
}
