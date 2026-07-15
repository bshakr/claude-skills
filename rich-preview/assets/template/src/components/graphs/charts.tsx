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

type LabelLine = {
  text: string;
  width: number;
};

type VerticalScale = {
  position: (value: number) => number;
  zero: number;
};

type VerticalLayout = {
  extraHeight: number;
  labelY: number;
  plotBottom: number;
  plotTop: number;
};

const plotTop = 44;
const plotBottom = 330;
const chartLabelY = 358;
const chartLabelLineHeight = 15;
const chartLabelMaxLines = 4;
const legendColumnWidth = 126;
const legendRowHeight = 24;
const legendMaxColumns = 4;

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

function legendColumns(width: number): number {
  return Math.max(
    1,
    Math.min(legendMaxColumns, Math.floor((width - 64) / legendColumnWidth)),
  );
}

function legendRows(series: string[], width: number): number {
  return Math.ceil(series.length / legendColumns(width));
}

function verticalLayout(series: string[], width: number): VerticalLayout {
  const extraHeight = (legendRows(series, width) - 1) * legendRowHeight;
  return {
    extraHeight,
    labelY: chartLabelY + extraHeight,
    plotBottom: plotBottom + extraHeight,
    plotTop: plotTop + extraHeight,
  };
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
  const columnCount = legendColumns(width);
  const rowCount = legendRows(series, width);

  return (
    <g
      aria-label="Series legend"
      className="quant-chart__legend"
      data-legend-rows={rowCount}
      role="list"
    >
      {series.map((name, index) => {
        const row = Math.floor(index / columnCount);
        const column = index % columnCount;
        const rowLength = Math.min(
          columnCount,
          series.length - row * columnCount,
        );
        const startX = (width - rowLength * legendColumnWidth) / 2;
        const x = startX + column * legendColumnWidth;
        const y = 18 + row * legendRowHeight;
        return (
          <g
            data-legend-column={column}
            data-legend-row={row}
            key={name}
            role="listitem"
            transform={`translate(${x} ${y})`}
          >
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
        );
      })}
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

function estimatedGlyphWidth(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0;
  if (/\s/.test(character)) {
    return 4;
  }
  if (codePoint > 0xff) {
    return 13;
  }
  if (/[WM@%&QO]/.test(character)) {
    return 10;
  }
  if (/[ilI1.,:;!'|]/.test(character)) {
    return 4;
  }
  if (/[A-Z0-9]/.test(character)) {
    return 8;
  }
  return 7;
}

function estimatedTextWidth(value: string): number {
  return Array.from(value).reduce(
    (width, character) => width + estimatedGlyphWidth(character),
    0,
  );
}

function preferredLabelSlotWidth(labels: string[], minimum: number): number {
  const widestLabel = Math.max(...labels.map(estimatedTextWidth));
  return Math.min(
    360,
    Math.max(minimum, Math.ceil(widestLabel / chartLabelMaxLines) + 24),
  );
}

function splitLabelWord(word: string, availableWidth: number): LabelLine[] {
  const chunks: LabelLine[] = [];
  let text = "";
  let width = 0;

  for (const character of Array.from(word)) {
    const characterWidth = estimatedGlyphWidth(character);
    if (text && width + characterWidth > availableWidth) {
      chunks.push({ text, width });
      text = character;
      width = characterWidth;
    } else {
      text += character;
      width += characterWidth;
    }
  }
  if (text) {
    chunks.push({ text, width });
  }
  return chunks;
}

function labelLines(label: string, availableWidth: number): LabelLine[] {
  const lines: LabelLine[] = [];

  for (const word of label.trim().split(/\s+/)) {
    const wordWidth = estimatedTextWidth(word);
    const lastLine = lines.at(-1);
    const combinedText = lastLine ? `${lastLine.text} ${word}` : word;
    const combinedWidth = estimatedTextWidth(combinedText);

    if (wordWidth > availableWidth) {
      lines.push(...splitLabelWord(word, availableWidth));
    } else if (lastLine && combinedWidth <= availableWidth) {
      lines[lines.length - 1] = {
        text: combinedText,
        width: combinedWidth,
      };
    } else {
      lines.push({ text: word, width: wordWidth });
    }
  }

  if (lines.length <= chartLabelMaxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, chartLabelMaxLines);
  const finalLine = visibleLines[chartLabelMaxLines - 1];
  const finalCharacters = Array.from(finalLine.text);
  while (
    finalCharacters.length > 0 &&
    estimatedTextWidth(`${finalCharacters.join("")}…`) > availableWidth
  ) {
    finalCharacters.pop();
  }
  const finalText = `${finalCharacters.join("")}…`;
  visibleLines[chartLabelMaxLines - 1] = {
    text: finalText,
    width: estimatedTextWidth(finalText),
  };
  return visibleLines;
}

function chartHeight(
  labels: string[],
  availableLabelWidth: number,
  layout: VerticalLayout,
  includeSeriesLabels = false,
): number {
  const lineCount = Math.max(
    ...labels.map(
      (label) => labelLines(label, availableLabelWidth).length,
    ),
  );
  const lastLineY =
    layout.labelY + (lineCount - 1) * chartLabelLineHeight;
  return Math.max(
    430 + layout.extraHeight,
    lastLineY + (includeSeriesLabels ? 50 : 32),
  );
}

function seriesLabelY(
  label: string,
  availableLabelWidth: number,
  labelY: number,
): number {
  return (
    labelY +
    (labelLines(label, availableLabelWidth).length - 1) *
      chartLabelLineHeight +
    20
  );
}

function SvgLabel({
  availableWidth,
  className = "quant-chart__label",
  label,
  x,
  y,
}: Point & { availableWidth: number; className?: string; label: string }) {
  const lines = labelLines(label, availableWidth);
  const estimatedWidth = Math.max(...lines.map(({ width }) => width));

  return (
    <text
      aria-label={label}
      className={className}
      data-chart-label={label}
      data-label-available-width={rounded(availableWidth)}
      data-label-estimated-width={rounded(estimatedWidth)}
      data-label-left={rounded(x - estimatedWidth / 2)}
      data-label-lines={lines.length}
      data-label-right={rounded(x + estimatedWidth / 2)}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {lines.map((line, index) => (
        <tspan
          data-estimated-width={rounded(line.width)}
          dy={index === 0 ? 0 : chartLabelLineHeight}
          key={`${line.text}-${index}`}
          x={x}
        >
          {line.text}
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

  const labels = spec.points.map(({ label }) => label);
  const labelSlotWidth = preferredLabelSlotWidth(labels, 126);
  const availableLabelWidth = labelSlotWidth - 20;
  const width = Math.max(760, spec.points.length * labelSlotWidth + 110);
  const series = seriesNames(spec.points);
  const layout = verticalLayout(series, width);
  const height = chartHeight(labels, availableLabelWidth, layout, true);
  const scale = verticalScale(
    spec.points.map(({ value }) => value),
    layout.plotTop,
    layout.plotBottom,
  );
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
            <SvgLabel
              availableWidth={availableLabelWidth}
              label={point.label}
              x={centerX}
              y={layout.labelY}
            />
            <text
              className="quant-chart__series-label"
              data-series-label-for={index}
              textAnchor="middle"
              x={centerX}
              y={seriesLabelY(
                point.label,
                availableLabelWidth,
                layout.labelY,
              )}
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
  const labelSlotWidth = preferredLabelSlotWidth(labels, 210);
  const availableLabelWidth = labelSlotWidth - 20;
  const width = Math.max(760, labels.length * labelSlotWidth + 120);
  const layout = verticalLayout(series, width);
  const height = chartHeight(labels, availableLabelWidth, layout);
  const scale = verticalScale(
    spec.points.map(({ value }) => value),
    layout.plotTop,
    layout.plotBottom,
  );
  const categorySlotWidth = (width - 120) / labels.length;
  const labelX = (label: string) => {
    const index = labels.indexOf(label);
    return rounded(60 + (index + 0.5) * categorySlotWidth);
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
        const baseX = labelX(point.label);
        const baseY = scale.position(point.value);
        const seriesIndex = series.indexOf(pointSeries(point));
        const peers = spec.points.filter(
          (candidate) =>
            candidate.label === point.label &&
            Object.is(candidate.value, point.value),
        );
        const peerIndex = peers.indexOf(point);
        const centeredIndex = peerIndex - (peers.length - 1) / 2;
        const markerX = rounded(baseX + centeredIndex * 14);
        const labelXPosition = rounded(baseX + centeredIndex * 64);
        const labelY = rounded(
          baseY <= (layout.plotTop + layout.plotBottom) / 2
            ? baseY + 38
            : baseY - 28,
        );
        return (
          <a
            aria-label={pointAriaLabel(point)}
            data-source-node-id={point.source.nodeId}
            href={sourceHref(point.source)}
            key={`${point.label}-${pointSeries(point)}-${index}`}
          >
            <line
              className="quant-chart__leader"
              data-series-leader-for={index}
              x1={markerX}
              x2={labelXPosition}
              y1={baseY}
              y2={rounded(labelY - 4)}
            />
            <circle
              className="quant-chart__line-point"
              cx={markerX}
              cy={baseY}
              data-chart-point={index}
              data-line-point="true"
              data-value={valueLiteral(point.value)}
              fill={`url(#${patternId(domId, seriesIndex)})`}
              r="7"
            />
            <text
              className="quant-chart__value"
              textAnchor="middle"
              x={labelXPosition}
              y={rounded(labelY + 15)}
            >
              {valueLiteral(point.value)} {point.unit}
            </text>
            <text
              className="quant-chart__series-label"
              data-series-label-for={index}
              textAnchor="middle"
              x={labelXPosition}
              y={labelY}
            >
              {pointSeries(point)}
            </text>
          </a>
        );
      })}
      {labels.map((label) => (
        <SvgLabel
          availableWidth={availableLabelWidth}
          key={label}
          label={label}
          x={labelX(label)}
          y={layout.labelY}
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
  const labelSlotWidth = preferredLabelSlotWidth(labels, 210);
  const availableLabelWidth = labelSlotWidth - 20;
  const width = Math.max(760, labels.length * labelSlotWidth + 120);
  const layout = verticalLayout(series, width);
  const scale = verticalScale(totals, layout.plotTop, layout.plotBottom);
  const height = chartHeight(labels, availableLabelWidth, layout);
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
        const zeroPoints = points.filter(({ value }) => value === 0);

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
            const zeroIndex = zeroPoints.indexOf(point);
            const zeroCenteredIndex =
              zeroIndex - (zeroPoints.length - 1) / 2;
            const zeroMarkerX = rounded(centerX + zeroCenteredIndex * 14);
            const zeroLabelX = rounded(centerX + barWidth / 2 + 72);
            const zeroLabelY = rounded(scale.zero + zeroCenteredIndex * 18);
            const isZero = point.value === 0;

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
                {isZero ? (
                  <>
                    <line
                      className="quant-chart__leader"
                      data-series-leader-for={pointIndex}
                      x1={zeroMarkerX}
                      x2={rounded(zeroLabelX - 6)}
                      y1={scale.zero}
                      y2={rounded(zeroLabelY - 4)}
                    />
                    <circle
                      className="quant-chart__zero-marker"
                      cx={zeroMarkerX}
                      cy={scale.zero}
                      data-stack-zero-marker-for={pointIndex}
                      fill={`url(#${patternId(domId, seriesIndex)})`}
                      r="6"
                    />
                    <text
                      className="quant-chart__value"
                      textAnchor="start"
                      x={zeroLabelX}
                      y={rounded(zeroLabelY + 14)}
                    >
                      {valueLiteral(point.value)} {point.unit}
                    </text>
                    <text
                      className="quant-chart__series-label"
                      data-series-label-for={pointIndex}
                      textAnchor="start"
                      x={zeroLabelX}
                      y={zeroLabelY}
                    >
                      {pointSeries(point)}
                    </text>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </a>
            );
          }),
          <SvgLabel
            availableWidth={availableLabelWidth}
            key={`${label}-label`}
            label={label}
            x={centerX}
            y={layout.labelY}
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
  const labelSlotWidth = preferredLabelSlotWidth(labels, 230);
  const availableLabelWidth = labelSlotWidth - 20;
  const width = Math.max(760, labels.length * labelSlotWidth + 120);
  const layout = verticalLayout(series, width);
  const height = chartHeight(labels, availableLabelWidth, layout);
  const scale = verticalScale(
    spec.points.map(({ value }) => value),
    layout.plotTop,
    layout.plotBottom,
  );
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
          availableWidth={availableLabelWidth}
          key={label}
          label={label}
          x={rounded(70 + index * groupWidth + groupWidth / 2)}
          y={layout.labelY}
        />
      ))}
    </ChartFrame>
  );
}
