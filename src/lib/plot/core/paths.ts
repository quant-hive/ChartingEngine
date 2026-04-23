import type { Point, Rect, ScaleType } from "./types";
import { scaleValue } from "./scales";

// ── Point Mapping (data → pixel) ────────────────────────────────────────

export function mapPoint(
  index: number,
  value: number,
  dataLen: number,
  plotArea: Rect,
  yMin: number,
  yMax: number,
  yScale: ScaleType = "linear",
  xVal?: number,
  xMin?: number,
  xMax?: number,
  xScale?: ScaleType,
): Point {
  const x = xVal !== undefined && xMin !== undefined && xMax !== undefined
    ? plotArea.x + scaleValue(xScale ?? "linear", xVal, xMin, xMax, 0, plotArea.w)
    : dataLen <= 1
      ? plotArea.x + plotArea.w / 2
      : plotArea.x + (index / (dataLen - 1)) * plotArea.w;
  const y = plotArea.y + plotArea.h - scaleValue(yScale, value, yMin, yMax, 0, plotArea.h);
  return { x, y };
}

// ── Line Path ───────────────────────────────────────────────────────────

export function buildLinePath(
  data: number[],
  plotArea: Rect,
  yMin: number,
  yMax: number,
  yScale: ScaleType = "linear"
): { path: string; points: Point[] } {
  const points = data.map((v, i) => mapPoint(i, v, data.length, plotArea, yMin, yMax, yScale));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  return { path, points };
}

// ── Area Path (closed to baseline) ──────────────────────────────────────

export function buildAreaPath(
  data: number[],
  plotArea: Rect,
  yMin: number,
  yMax: number,
  baseline?: number,
  yScale: ScaleType = "linear",
  xData?: number[],
  xMin?: number,
  xMax?: number,
  xScale?: ScaleType,
): { path: string; points: Point[] } {
  const baseY = baseline !== undefined
    ? plotArea.y + plotArea.h - scaleValue(yScale, baseline, yMin, yMax, 0, plotArea.h)
    : plotArea.y + plotArea.h;

  const points = data.map((v, i) => mapPoint(i, v, data.length, plotArea, yMin, yMax, yScale, xData?.[i], xMin, xMax, xScale));
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const path = `${line} L${points[points.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${points[0].x.toFixed(1)},${baseY.toFixed(1)} Z`;
  return { path, points };
}

// ── Fill Between Two Curves ──────────────────────────────────────────────

export function buildFillBetweenPath(
  y1Data: number[],
  y2Data: number[],
  plotArea: Rect,
  yMin: number,
  yMax: number,
  yScale: ScaleType = "linear",
  xData?: number[],
  xMin?: number,
  xMax?: number,
  xScale?: ScaleType,
): { path: string; points: Point[] } {
  const n = y1Data.length;
  const topPoints = y1Data.map((v, i) => mapPoint(i, v, n, plotArea, yMin, yMax, yScale, xData?.[i], xMin, xMax, xScale));
  const botPoints = y2Data.map((v, i) => mapPoint(i, v, n, plotArea, yMin, yMax, yScale, xData?.[i], xMin, xMax, xScale));

  const forward = topPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const backward = [...botPoints]
    .reverse()
    .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return { path: `${forward} ${backward} Z`, points: topPoints };
}

// ── Bar Rects ───────────────────────────────────────────────────────────

export interface BarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  index: number;
}

const BAR_MIN_W = 4;
const BAR_MAX_W = 60;

export function buildBarRects(
  data: number[],
  seriesIndex: number,
  numSeries: number,
  plotArea: Rect,
  yMin: number,
  yMax: number,
  barWidth = 20,
  pairGap = 3,
  bottom?: number[]
): BarGeometry[] {
  const n = data.length;
  const groupW = plotArea.w / n;
  // Auto-size: use 60% of group width per series, clamped to min/max
  const autoW = Math.min(BAR_MAX_W, Math.max(BAR_MIN_W, (groupW * 0.6) / numSeries));
  const effectiveBarW = barWidth === 20 ? autoW : Math.min(BAR_MAX_W, Math.max(BAR_MIN_W, barWidth));
  const pairW = numSeries > 1 ? effectiveBarW * numSeries + pairGap * (numSeries - 1) : effectiveBarW;
  const groupPadL = (groupW - pairW) / 2;
  const baseY = plotArea.y + plotArea.h;
  const yRange = yMax - yMin;

  return data.map((val, i) => {
    const bot = bottom ? bottom[i] : 0;
    const top = bottom ? bot + val : val;
    const bx = plotArea.x + i * groupW + groupPadL + seriesIndex * (effectiveBarW + pairGap);

    // Pixel Y positions for the top of bar and baseline (bot)
    const valPx = baseY - ((top - yMin) / yRange) * plotArea.h;
    const botPx = baseY - ((bot - yMin) / yRange) * plotArea.h;

    // Top of rect is whichever is higher (smaller Y in SVG), height spans between them
    const by = Math.min(valPx, botPx);
    const h = Math.max(1, Math.abs(valPx - botPx));

    return { x: bx, y: by, width: effectiveBarW, height: h, value: val, index: i };
  });
}

// ── Scatter Points ──────────────────────────────────────────────────────

export function buildScatterPoints(
  xData: number[],
  yData: number[],
  plotArea: Rect,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  sizes?: number | number[],
  xScale: ScaleType = "linear",
  yScale: ScaleType = "linear"
): { x: number; y: number; size: number }[] {
  return xData.map((xVal, i) => {
    const x = plotArea.x + scaleValue(xScale, xVal, xMin, xMax, 0, plotArea.w);
    const y = plotArea.y + plotArea.h - scaleValue(yScale, yData[i], yMin, yMax, 0, plotArea.h);
    const size = typeof sizes === "number" ? sizes : sizes ? sizes[i] : 4;
    return { x, y, size };
  });
}

// ── Histogram Bins ──────────────────────────────────────────────────────

export function computeHistogramBins(
  data: number[],
  bins: number | number[] = 10
): { edges: number[]; counts: number[] } {
  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  let edges: number[];
  if (Array.isArray(bins)) {
    edges = bins;
  } else {
    const step = (max - min) / bins;
    edges = [];
    for (let i = 0; i <= bins; i++) {
      edges.push(min + i * step);
    }
  }

  const counts = new Array(edges.length - 1).fill(0);
  for (const v of data) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && (v < edges[i + 1] || (i === edges.length - 2 && v === edges[i + 1]))) {
        counts[i]++;
        break;
      }
    }
  }

  return { edges, counts };
}

// ── Dash Array for line styles ──────────────────────────────────────────

export function dashArray(style: string): string | undefined {
  switch (style) {
    case "dashed": return "8 4";
    case "dotted": return "2 3";
    case "dashdot": return "8 3 2 3";
    default: return undefined;
  }
}
