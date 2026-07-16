import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Highlight = { label: string; title: string; body: string };
type Comparison = { label: string; before: string; after: string };
type TimelineEntry = { label: string; title: string; body: string };
type Risk = { level: "low" | "medium" | "high"; title: string; body: string };
type Action = { title: string; body: string };

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
}: {
  title: string;
  eyebrow: string;
  lede: string;
  status?: string;
}) {
  return (
    <header className="editorial-hero">
      <div className="editorial-hero__topline">
        <p className="eyebrow">{eyebrow}</p>
        {status ? (
          <p className="status" data-status={status}>
            {status}
          </p>
        ) : null}
      </div>
      <h1>{title}</h1>
      <p className="lede">{lede}</p>
      <PrintButton />
    </header>
  );
}

function Section({
  kicker,
  title,
  id,
  children,
}: {
  kicker: string;
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section className="editorial-section" aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <p className="section-kicker">{kicker}</p>
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function HighlightGrid({
  items,
  kicker = "Verdict",
  title = "Key decisions",
}: {
  items: Highlight[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="highlights">
      <div className="card-grid highlight-grid">
        {items.map((item, index) => (
          <article className="editorial-card highlight-card" key={index}>
            <p className="card-label">{item.label}</p>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function ComparisonGrid({
  items,
  kicker = "Delta",
  title = "What changes",
}: {
  items: Comparison[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="comparisons">
      <div className="card-grid comparison-grid">
        {items.map((item, index) => (
          <article className="editorial-card comparison-card" key={index}>
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
          </article>
        ))}
      </div>
    </Section>
  );
}

export function Timeline({
  items,
  kicker = "Sequence",
  title = "Timeline",
}: {
  items: TimelineEntry[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="timeline">
      <ol className="timeline-list">
        {items.map((item, index) => (
          <li className="timeline-item" key={index}>
            <div className="timeline-marker" aria-hidden="true">
              {index + 1}
            </div>
            <div className="timeline-content">
              <p className="card-label">{item.label}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function RiskList({
  items,
  kicker = "Watchlist",
  title = "Risks to watch",
}: {
  items: Risk[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="risks">
      <ul className="editorial-list risk-list">
        {items.map((item, index) => (
          <li className="editorial-card risk-item" data-level={item.level} key={index}>
            <div>
              <p className="risk-level">{item.level} risk</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ActionList({
  items,
  kicker = "Ownership",
  title = "Next actions",
}: {
  items: Action[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="actions">
      <ol className="editorial-list action-list">
        {items.map((item, index) => (
          <li className="editorial-card action-item" key={index}>
            <span className="action-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function CompleteDocument({ source }: { source: string }) {
  return (
    <details className="complete-document" open>
      <summary>Full document</summary>
      <article className="source-document" aria-label="Formatted source">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
      </article>
      <details className="source-verification">
        <summary>Raw source text</summary>
        <pre>{source}</pre>
      </details>
    </details>
  );
}
