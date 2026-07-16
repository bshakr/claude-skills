import { allReports } from "./content";

export function IndexPage() {
  const reports = allReports();
  const projects = [...new Set(reports.map((report) => report.project))].sort();

  return (
    <div className="preview-shell hub-index">
      <header className="hub-header">
        <p className="eyebrow">Rich Preview</p>
        <h1>Reports</h1>
        <p className="lede">Every report you've generated, grouped by project.</p>
      </header>

      {reports.length === 0 ? (
        <p className="hub-empty">
          No reports yet. Generate one with <code>add_report.py</code>.
        </p>
      ) : (
        projects.map((project) => {
          const items = reports
            .filter((report) => report.project === project)
            .sort((a, b) => b.date.localeCompare(a.date));
          return (
            <section className="hub-project" key={project}>
              <div className="section-heading">
                <p className="section-kicker">Project</p>
                <h2>{project}</h2>
              </div>
              <div className="card-grid">
                {items.map((report) => (
                  <a
                    className="editorial-card hub-card"
                    href={`/${report.project}/${report.slug}`}
                    key={report.slug}
                  >
                    <p className="hub-card__date">{report.date}</p>
                    <h3>{report.title}</h3>
                    <p className="hub-card__path">{report.source_path}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
