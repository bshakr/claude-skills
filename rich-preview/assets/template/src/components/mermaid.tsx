import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });

export function Mermaid({ chart, title }: { chart: string; title?: string }) {
  const [svg, setSvg] = useState("");
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let active = true;
    mermaid.render(`mermaid-${id}`, chart.trim()).then(({ svg }) => {
      if (active) {
        setSvg(svg);
      }
    });
    return () => {
      active = false;
    };
  }, [chart, id]);

  return (
    <figure className="mermaid-figure">
      {title ? <figcaption className="mermaid-title">{title}</figcaption> : null}
      <div className="mermaid-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}
