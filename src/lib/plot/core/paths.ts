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

// ── Line Path (null values create gaps) ─────────────────────────────────

export function buildLinePath(
  data: (number | null)[],
  plotArea: Rect,
  yMin: number,
  yMax: number,
  yScale: ScaleType = "linear"
): { path: string; points: (Point | null)[] } {
  const points: (Point | null)[] = data.map((v, i) =>
    v != null ? mapPoint(i, v, data.length, plotArea, yMin, yMax, yScale) : null
  );
  let path = "";
  let inSegment = false;
  for (const p of points) {
    if (p == null) { inSegment = false; continue; }
    path += `${inSegment ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)} `;
    inSegment = true;
  }
  return { path: path.trim(), points };
}

// ── Area Path (closed to baseline, null values create segmented fills) ──

export function buildAreaPath(
  data: (number | null)[],
  plotArea: Rect,
  yMin: number,
  yMax: number,
  baseline?: number,
  yScale: ScaleType = "linear",
  xData?: number[],
  xMin?: number,
  xMax?: number,
  xScale?: ScaleType,
): { path: string; points: (Point | null)[] } {
  const baseY = baseline !== undefined
    ? plotArea.y + plotArea.h - scaleValue(yScale, baseline, yMin, yMax, 0, plotArea.h)
    : plotArea.y + plotArea.h;

  const points: (Point | null)[] = data.map((v, i) =>
    v != null ? mapPoint(i, v, data.length, plotArea, yMin, yMax, yScale, xData?.[i], xMin, xMax, xScale) : null
  );

  // Build segmented area paths — each contiguous non-null run becomes a closed shape
  const segments: Point[][] = [];
  let current: Point[] = [];
  for (const p of points) {
    if (p == null) {
      if (current.length > 0) { segments.push(current); current = []; }
    } else {
      current.push(p);
    }
  }
  if (current.length > 0) segments.push(current);

  let path = "";
  for (const seg of segments) {
    const line = seg.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    path += `${line} L${seg[seg.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${seg[0].x.toFixed(1)},${baseY.toFixed(1)} Z `;
  }
  return { path: path.trim(), points };
}

// ── Fill Between Two Curves (null in either curve breaks the segment) ───

export function buildFillBetweenPath(
  y1Data: (number | null)[],
  y2Data: (number | null)[],
  plotArea: Rect,
  yMin: number,
  yMax: number,
  yScale: ScaleType = "linear",
  xData?: number[],
  xMin?: number,
  xMax?: number,
  xScale?: ScaleType,
): { path: string; points: (Point | null)[] } {
  const n = y1Data.length;
  const topPoints: (Point | null)[] = y1Data.map((v, i) =>
    v != null ? mapPoint(i, v, n, plotArea, yMin, yMax, yScale, xData?.[i], xMin, xMax, xScale) : null
  );
  const botPoints: (Point | null)[] = y2Data.map((v, i) =>
    v != null ? mapPoint(i, v, n, plotArea, yMin, yMax, yScale, xData?.[i], xMin, xMax, xScale) : null
  );

  // Segment: both top and bottom must be non-null
  const segments: { top: Point[]; bot: Point[] }[] = [];
  let curTop: Point[] = [], curBot: Point[] = [];
  for (let i = 0; i < n; i++) {
    if (topPoints[i] != null && botPoints[i] != null) {
      curTop.push(topPoints[i]!);
      curBot.push(botPoints[i]!);
    } else {
      if (curTop.length > 0) { segments.push({ top: curTop, bot: curBot }); curTop = []; curBot = []; }
    }
  }
  if (curTop.length > 0) segments.push({ top: curTop, bot: curBot });

  let path = "";
  for (const seg of segments) {
    const forward = seg.top.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const backward = [...seg.bot].reverse().map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    path += `${forward} ${backward} Z `;
  }
  return { path: path.trim(), points: topPoints };
}

// ── Bar Rects (null values skip the bar) ────────────────────────────────

export interface BarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  index: number;
}

export function buildBarRects(
  data: (number | null)[],
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
  const pairW = numSeries > 1 ? barWidth * numSeries + pairGap * (numSeries - 1) : barWidth;
  const groupPadL = (groupW - pairW) / 2;
  const baseY = plotArea.y + plotArea.h;
  const yRange = yMax - yMin;

  const bars: BarGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const val = data[i];
    if (val == null) continue;
    const bot = bottom ? bottom[i] : 0;
    const top = bottom ? bot + val : val;
    const bx = plotArea.x + i * groupW + groupPadL + seriesIndex * (barWidth + pairGap);

    const valPx = baseY - ((top - yMin) / yRange) * plotArea.h;
    const botPx = baseY - ((bot - yMin) / yRange) * plotArea.h;

    const by = Math.min(valPx, botPx);
    const h = Math.max(1, Math.abs(valPx - botPx));

    bars.push({ x: bx, y: by, width: barWidth, height: h, value: val, index: i });
  }
  return bars;
}

// ── Scatter Points (null y-values skip the point) ───────────────────────

export function buildScatterPoints(
  xData: number[],
  yData: (number | null)[],
  plotArea: Rect,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  sizes?: number | number[],
  xScale: ScaleType = "linear",
  yScale: ScaleType = "linear"
): { x: number; y: number; size: number }[] {
  const result: { x: number; y: number; size: number }[] = [];
  for (let i = 0; i < xData.length; i++) {
    if (yData[i] == null) continue;
    const x = plotArea.x + scaleValue(xScale, xData[i], xMin, xMax, 0, plotArea.w);
    const y = plotArea.y + plotArea.h - scaleValue(yScale, yData[i]!, yMin, yMax, 0, plotArea.h);
    const size = typeof sizes === "number" ? sizes : sizes ? sizes[i] : 4;
    result.push({ x, y, size });
  }
  return result;
}

// ── Histogram Bins (nulls filtered before binning) ──────────────────────

export function computeHistogramBins(
  data: (number | null)[],
  bins: number | number[] = 10
): { edges: number[]; counts: number[] } {
  const clean = data.filter((v): v is number => v != null);
  const sorted = [...clean].sort((a, b) => a - b);
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
  for (const v of clean) {
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
