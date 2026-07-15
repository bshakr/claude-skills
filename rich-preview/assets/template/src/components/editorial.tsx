import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { sourceCoverage, type SourceRef } from "../lib/source";

export type PreviewManifest = {
  slug: string;
  source_filename: string;
  source_path: string;
  source_sha256: string;
};

export type EditorialData = {
  title: string;
  eyebrow: string;
  lede: string;
  status: string;
  highlights: Array<{
    label: string;
    title: string;
    body: string;
    source: SourceRef[];
  }>;
  comparisons: Array<{
    label: string;
    before: string;
    after: string;
    source: SourceRef[];
  }>;
  timeline: Array<{
    label: string;
    title: string;
    body: string;
    source: SourceRef[];
  }>;
  risks: Array<{
    level: "low" | "medium" | "high";
    title: string;
    body: string;
    source: SourceRef[];
  }>;
  actions: Array<{
    title: string;
    body: string;
    source: SourceRef[];
  }>;
};

type CompleteDocumentProps = {
  source: string;
  manifest: PreviewManifest;
};

type EditorialItems<T> = {
  items: T[];
};

function sourceNodeIds(source: SourceRef[]): string {
  return [...new Set(source.map(({ nodeId }) => nodeId))].join(" ");
}

export function SourceBadge({ source }: { source: SourceRef[] }) {
  const count = source.length;
  const label = `${count} source ${count === 1 ? "reference" : "references"}`;

  return (
    <span
      className="source-badge"
      title={source.map(({ evidence }) => evidence).join(" · ")}
    >
      {label}
    </span>
  );
}

export function PrintButton() {
  return (
    <button className="print-button" type="button" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}

export function Hero({
  title,
  eyebrow,
  lede,
  status,
}: Pick<EditorialData, "title" | "eyebrow" | "lede" | "status">) {
  return (
    <header className="editorial-hero">
      <div className="editorial-hero__topline">
        <p className="eyebrow">{eyebrow}</p>
        <p className="status" data-status={status}>
          {status}
        </p>
      </div>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
      <PrintButton />
    </header>
  );
}

export function HighlightGrid({
  items,
}: EditorialItems<EditorialData["highlights"][number]>) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="editorial-section" aria-labelledby="highlights-title">
      <div className="section-heading">
        <p className="section-kicker">Verdict</p>
        <h2 id="highlights-title">Key decisions</h2>
      </div>
      <div className="card-grid highlight-grid">
        {items.map((item, index) => (
          <article
            className="editorial-card highlight-card"
            data-source-node-ids={sourceNodeIds(item.source)}
            key={`${item.label}-${item.title}-${index}`}
          >
            <p className="card-label">{item.label}</p>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <SourceBadge source={item.source} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function ComparisonGrid({
  items,
}: EditorialItems<EditorialData["comparisons"][number]>) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="editorial-section" aria-labelledby="comparisons-title">
      <div className="section-heading">
        <p className="section-kicker">Delta</p>
        <h2 id="comparisons-title">What changes</h2>
      </div>
      <div className="card-grid comparison-grid">
        {items.map((item, index) => (
          <article
            className="editorial-card comparison-card"
            data-source-node-ids={sourceNodeIds(item.source)}
            key={`${item.label}-${index}`}
          >
            <p className="card-label">{item.label}</p>
            <dl>
              <div>
                <dt>Before</dt>
                <dd>{item.before}</dd>
              </div>
              <div>
                <dt>After</dt>
                <dd>{item.after}</dd>
              </div>
            </dl>
            <SourceBadge source={item.source} />
          </article>
        ))}
      </div>
    </section>
  );
}

export function Timeline({
  items,
}: EditorialItems<EditorialData["timeline"][number]>) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="editorial-section" aria-labelledby="timeline-title">
      <div className="section-heading">
        <p className="section-kicker">Sequence</p>
        <h2 id="timeline-title">Timeline</h2>
      </div>
      <ol className="timeline-list">
        {items.map((item, index) => (
          <li
            className="timeline-item"
            data-source-node-ids={sourceNodeIds(item.source)}
            key={`${item.label}-${item.title}-${index}`}
          >
            <div className="timeline-marker" aria-hidden="true">
              {index + 1}
            </div>
            <div className="timeline-content">
              <p className="card-label">{item.label}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <SourceBadge source={item.source} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RiskList({
  items,
}: EditorialItems<EditorialData["risks"][number]>) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="editorial-section" aria-labelledby="risks-title">
      <div className="section-heading">
        <p className="section-kicker">Watchlist</p>
        <h2 id="risks-title">Risks to watch</h2>
      </div>
      <ul className="editorial-list risk-list">
        {items.map((item, index) => (
          <li
            className="editorial-card risk-item"
            data-level={item.level}
            data-source-node-ids={sourceNodeIds(item.source)}
            key={`${item.level}-${item.title}-${index}`}
          >
            <div>
              <p className="risk-level">{item.level} risk</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
            <SourceBadge source={item.source} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ActionList({
  items,
}: EditorialItems<EditorialData["actions"][number]>) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="editorial-section" aria-labelledby="actions-title">
      <div className="section-heading">
        <p className="section-kicker">Ownership</p>
        <h2 id="actions-title">Next actions</h2>
      </div>
      <ol className="editorial-list action-list">
        {items.map((item, index) => (
          <li
            className="editorial-card action-item"
            data-source-node-ids={sourceNodeIds(item.source)}
            key={`${item.title}-${index}`}
          >
            <span className="action-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <SourceBadge source={item.source} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EditorialLayer({ data }: { data: EditorialData }) {
  return (
    <article className="editorial-layer" data-editorial-layer="true">
      <Hero
        title={data.title}
        eyebrow={data.eyebrow}
        lede={data.lede}
        status={data.status}
      />
      <HighlightGrid items={data.highlights} />
      <ComparisonGrid items={data.comparisons} />
      <Timeline items={data.timeline} />
      <RiskList items={data.risks} />
      <ActionList items={data.actions} />
    </article>
  );
}

export function CompleteDocument({ source, manifest }: CompleteDocumentProps) {
  const coverage = sourceCoverage(source);

  return (
    <main className="complete-document" data-complete-document="true">
      <header className="document-header">
        <p className="eyebrow">Canonical source · {manifest.source_filename}</p>
        <h1>Complete document</h1>
        <p>
          {coverage.totalNodes} source nodes · {coverage.percentage}% coverage
        </p>
        <code>{manifest.source_sha256}</code>
      </header>
      <article className="source-document" aria-label="Formatted source">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            img: ({ alt }) => (
              <span data-inert-image="true">{alt ?? "Image"}</span>
            ),
          }}
        >
          {source}
        </ReactMarkdown>
      </article>
      <details className="source-verification">
        <summary>Verify canonical source</summary>
        <pre>{source}</pre>
      </details>
    </main>
  );
}
