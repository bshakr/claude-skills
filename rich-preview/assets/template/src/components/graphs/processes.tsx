import type { ReactNode } from "react";

import {
  type ProcessEdgeSpec,
  type ProcessNodeSpec,
  type ProcessSpec,
  validateProcessSpec,
} from "../../lib/provenance";
import type { SourceNode, SourceRef } from "../../lib/source";

type ProcessGraphProps = {
  spec: ProcessSpec;
  sourceNodes: SourceNode[];
};

type Point = {
  x: number;
  y: number;
};

type GraphFrameProps = ProcessGraphProps & {
  children: ReactNode;
  height: number;
  kind: string;
  width: number;
};

const nodeWidth = 144;
const nodeHeight = 72;

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function graphId(kind: string, spec: ProcessSpec): string {
  return `${kind}-${safeId(spec.id)}`;
}

function markerId(kind: string, spec: ProcessSpec): string {
  return `${graphId(kind, spec)}-arrow`;
}

function sourceHref(ref: SourceRef): string {
  return `#source-${ref.nodeId}`;
}

function sourceNodeIds(spec: ProcessSpec): string {
  const refs = [
    ...spec.nodes.map(({ source }) => source),
    ...spec.edges.map(({ source }) => source),
  ];
  return [...new Set(refs.map(({ nodeId }) => nodeId))].join(" ");
}

function SourceAttribution({ spec }: { spec: ProcessSpec }) {
  const refs = [
    ...spec.nodes.map(({ source }) => source),
    ...spec.edges.map(({ source }) => source),
  ].filter(
    (ref, index, all) =>
      all.findIndex(({ nodeId }) => nodeId === ref.nodeId) === index,
  );

  return (
    <figcaption className="process-graph__sources">
      <span>Derived from </span>
      {refs.map((ref, index) => (
        <span key={ref.nodeId}>
          {index > 0 ? ", " : null}
          <a
            data-source-node-id={ref.nodeId}
            href={sourceHref(ref)}
            title={ref.evidence}
          >
            {ref.nodeId}
          </a>
        </span>
      ))}
    </figcaption>
  );
}

function GraphFrame({
  children,
  height,
  kind,
  sourceNodes,
  spec,
  width,
}: GraphFrameProps) {
  const validation = validateProcessSpec(spec, sourceNodes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const visualId = graphId(kind, spec);
  const titleId = `${visualId}-title`;
  const descriptionId = `${visualId}-description`;

  return (
    <figure
      className={`process-graph process-graph--${kind}`}
      data-source-node-ids={sourceNodeIds(spec)}
      data-visual-id={visualId}
    >
      <div className="process-graph__heading">
        <h3>{spec.title}</h3>
        <p>{spec.explanation}</p>
      </div>
      <div className="process-graph__canvas">
        <svg
          aria-labelledby={`${titleId} ${descriptionId}`}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <title id={titleId}>{spec.title}</title>
          <desc id={descriptionId}>{spec.explanation}</desc>
          <defs>
            <marker
              id={markerId(kind, spec)}
              markerHeight="8"
              markerUnits="strokeWidth"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path className="process-graph__arrowhead" d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          {children}
        </svg>
      </div>
      <SourceAttribution spec={spec} />
    </figure>
  );
}

function labelLines(label: string, maxLength = 18): string[] {
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];

  for (const word of words) {
    const lastLine = lines.at(-1);
    if (!lastLine || `${lastLine} ${word}`.length > maxLength) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${lastLine} ${word}`;
    }
  }
  return lines;
}

function SvgLabel({
  className = "process-graph__node-label",
  label,
  x,
  y,
}: Point & { className?: string; label: string }) {
  const lines = labelLines(label);
  const firstLineY = y - ((lines.length - 1) * 16) / 2;

  return (
    <text className={className} textAnchor="middle" x={x} y={firstLineY}>
      {lines.map((line, index) => (
        <tspan dy={index === 0 ? 0 : 16} key={`${line}-${index}`} x={x}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function trimmedLine(from: Point, to: Point, padding: number): [Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const unitX = dx / distance;
  const unitY = dy / distance;

  return [
    { x: from.x + unitX * padding, y: from.y + unitY * padding },
    { x: to.x - unitX * padding, y: to.y - unitY * padding },
  ];
}

function SourceLinkedEdge({
  edge,
  from,
  marker,
  padding,
  to,
}: {
  edge: ProcessEdgeSpec;
  from: Point;
  marker: string;
  padding: number;
  to: Point;
}) {
  const [start, end] = trimmedLine(from, to, padding);

  return (
    <a
      aria-label={`Derived from ${edge.source.nodeId}: ${edge.from} to ${edge.to}`}
      data-source-node-id={edge.source.nodeId}
      href={sourceHref(edge.source)}
    >
      <line
        className="process-graph__edge"
        data-edge-shape="arrow"
        markerEnd={`url(#${marker})`}
        x1={start.x}
        x2={end.x}
        y1={start.y}
        y2={end.y}
      />
      {edge.label ? (
        <SvgLabel
          className="process-graph__edge-label"
          label={edge.label}
          x={(start.x + end.x) / 2}
          y={(start.y + end.y) / 2 - 10}
        />
      ) : null}
    </a>
  );
}

function RectNode({
  node,
  point,
  shape = "rounded-rectangle",
}: {
  node: ProcessNodeSpec;
  point: Point;
  shape?: string;
}) {
  return (
    <a
      aria-label={`Derived from ${node.source.nodeId}: ${node.label}`}
      data-source-node-id={node.source.nodeId}
      href={sourceHref(node.source)}
    >
      <rect
        className="process-graph__node"
        data-node-shape={shape}
        height={nodeHeight}
        rx="14"
        width={nodeWidth}
        x={point.x - nodeWidth / 2}
        y={point.y - nodeHeight / 2}
      />
      <SvgLabel label={node.label} x={point.x} y={point.y} />
    </a>
  );
}

export function ProcessFlow({ spec, sourceNodes }: ProcessGraphProps) {
  const kind = "process-flow";
  const width = Math.max(720, spec.nodes.length * 184 + 80);
  const height = 250;
  const points = new Map(
    spec.nodes.map((node, index) => [
      node.id,
      { x: 112 + index * 184, y: 125 },
    ]),
  );
  const arrow = markerId(kind, spec);

  return (
    <GraphFrame
      height={height}
      kind={kind}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <g className="process-graph__edges">
        {spec.edges.map((edge, index) => (
          <SourceLinkedEdge
            edge={edge}
            from={points.get(edge.from) ?? { x: 0, y: 0 }}
            key={`${edge.from}-${edge.to}-${index}`}
            marker={arrow}
            padding={82}
            to={points.get(edge.to) ?? { x: 0, y: 0 }}
          />
        ))}
      </g>
      <g className="process-graph__nodes">
        {spec.nodes.map((node) => (
          <RectNode
            key={node.id}
            node={node}
            point={points.get(node.id) ?? { x: 0, y: 0 }}
          />
        ))}
      </g>
    </GraphFrame>
  );
}

export function BranchFlow({ spec, sourceNodes }: ProcessGraphProps) {
  const kind = "branch-flow";
  const branchCount = Math.max(1, spec.nodes.length - 1);
  const width = Math.max(720, branchCount * 190 + 120);
  const height = 350;
  const branchSpacing = branchCount === 1 ? 0 : (width - 200) / (branchCount - 1);
  const points = new Map<string, Point>();

  spec.nodes.forEach((node, index) => {
    points.set(
      node.id,
      index === 0
        ? { x: width / 2, y: 90 }
        : {
            x: branchCount === 1 ? width / 2 : 100 + (index - 1) * branchSpacing,
            y: 255,
          },
    );
  });
  const arrow = markerId(kind, spec);
  const decision = spec.nodes[0];

  return (
    <GraphFrame
      height={height}
      kind={kind}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <g className="process-graph__edges process-graph__edges--branch">
        {spec.edges.map((edge, index) => (
          <SourceLinkedEdge
            edge={edge}
            from={points.get(edge.from) ?? { x: 0, y: 0 }}
            key={`${edge.from}-${edge.to}-${index}`}
            marker={arrow}
            padding={62}
            to={points.get(edge.to) ?? { x: 0, y: 0 }}
          />
        ))}
      </g>
      {decision ? (
        <a
          aria-label={`Derived from ${decision.source.nodeId}: ${decision.label}`}
          data-source-node-id={decision.source.nodeId}
          href={sourceHref(decision.source)}
        >
          <polygon
            className="process-graph__node process-graph__node--decision"
            data-node-shape="diamond"
            points={`${width / 2},30 ${width / 2 + 96},90 ${width / 2},150 ${width / 2 - 96},90`}
          />
          <SvgLabel label={decision.label} x={width / 2} y={90} />
        </a>
      ) : null}
      {spec.nodes.slice(1).map((node) => (
        <RectNode
          key={node.id}
          node={node}
          point={points.get(node.id) ?? { x: 0, y: 0 }}
          shape="branch-outcome"
        />
      ))}
    </GraphFrame>
  );
}

export function SequenceFlow({ spec, sourceNodes }: ProcessGraphProps) {
  const kind = "sequence-flow";
  const width = Math.max(720, spec.nodes.length * 190 + 80);
  const height = Math.max(320, 180 + spec.edges.length * 62);
  const points = new Map(
    spec.nodes.map((node, index) => [
      node.id,
      { x: 110 + index * 190, y: 68 },
    ]),
  );
  const arrow = markerId(kind, spec);

  return (
    <GraphFrame
      height={height}
      kind={kind}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <g className="process-graph__participants">
        {spec.nodes.map((node) => {
          const point = points.get(node.id) ?? { x: 0, y: 0 };
          return (
            <a
              aria-label={`Derived from ${node.source.nodeId}: ${node.label}`}
              data-source-node-id={node.source.nodeId}
              href={sourceHref(node.source)}
              key={node.id}
            >
              <line
                className="process-graph__lifeline"
                x1={point.x}
                x2={point.x}
                y1={104}
                y2={height - 36}
              />
              <rect
                className="process-graph__node process-graph__node--participant"
                data-node-shape="participant"
                height={nodeHeight}
                rx="8"
                width={nodeWidth}
                x={point.x - nodeWidth / 2}
                y={point.y - nodeHeight / 2}
              />
              <SvgLabel label={node.label} x={point.x} y={point.y} />
            </a>
          );
        })}
      </g>
      <g className="process-graph__messages">
        {spec.edges.map((edge, index) => {
          const from = points.get(edge.from) ?? { x: 0, y: 0 };
          const to = points.get(edge.to) ?? { x: 0, y: 0 };
          const y = 150 + index * 62;

          return (
            <a
              aria-label={`Derived from ${edge.source.nodeId}: ${edge.from} to ${edge.to}`}
              data-source-node-id={edge.source.nodeId}
              href={sourceHref(edge.source)}
              key={`${edge.from}-${edge.to}-${index}`}
            >
              {from.x === to.x ? (
                <path
                  className="process-graph__edge"
                  d={`M ${from.x} ${y} C ${from.x + 90} ${y}, ${from.x + 90} ${y + 38}, ${from.x} ${y + 38}`}
                  data-edge-shape="message-loop"
                  fill="none"
                  markerEnd={`url(#${arrow})`}
                />
              ) : (
                <line
                  className="process-graph__edge"
                  data-edge-shape="message"
                  markerEnd={`url(#${arrow})`}
                  x1={from.x}
                  x2={to.x}
                  y1={y}
                  y2={y}
                />
              )}
              {edge.label ? (
                <SvgLabel
                  className="process-graph__edge-label"
                  label={edge.label}
                  x={(from.x + to.x) / 2}
                  y={y - 12}
                />
              ) : null}
            </a>
          );
        })}
      </g>
    </GraphFrame>
  );
}

export function DependencyMap({ spec, sourceNodes }: ProcessGraphProps) {
  const kind = "dependency-map";
  const width = 760;
  const columns = Math.min(3, Math.max(1, spec.nodes.length));
  const rows = Math.ceil(spec.nodes.length / columns);
  const height = Math.max(300, rows * 150 + 80);
  const columnSpacing = width / columns;
  const points = new Map(
    spec.nodes.map((node, index) => [
      node.id,
      {
        x: columnSpacing * (index % columns + 0.5),
        y: 95 + Math.floor(index / columns) * 150,
      },
    ]),
  );
  const arrow = markerId(kind, spec);

  return (
    <GraphFrame
      height={height}
      kind={kind}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <g className="process-graph__edges process-graph__edges--dependency">
        {spec.edges.map((edge, index) => (
          <SourceLinkedEdge
            edge={edge}
            from={points.get(edge.from) ?? { x: 0, y: 0 }}
            key={`${edge.from}-${edge.to}-${index}`}
            marker={arrow}
            padding={84}
            to={points.get(edge.to) ?? { x: 0, y: 0 }}
          />
        ))}
      </g>
      <g className="process-graph__nodes process-graph__nodes--dependency">
        {spec.nodes.map((node) => {
          const point = points.get(node.id) ?? { x: 0, y: 0 };
          return (
            <a
              aria-label={`Derived from ${node.source.nodeId}: ${node.label}`}
              data-source-node-id={node.source.nodeId}
              href={sourceHref(node.source)}
              key={node.id}
            >
              <polygon
                className="process-graph__node process-graph__node--dependency"
                data-node-shape="hexagon"
                points={`${point.x - 82},${point.y} ${point.x - 60},${point.y - 42} ${point.x + 60},${point.y - 42} ${point.x + 82},${point.y} ${point.x + 60},${point.y + 42} ${point.x - 60},${point.y + 42}`}
              />
              <SvgLabel label={node.label} x={point.x} y={point.y} />
            </a>
          );
        })}
      </g>
    </GraphFrame>
  );
}
