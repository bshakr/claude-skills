import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import source from "./content/source.md?raw";
import Report from "./report.mdx";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing preview root");
}

createRoot(root).render(
  <StrictMode>
    <Report source={source} />
  </StrictMode>,
);
