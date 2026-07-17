import { IndexPage } from "./index-page";
import { NotFound } from "./not-found";
import { ReportRoute } from "./report-route";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "") {
    return <IndexPage />;
  }
  const match = path.match(/^\/([^/]+)\/([^/]+)$/);
  if (match) {
    return (
      <ReportRoute
        project={decodeURIComponent(match[1])}
        slug={decodeURIComponent(match[2])}
      />
    );
  }
  return <NotFound />;
}
