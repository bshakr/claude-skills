import { useId, type ReactNode } from "react";

import {
  type ChartPoint,
  type ChartSpec,
  validateChartSpec,
} from "../../lib/provenance";
import {
  sourceAnchorId,
  type SourceNode,
  type SourceRef,
} from "../../lib/source";

type ChartProps = {
  spec: ChartSpec;
  sourceNodes: SourceNode[];
};

type ChartFrameProps = ChartProps & {
  children: ReactNode;
  domId: string;
  height: number;
  kind: string;
  series: string[];
  width: number;
};

type Point = {
  x: number;
  y: number;
};

type VerticalScale = {
  position: (value: number) => number;
  zero: number;
};

const plotTop = 44;
const plotBottom = 330;
const chartLabelY = 358;
const chartLabelLineHeight = 15;
const chartLabelMaxLength = 18;
const chartLabelMaxLines = 4;

function chartId(kind: string, spec: ChartSpec): string {
  return `${kind}-${spec.id}`;
}

function useChartDomId(kind: string, spec: ChartSpec): string {
  const instanceId = useId().replaceAll(":", "");
  return `${chartId(kind, spec)}-${instanceId}`;
}

function sourceHref(ref: SourceRef): string {
  return `#${sourceAnchorId(ref.nodeId)}`;
}

function pointSeries(point: ChartPoint): string {
  return point.series ?? "Value";
}

function seriesNames(points: ChartPoint[]): string[] {
  return [...new Set(points.map(pointSeries))];
}

function labelNames(points: ChartPoint[]): string[] {
  return [...new Set(points.map(({ label }) => label))];
}

function sourceNodeIds(spec: ChartSpec): string {
  return [...new Set(spec.points.map(({ source }) => source.nodeId))].join(" ");
}

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

function valueLiteral(value: number): string {
  return Object.is(value, -0) ? "-0" : String(value);
}

function verticalScale(
  values: number[],
  top = plotTop,
  bottom = plotBottom,
): VerticalScale {
  let minimum = Math.min(0, ...values);
  let maximum = Math.max(0, ...values);

  if (minimum === maximum) {
    minimum = -1;
    maximum = 1;
  } else {
    minimum = minimum < 0 ? minimum * 1.1 : minimum;
    maximum = maximum > 0 ? maximum * 1.1 : maximum;
  }

  const range = maximum - minimum;
  const position = (value: number) =>
    rounded(bottom - ((value - minimum) / range) * (bottom - top));

  return { position, zero: position(0) };
}

function patternId(domId: string, seriesIndex: number): string {
  return `${domId}-pattern-${seriesIndex}`;
}

function PatternDefinitions({
  domId,
  series,
}: {
  domId: string;
  series: string[];
}) {
  return (
    <defs>
      {series.map((name, index) => {
        const patternSize = 8 + index;
        const midpoint = patternSize / 2;
        return (
          <pattern
            data-pattern-series={name}
            height={patternSize}
            id={patternId(domId, index)}
            key={name}
            patternUnits="userSpaceOnUse"
            width={patternSize}
          >
            <rect
              className={`quant-chart__pattern-base quant-chart__series-fill-${index % 4}`}
              height={patternSize}
              width={patternSize}
            />
            {index % 2 === 0 ? (
              <path
                className="quant-chart__pattern-mark"
                d={[
                  `M -2 ${patternSize} L ${patternSize} -2`,
                  `M 2 ${patternSize + 2} L ${patternSize + 2} 2`,
                ].join(" ")}
              />
            ) : (
              <circle
                className="quant-chart__pattern-mark-fill"
                cx={midpoint}
                cy={midpoint}
                r={1.5 + index / 10}
              />
            )}
          </pattern>
        );
      })}
    </defs>
  );
}

function SourceAttribution({ spec }: { spec: ChartSpec }) {
  const refs = spec.points
    .map(({ source }) => source)
    .filter(
      (ref, index, all) =>
        all.findIndex(({ nodeId }) => nodeId === ref.nodeId) === index,
    );

  return (
    <figcaption className="quant-chart__sources">
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

function DataTable({ spec }: { spec: ChartSpec }) {
  return (
    <div className="quant-chart__table-wrap">
      <table className="quant-chart__table">
        <caption>{spec.title} data</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col">Series</th>
            <th scope="col">Value</th>
            <th scope="col">Unit</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {spec.points.map((point, index) => (
            <tr data-chart-point={index} key={`${point.label}-${pointSeries(point)}-${index}`}>
              <th scope="row">{point.label}</th>
              <td>{pointSeries(point)}</td>
              <td>{valueLiteral(point.value)}</td>
              <td>{point.unit}</td>
              <td>
                <a
                  data-source-node-id={point.source.nodeId}
                  href={sourceHref(point.source)}
                  title={point.source.evidence}
                >
                  {point.source.nodeId}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeriesLegend({
  domId,
  series,
  width,
}: {
  domId: string;
  series: string[];
  width: number;
}) {
  const startX = Math.max(78, width - series.length * 126);

  return (
    <g aria-label="Series legend" className="quant-chart__legend" role="list">
      {series.map((name, index) => (
        <g key={name} role="listitem" transform={`translate(${startX + index * 126} 18)`}>
          <rect
            fill={`url(#${patternId(domId, index)})`}
            height="14"
            width="18"
            x="0"
            y="-11"
          />
          <text x="25" y="0">
            {name}
          </text>
        </g>
      ))}
    </g>
  );
}

function ChartFrame({
  children,
  domId,
  height,
  kind,
  series,
  sourceNodes,
  spec,
  width,
}: ChartFrameProps) {
  if (spec.points.length === 0) {
    return null;
  }

  const validation = validateChartSpec(spec, sourceNodes);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const titleId = `${domId}-title`;
  const descriptionId = `${domId}-description`;

  return (
    <figure
      className={`quant-chart quant-chart--${kind}`}
      data-source-node-ids={sourceNodeIds(spec)}
      data-visual-id={chartId(kind, spec)}
    >
      <div className="quant-chart__heading">
        <h3>{spec.title}</h3>
        <p>{spec.explanation}</p>
      </div>
      <div className="quant-chart__canvas">
        <svg
          aria-labelledby={`${titleId} ${descriptionId}`}
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <title id={titleId}>{spec.title}</title>
          <desc id={descriptionId}>{spec.explanation}</desc>
          <PatternDefinitions domId={domId} series={series} />
          <SeriesLegend domId={domId} series={series} width={width} />
          {children}
        </svg>
      </div>
      <DataTable spec={spec} />
      <SourceAttribution spec={spec} />
    </figure>
  );
}

function labelLines(label: string): string[] {
  const segments = label
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      const characters = Array.from(word);
      return Array.from(
        { length: Math.ceil(characters.length / chartLabelMaxLength) },
        (_, index) =>
          characters
            .slice(
              index * chartLabelMaxLength,
              (index + 1) * chartLabelMaxLength,
            )
            .join(""),
      );
    });
  const lines: string[] = [];

  for (const segment of segments) {
    const lastLine = lines.at(-1);
    if (
      !lastLine ||
      `${lastLine} ${segment}`.length > chartLabelMaxLength
    ) {
      lines.push(segment);
    } else {
      lines[lines.length - 1] = `${lastLine} ${segment}`;
    }
  }

  if (lines.length <= chartLabelMaxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, chartLabelMaxLines);
  const finalLine = visibleLines[chartLabelMaxLines - 1];
  visibleLines[chartLabelMaxLines - 1] =
    `${finalLine.slice(0, chartLabelMaxLength - 1)}…`;
  return visibleLines;
}

function chartHeight(labels: string[], includeSeriesLabels = false): number {
  const lineCount = Math.max(...labels.map((label) => labelLines(label).length));
  const lastLineY = chartLabelY + (lineCount - 1) * chartLabelLineHeight;
  return Math.max(430, lastLineY + (includeSeriesLabels ? 50 : 32));
}

function seriesLabelY(label: string): number {
  return (
    chartLabelY +
    (labelLines(label).length - 1) * chartLabelLineHeight +
    20
  );
}

function SvgLabel({
  className = "quant-chart__label",
  label,
  x,
  y,
}: Point & { className?: string; label: string }) {
  const lines = labelLines(label);

  return (
    <text
      aria-label={label}
      className={className}
      data-chart-label={label}
      data-label-lines={lines.length}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {lines.map((line, index) => (
        <tspan
          dy={index === 0 ? 0 : chartLabelLineHeight}
          key={`${line}-${index}`}
          x={x}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function pointAriaLabel(point: ChartPoint): string {
  const value = `${valueLiteral(point.value)} ${point.unit}`;
  return `${pointSeries(point)}, ${point.label}: ${value}; derived from ${point.source.nodeId}`;
}

function ZeroBaseline({ scale, width }: { scale: VerticalScale; width: number }) {
  return (
    <line
      className="quant-chart__baseline"
      data-zero-baseline="true"
      x1="64"
      x2={width - 36}
      y1={scale.zero}
      y2={scale.zero}
    />
  );
}

export function BarChart({ spec, sourceNodes }: ChartProps) {
  const kind = "bar-chart";
  const domId = useChartDomId(kind, spec);
  if (spec.points.length === 0) {
    return null;
  }

  const width = Math.max(760, spec.points.length * 126 + 110);
  const height = chartHeight(
    spec.points.map(({ label }) => label),
    true,
  );
  const series = seriesNames(spec.points);
  const scale = verticalScale(spec.points.map(({ value }) => value));
  const plotWidth = width - 110;
  const slotWidth = plotWidth / spec.points.length;
  const barWidth = Math.min(66, slotWidth * 0.58);

  return (
    <ChartFrame
      domId={domId}
      height={height}
      kind={kind}
      series={series}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <ZeroBaseline scale={scale} width={width} />
      {spec.points.map((point, index) => {
        const x = rounded(72 + index * slotWidth + (slotWidth - barWidth) / 2);
        const valueY = scale.position(point.value);
        const y = Math.min(valueY, scale.zero);
        const barHeight = rounded(Math.abs(valueY - scale.zero));
        const centerX = rounded(x + barWidth / 2);
        const seriesIndex = series.indexOf(pointSeries(point));
        const valueLabelY =
          point.value < 0 ? rounded(y + barHeight + 18) : rounded(y - 8);

        return (
          <a
            aria-label={pointAriaLabel(point)}
            data-source-node-id={point.source.nodeId}
            href={sourceHref(point.source)}
            key={`${point.label}-${pointSeries(point)}-${index}`}
          >
            <rect
              className="quant-chart__bar"
              data-chart-point={index}
              data-value={valueLiteral(point.value)}
              fill={`url(#${patternId(domId, seriesIndex)})`}
              height={barHeight}
              width={rounded(barWidth)}
              x={x}
              y={y}
            />
            <text
              className="quant-chart__value"
              textAnchor="middle"
              x={centerX}
              y={valueLabelY}
            >
              {valueLiteral(point.value)} {point.unit}
            </text>
            <SvgLabel label={point.label} x={centerX} y={chartLabelY} />
            <text
              className="quant-chart__series-label"
              data-series-label-for={index}
              textAnchor="middle"
              x={centerX}
              y={seriesLabelY(point.label)}
            >
              {pointSeries(point)}
            </text>
          </a>
        );
      })}
    </ChartFrame>
  );
}

export function LineChart({ spec, sourceNodes }: ChartProps) {
  const kind = "line-chart";
  const domId = useChartDomId(kind, spec);
  if (spec.points.length === 0) {
    return null;
  }

  const labels = labelNames(spec.points);
  const series = seriesNames(spec.points);
  const width = Math.max(760, labels.length * 210 + 120);
  const height = chartHeight(labels);
  const scale = verticalScale(spec.points.map(({ value }) => value));
  const labelX = (label: string) => {
    const index = labels.indexOf(label);
    if (labels.length === 1) {
      return width / 2;
    }
    return rounded(82 + (index * (width - 164)) / (labels.length - 1));
  };

  return (
    <ChartFrame
      domId={domId}
      height={height}
      kind={kind}
      series={series}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <ZeroBaseline scale={scale} width={width} />
      {series.map((name, seriesIndex) => {
        const points = spec.points.filter((point) => pointSeries(point) === name);
        return (
          <polyline
            className={`quant-chart__line quant-chart__series-stroke-${seriesIndex % 4}`}
            data-series={name}
            key={name}
            points={points
              .map((point) => `${labelX(point.label)},${scale.position(point.value)}`)
              .join(" ")}
            strokeDasharray={`${seriesIndex + 3} ${seriesIndex + 2}`}
          />
        );
      })}
      {spec.points.map((point, index) => {
        const x = labelX(point.label);
        const y = scale.position(point.value);
        const seriesIndex = series.indexOf(pointSeries(point));
        return (
          <a
            aria-label={pointAriaLabel(point)}
            data-source-node-id={point.source.nodeId}
            href={sourceHref(point.source)}
            key={`${point.label}-${pointSeries(point)}-${index}`}
          >
            <circle
              className="quant-chart__line-point"
              cx={x}
              cy={y}
              data-chart-point={index}
              data-line-point="true"
              data-value={valueLiteral(point.value)}
              fill={`url(#${patternId(domId, seriesIndex)})`}
              r="7"
            />
            <text
              className="quant-chart__value"
              textAnchor="middle"
              x={x}
              y={rounded(y - 12 - seriesIndex * 15)}
            >
              {valueLiteral(point.value)} {point.unit}
            </text>
            <text
              className="quant-chart__series-label"
              data-series-label-for={index}
              textAnchor="middle"
              x={x}
              y={rounded(y + 18 + seriesIndex * 3)}
            >
              {pointSeries(point)}
            </text>
          </a>
        );
      })}
      {labels.map((label) => (
        <SvgLabel
          key={label}
          label={label}
          x={labelX(label)}
          y={chartLabelY}
        />
      ))}
    </ChartFrame>
  );
}

export function StackedBar({ spec, sourceNodes }: ChartProps) {
  const kind = "stacked-bar";
  const domId = useChartDomId(kind, spec);
  if (spec.points.length === 0) {
    return null;
  }

  const labels = labelNames(spec.points);
  const series = seriesNames(spec.points);
  const totals = labels.flatMap((label) => {
    const points = spec.points.filter((point) => point.label === label);
    return [
      points.filter(({ value }) => value >= 0).reduce((sum, { value }) => sum + value, 0),
      points.filter(({ value }) => value < 0).reduce((sum, { value }) => sum + value, 0),
    ];
  });
  const scale = verticalScale(totals);
  const width = Math.max(760, labels.length * 210 + 120);
  const height = chartHeight(labels);
  const slotWidth = (width - 120) / labels.length;
  const barWidth = Math.min(84, slotWidth * 0.48);

  return (
    <ChartFrame
      domId={domId}
      height={height}
      kind={kind}
      series={series}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <ZeroBaseline scale={scale} width={width} />
      {labels.flatMap((label, labelIndex) => {
        let positiveTotal = 0;
        let negativeTotal = 0;
        const x = rounded(70 + labelIndex * slotWidth + (slotWidth - barWidth) / 2);
        const centerX = rounded(x + barWidth / 2);
        const points = spec.points.filter((point) => point.label === label);

        return [
          ...points.map((point) => {
            const direction = point.value < 0 ? "negative" : "positive";
            const start = point.value < 0 ? negativeTotal : positiveTotal;
            const end = start + point.value;
            if (point.value < 0) {
              negativeTotal = end;
            } else {
              positiveTotal = end;
            }
            const startY = scale.position(start);
            const endY = scale.position(end);
            const y = Math.min(startY, endY);
            const segmentHeight = rounded(Math.abs(endY - startY));
            const pointIndex = spec.points.indexOf(point);
            const seriesIndex = series.indexOf(pointSeries(point));

            return (
              <a
                aria-label={pointAriaLabel(point)}
                data-source-node-id={point.source.nodeId}
                href={sourceHref(point.source)}
                key={`${label}-${pointSeries(point)}-${pointIndex}`}
              >
                <rect
                  className="quant-chart__bar quant-chart__stack-segment"
                  data-chart-point={pointIndex}
                  data-stack-direction={direction}
                  data-stack-segment="true"
                  data-value={valueLiteral(point.value)}
                  fill={`url(#${patternId(domId, seriesIndex)})`}
                  height={segmentHeight}
                  width={rounded(barWidth)}
                  x={x}
                  y={y}
                />
                <text
                  className="quant-chart__value quant-chart__value--stacked"
                  textAnchor="middle"
                  x={centerX}
                  y={rounded(y + segmentHeight / 2 + 4)}
                >
                  {valueLiteral(point.value)} {point.unit}
                </text>
                <text
                  className="quant-chart__series-label"
                  data-series-label-for={pointIndex}
                  textAnchor="start"
                  x={rounded(centerX + barWidth / 2 + 8)}
                  y={rounded(y + segmentHeight / 2 + 4)}
                >
                  {pointSeries(point)}
                </text>
              </a>
            );
          }),
          <SvgLabel
            key={`${label}-label`}
            label={label}
            x={centerX}
            y={chartLabelY}
          />,
        ];
      })}
    </ChartFrame>
  );
}

export function ComparisonChart({ spec, sourceNodes }: ChartProps) {
  const kind = "comparison-chart";
  const domId = useChartDomId(kind, spec);
  if (spec.points.length === 0) {
    return null;
  }

  const labels = labelNames(spec.points);
  const series = seriesNames(spec.points);
  const width = Math.max(760, labels.length * 230 + 120);
  const height = chartHeight(labels);
  const scale = verticalScale(spec.points.map(({ value }) => value));
  const groupWidth = (width - 120) / labels.length;
  const availableBarWidth = groupWidth * 0.72;
  const barWidth = Math.min(56, availableBarWidth / series.length);

  return (
    <ChartFrame
      domId={domId}
      height={height}
      kind={kind}
      series={series}
      sourceNodes={sourceNodes}
      spec={spec}
      width={width}
    >
      <ZeroBaseline scale={scale} width={width} />
      {spec.points.map((point, index) => {
        const labelIndex = labels.indexOf(point.label);
        const seriesIndex = series.indexOf(pointSeries(point));
        const groupStart = 70 + labelIndex * groupWidth;
        const barsWidth = barWidth * series.length;
        const x = rounded(
          groupStart + (groupWidth - barsWidth) / 2 + seriesIndex * barWidth,
        );
        const valueY = scale.position(point.value);
        const y = Math.min(valueY, scale.zero);
        const barHeight = rounded(Math.abs(valueY - scale.zero));
        const centerX = rounded(x + barWidth / 2);
        const valueLabelY =
          point.value < 0 ? rounded(y + barHeight + 18) : rounded(y - 8);

        return (
          <a
            aria-label={pointAriaLabel(point)}
            data-source-node-id={point.source.nodeId}
            href={sourceHref(point.source)}
            key={`${point.label}-${pointSeries(point)}-${index}`}
          >
            <rect
              className="quant-chart__bar quant-chart__comparison-bar"
              data-chart-point={index}
              data-value={valueLiteral(point.value)}
              fill={`url(#${patternId(domId, seriesIndex)})`}
              height={barHeight}
              width={rounded(barWidth)}
              x={x}
              y={y}
            />
            <text
              className="quant-chart__value"
              textAnchor="middle"
              x={centerX}
              y={valueLabelY}
            >
              {valueLiteral(point.value)} {point.unit}
            </text>
            <text
              className="quant-chart__series-label"
              data-series-label-for={index}
              textAnchor="middle"
              x={centerX}
              y={rounded(valueLabelY - 15)}
            >
              {pointSeries(point)}
            </text>
          </a>
        );
      })}
      {labels.map((label, index) => (
        <SvgLabel
          key={label}
          label={label}
          x={rounded(70 + index * groupWidth + groupWidth / 2)}
          y={chartLabelY}
        />
      ))}
    </ChartFrame>
  );
}
