import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Highlight = { label: string; title: string; body: string };
type Comparison = {
  label: string;
  before: string;
  after: string;
  beforeDetail?: string;
  afterDetail?: string;
};
type TimelineEntry = { label: string; title: string; body: string };
type Risk = { level: "low" | "medium" | "high"; title: string; body: string };
type Action = { title: string; body: string };
type Stat = { value: string; label: string; detail?: string };
type CalloutTone = "info" | "success" | "warning" | "insight";
type CheckItem = { state: "done" | "pending" | "blocked"; title: string; body?: string };

const CHECK_MARK: Record<CheckItem["state"], string> = {
  done: "✓",
  pending: "–",
  blocked: "✗",
};

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
  variant,
}: {
  items: Highlight[];
  kicker?: string;
  title?: string;
  variant?: "tinted";
}) {
  if (items.length === 0) {
    return null;
  }

  const tinted = variant === "tinted";

  return (
    <Section kicker={kicker} title={title} id="highlights">
      <div className={`card-grid highlight-grid${tinted ? " highlight-grid--tinted" : ""}`}>
        {items.map((item, index) => (
          <article
            className={`editorial-card highlight-card${tinted ? " highlight-card--tinted" : ""}`}
            key={index}
          >
            {tinted ? (
              <span className="card-chip">{item.label}</span>
            ) : (
              <p className="card-label">{item.label}</p>
            )}
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function FindingRows({
  items,
  kicker = "Findings",
  title = "What we found",
}: {
  items: Highlight[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="findings">
      <div className="finding-rows">
        {items.map((item, index) => (
          <div className="finding-row" key={index}>
            <div className="finding-row__aside">
              <span className="finding-row__numeral" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="finding-row__label">{item.label}</span>
            </div>
            <div className="finding-row__body">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function StatGrid({
  items,
  kicker = "By the numbers",
  title = "Numbers that matter",
}: {
  items: Stat[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="stats">
      <div className="stat-grid">
        {items.map((item, index) => (
          <div className="stat-tile" key={index}>
            <p className="stat-tile__value">{item.value}</p>
            <p className="stat-tile__label">{item.label}</p>
            {item.detail ? <p className="stat-tile__detail">{item.detail}</p> : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Callout({
  tone = "info",
  title,
  body,
}: {
  tone?: CalloutTone;
  title?: string;
  body: string;
}) {
  return (
    <div className="callout" data-tone={tone}>
      {title ? <p className="callout__title">{title}</p> : null}
      <p className="callout__body">{body}</p>
    </div>
  );
}

export function Terminal({ title, children }: { title?: string; children: string }) {
  return (
    <figure className="terminal">
      {title ? <figcaption className="terminal__title">{title}</figcaption> : null}
      <pre className="terminal__pre">{children}</pre>
    </figure>
  );
}

export function Checklist({
  items,
  kicker = "Status",
  title = "Checklist",
}: {
  items: CheckItem[];
  kicker?: string;
  title?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Section kicker={kicker} title={title} id="checklist">
      <ul className="checklist">
        {items.map((item, index) => (
          <li className="checklist__item" data-state={item.state} key={index}>
            <span className="checklist__marker" aria-hidden="true">
              {CHECK_MARK[item.state]}
            </span>
            <div>
              <h3>{item.title}</h3>
              {item.body ? <p>{item.body}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PullQuote({ quote, source }: { quote: string; source?: string }) {
  return (
    <figure className="pull-quote">
      <blockquote>{quote}</blockquote>
      {source ? <figcaption>{source}</figcaption> : null}
    </figure>
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
              <div className="comparison-side comparison-side--before">
                <dt>Before</dt>
                <dd>{item.before}</dd>
                {item.beforeDetail ? (
                  <pre className="wireframe">{item.beforeDetail}</pre>
                ) : null}
              </div>
              <div className="comparison-side comparison-side--after">
                <dt>After</dt>
                <dd>{item.after}</dd>
                {item.afterDetail ? (
                  <pre className="wireframe">{item.afterDetail}</pre>
                ) : null}
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
