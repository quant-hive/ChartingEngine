// ── Universal Chart Renderer ────────────────────────────────────────────
// Single entry point for rendering any chart from agent JSON config.
// The agent passes a ChartSpec JSON; this function returns a Scene.
//
// The agent specifies `type` — one of the graph variants below.
// renderChart normalizes the variant into the correct rendering path.

import { figure, Axes } from "./figure";
import type { Scene } from "./types";

// ── All graph types the agent can request ──────────────────────────────
//
// Core types:
//   line           — standard line chart
//   bar            — grouped bar chart
//   stacked_bar    — stacked bar chart (series stacked on top of each other)
//   scatter        — scatter plot
//   area           — filled area chart
//   histogram      — frequency distribution
//   pie            — pie chart
//   donut          — donut chart (pie with hole)
//   surface        — 2D surface plot (static, rendered in Python flash-plot)
//   surface_3d     — interactive 3D surface with drag/zoom
//   candlestick    — OHLC candlestick chart (financial)
//   bokeh          — alias for candlestick
//   heatmap        — color-mapped 2D grid
//   waterfall      — waterfall chart (incremental +/- bars)
//   bubble         — scatter with variable marker sizes

export type ChartType =
  | "line"
  | "bar"
  | "stacked_bar"
  | "scatter"
  | "area"
  | "histogram"
  | "pie"
  | "donut"
  | "surface"
  | "surface_3d"
  | "candlestick"
  | "bokeh"
  | "heatmap"
  | "waterfall"
  | "bubble"
  | "violin"
  | "boxplot";

// Map agent graph type → internal rendering category
function resolveType(type: ChartType): { render: string; stacked?: boolean; donut?: boolean } {
  switch (type) {
    case "line":          return { render: "line" };
    case "bar":           return { render: "bar" };
    case "stacked_bar":   return { render: "bar", stacked: true };
    case "scatter":       return { render: "scatter" };
    case "bubble":        return { render: "scatter" };
    case "area":          return { render: "area" };
    case "histogram":     return { render: "histogram" };
    case "pie":           return { render: "pie" };
    case "donut":         return { render: "pie", donut: true };
    case "surface":       return { render: "surface" };
    case "surface_3d":    return { render: "surface" };
    case "candlestick":   return { render: "candlestick" };
    case "bokeh":         return { render: "candlestick" };
    case "heatmap":       return { render: "heatmap" };
    case "waterfall":     return { render: "waterfall" };
    case "violin":        return { render: "violin" };
    case "boxplot":       return { render: "boxplot" };
    default:              return { render: "line" };
  }
}

// Palette lookup key from render category
function paletteKey(render: string): keyof typeof DEFAULT_COLORS {
  if (render === "candlestick" || render === "waterfall") return "bar";
  if (render === "heatmap") return "surface";
  if (render === "bubble") return "scatter";
  if (render === "violin" || render === "boxplot") return "violin";
  return (render in DEFAULT_COLORS ? render : "line") as keyof typeof DEFAULT_COLORS;
}

// ── Default color palettes per chart type ──────────────────────────────

export const DEFAULT_COLORS = {
  line: ["#d4d4d4", "#707070", "#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#FCA5A5"],
  bar: ["#EF8CFF", "#8CA5FF", "#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC"],
  scatter: ["#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#d4d4d4"],
  area: ["#4ECDC4", "#C084FC", "#FFD93D", "#FF6B6B", "#67E8F9", "#d4d4d4"],
  surface: ["#C084FC"],
  pie: ["#4aaaba", "#d8b4fe", "#fbbf24", "#f9a8d4", "#6dd5c8", "#a5f3d8", "#C084FC", "#FF6B6B", "#67E8F9", "#FFD93D"],
  histogram: ["#C084FC", "#4ECDC4", "#FFD93D"],
  candlestick: ["#4ECDC4", "#FF6B6B"],  // green (up) / red (down)
  waterfall: ["#4ECDC4", "#FF6B6B", "#8CA5FF"],  // positive / negative / total
  heatmap: ["#0d1117", "#4aaaba", "#fbbf24", "#ff6b6b"],
  violin: ["#C084FC", "#4ECDC4", "#FFD93D", "#FF6B6B", "#67E8F9", "#8CA5FF"],
};

// ── ChartSpec: the JSON schema the agent sends ─────────────────────────

export interface SeriesSpec {
  /** Y-axis values (close prices for candlestick) */
  data: number[];
  /** Optional X-axis values (defaults to 0, 1, 2, ...) */
  x?: number[];
  /** Series label for legend */
  label?: string;
  /** Hex color (e.g. "#4ECDC4"). Falls back to chart-type default palette */
  color?: string;
  /** Line width (line charts). Default: 1.5 */
  lineWidth?: number;
  /** Line style. Default: "solid" */
  lineStyle?: "solid" | "dashed" | "dotted" | "dashdot";
  /** Fill opacity for area under line. 0 = no fill. Default: 0 */
  fillOpacity?: number;
  /** Bar width fraction (bar charts). Default: 0.8 */
  barWidth?: number;
  /** Stack on top of previous series (bar charts). Default: false */
  stacked?: boolean;
  /** Marker size (scatter/bubble charts). Default: 4 */
  markerSize?: number;
  /** Bubble sizes array — one per data point (bubble charts) */
  sizes?: number[];
  /** OHLC: open prices (candlestick/bokeh) */
  open?: number[];
  /** OHLC: high prices (candlestick/bokeh) */
  high?: number[];
  /** OHLC: low prices (candlestick/bokeh) */
  low?: number[];
  /** OHLC: close prices — alias for data (candlestick/bokeh) */
  close?: number[];
  /** Boxplot: quartile 1 (25th percentile) */
  q1?: number;
  /** Boxplot: median (50th percentile) */
  median?: number;
  /** Boxplot: quartile 3 (75th percentile) */
  q3?: number;
  /** Boxplot: whisker low */
  whiskerLow?: number;
  /** Boxplot: whisker high */
  whiskerHigh?: number;
  /** Boxplot: outlier points */
  outliers?: number[];
}

export interface PieSliceSpec {
  /** Slice value */
  value: number;
  /** Slice label */
  label: string;
  /** Hex color. Falls back to default pie palette */
  color?: string;
}

export interface SurfaceSpec {
  /** 2D array of Z values (rows × cols) */
  z: number[][];
  /** Optional 2D array of X values (same shape as z) */
  x?: number[][];
  /** Optional 2D array of Y values (same shape as z) */
  y?: number[][];
  /** Surface base color. Default: "#C084FC" */
  color?: string;
  /** Show wireframe grid. Default: true */
  wireframe?: boolean;
  /** Initial azimuth angle (radians). Default: -0.6 */
  azimuth?: number;
  /** Initial elevation angle (radians). Default: 0.5 */
  elevation?: number;
}

export interface HeatmapSpec {
  /** 2D array of values (rows × cols) */
  data: number[][];
  /** Row labels */
  rowLabels?: string[];
  /** Column labels */
  colLabels?: string[];
  /** Color range: [min_color, max_color]. Default: theme heatmap palette */
  colorRange?: string[];
}

export interface AxisSpec {
  /** Axis label text */
  label?: string;
  /** Explicit min value. Auto-computed if omitted */
  min?: number;
  /** Explicit max value. Auto-computed if omitted */
  max?: number;
  /** Scale type. Default: "linear" */
  scale?: "linear" | "log" | "symlog";
  /** Custom tick positions */
  ticks?: number[];
  /** Custom tick labels (must match ticks length) */
  tickLabels?: string[];
}

export interface LegendSpec {
  /** Show legend. Default: true if any series has a label */
  show?: boolean;
  /** Legend position */
  position?: "best" | "upper-left" | "upper-right" | "lower-left" | "lower-right";
}

export interface ChartSpec {
  /** Graph type the agent requests */
  type: ChartType;

  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;

  /** Data series (for line, bar, stacked_bar, scatter, bubble, area, histogram, candlestick, waterfall) */
  series?: SeriesSpec[];

  /** Pie/donut slices (for type: "pie" or "donut") */
  slices?: PieSliceSpec[];
  /** Donut inner radius ratio (0-1). Default: 0.55. Only used when type="donut" */
  donutRatio?: number;

  /** Surface data (for type: "surface" or "surface_3d") */
  surface?: SurfaceSpec;

  /** Heatmap data (for type: "heatmap") */
  heatmap?: HeatmapSpec;

  /** Histogram bin count. Default: 10 */
  bins?: number;

  /** X-axis labels (categorical). Overrides numeric x values */
  xLabels?: string[];

  /** X-axis config */
  xAxis?: AxisSpec;
  /** Y-axis config */
  yAxis?: AxisSpec;

  /** Legend config */
  legend?: LegendSpec;

  /** Show grid. Default: true */
  grid?: boolean;

  /** Chart dimensions */
  width?: number;
  height?: number;

  /** Reference lines */
  hlines?: { y: number; color?: string; label?: string; lineStyle?: "solid" | "dashed" | "dotted" | "dashdot" }[];
  vlines?: { x: number; color?: string; label?: string; lineStyle?: "solid" | "dashed" | "dotted" | "dashdot" }[];

  /** Annotations */
  annotations?: { text: string; x: number; y: number; color?: string }[];

  /** Edge distribution (sideways histogram overlay at chart edge) */
  edgeDistribution?: {
    position: "right";
    values: number[];
    binEdges: number[];
    color?: string;
    opacity?: number;
    annotations?: { y: number; label: string; color?: string }[];
  };
}

// ── renderChart: the universal function ─────────────────────────────────

export function renderChart(spec: ChartSpec): Scene {
  const resolved = resolveType(spec.type);
  const w = spec.width ?? 595;
  const h = spec.height ?? 260;
  const fig = figure({ width: w, height: h });
  const ax = fig.subplot(1, 1, 1);

  const palette = DEFAULT_COLORS[paletteKey(resolved.render)] ?? DEFAULT_COLORS.line;

  // ── Title / Subtitle
  if (spec.title) ax.set_title(spec.title);
  if (spec.subtitle) ax.set_subtitle(spec.subtitle);

  // ── Axis config
  if (spec.xAxis?.scale) ax.set_xscale(spec.xAxis.scale);
  if (spec.yAxis?.scale) ax.set_yscale(spec.yAxis.scale);
  if (spec.xAxis?.label) ax.set_xlabel(spec.xAxis.label);
  if (spec.yAxis?.label) ax.set_ylabel(spec.yAxis.label);
  if (spec.xAxis?.min != null && spec.xAxis?.max != null) ax.set_xlim(spec.xAxis.min, spec.xAxis.max);
  if (spec.yAxis?.min != null && spec.yAxis?.max != null) ax.set_ylim(spec.yAxis.min, spec.yAxis.max);
  if (spec.xAxis?.ticks) {
    ax.set_xticks(spec.xAxis.ticks, spec.xAxis.tickLabels);
  } else if (spec.xLabels) {
    ax.set_xticks(spec.xLabels);
  }
  if (spec.yAxis?.ticks) ax.set_yticks(spec.yAxis.ticks);

  // ── Grid
  if (spec.grid !== false) ax.grid(true);

  // ── Chart-type specific rendering
  switch (resolved.render) {
    case "line":
      _renderLine(ax, spec, palette);
      break;
    case "bar":
      _renderBar(ax, spec, palette, resolved.stacked);
      break;
    case "scatter":
      _renderScatter(ax, spec, palette);
      break;
    case "area":
      _renderArea(ax, spec, palette);
      break;
    case "histogram":
      _renderHistogram(ax, spec, palette);
      break;
    case "candlestick":
      _renderCandlestick(ax, spec, palette);
      break;
    case "waterfall":
      _renderWaterfall(ax, spec, palette);
      break;
    case "violin":
      _renderViolin(ax, spec, palette);
      break;
    case "boxplot":
      _renderBoxplot(ax, spec, palette);
      break;
    case "heatmap":
      // Heatmaps rendered as colored rects — use heatmap spec
      // TODO: implement when Axes gains heatmap support
      break;
    case "surface":
      // Surface plots use the Python flash-plot renderer (not TS Axes).
      // Use extractSurfaceSpec() to get data for the server route.
      break;
    case "pie":
      // Pie/donut charts use the React PieChart component directly.
      // Use extractPieSlices() to get data for <PieChart />.
      break;
  }

  // ── Reference lines
  if (spec.hlines) {
    for (const hl of spec.hlines) {
      ax.axhline(hl.y, { color: hl.color ?? "#494949", label: hl.label, linestyle: hl.lineStyle ?? "dashed" });
    }
  }
  if (spec.vlines) {
    for (const vl of spec.vlines) {
      ax.axvline(vl.x, { color: vl.color ?? "#494949", label: vl.label, linestyle: vl.lineStyle ?? "dashed" });
    }
  }

  // ── Annotations
  if (spec.annotations) {
    for (const ann of spec.annotations) {
      ax.text(ann.x, ann.y, ann.text, { color: ann.color ?? "#808080" });
    }
  }

  // ── Legend
  const hasLabels = (spec.series ?? []).some((s) => s.label) || (spec.slices ?? []).some((s) => s.label);
  if (spec.legend?.show !== false && hasLabels) {
    ax.legend({ loc: spec.legend?.position ?? "best" });
  }

  const scene = fig.render();

  // ── Edge Distribution (sideways histogram overlay)
  if (spec.edgeDistribution && spec.edgeDistribution.values.length > 0 && scene.subplots[0]) {
    const ed = spec.edgeDistribution;
    const sp = scene.subplots[0];
    const pa = sp.plotArea;

    // Compute y-axis data range from scene
    const yTicks = sp.yAxis.ticks;
    let yMin = yTicks.length > 0 ? yTicks[0].value : ed.binEdges[0];
    let yMax = yTicks.length > 0 ? yTicks[yTicks.length - 1].value : ed.binEdges[ed.binEdges.length - 1];
    // Override with spec axis config if present
    if (spec.yAxis?.min != null) yMin = spec.yAxis.min;
    if (spec.yAxis?.max != null) yMax = spec.yAxis.max;
    // Fallback: derive from binEdges range
    if (yMin === yMax) { yMin = ed.binEdges[0]; yMax = ed.binEdges[ed.binEdges.length - 1]; }

    const yRange = yMax - yMin || 1;
    const marginWidth = pa.w * 0.18;
    const maxVal = Math.max(...ed.values) || 1;

    const bars: { y: number; height: number; width: number }[] = [];
    for (let i = 0; i < ed.values.length; i++) {
      if (i >= ed.binEdges.length - 1) break;
      const binTop = ed.binEdges[i + 1];
      const binBot = ed.binEdges[i];
      // Convert data → pixel (y-axis is inverted in SVG)
      const pyTop = pa.y + (1 - (binTop - yMin) / yRange) * pa.h;
      const pyBot = pa.y + (1 - (binBot - yMin) / yRange) * pa.h;
      const barHeight = Math.abs(pyBot - pyTop);
      const barY = Math.min(pyTop, pyBot);
      const barWidth = (ed.values[i] / maxVal) * marginWidth;
      bars.push({ y: barY, height: barHeight, width: barWidth });
    }

    const annotations = (ed.annotations ?? []).map(a => ({
      y: pa.y + (1 - (a.y - yMin) / yRange) * pa.h,
      label: a.label,
      color: a.color ?? "#888888",
    }));

    sp.edgeDistribution = {
      position: "right",
      bars,
      color: ed.color ?? "#2563EB",
      opacity: ed.opacity ?? 0.3,
      annotations,
      marginWidth,
    };
  }

  return scene;
}

// ── Private renderers per chart type ────────────────────────────────────

function _renderLine(ax: Axes, spec: ChartSpec, palette: string[]) {
  const series = spec.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color = s.color ?? palette[i % palette.length];
    const xData = s.x ?? s.data.map((_, idx) => idx);
    ax.plot(xData, s.data, {
      color,
      label: s.label,
      linewidth: s.lineWidth ?? 1.5,
      linestyle: s.lineStyle ?? "solid",
    });
    if (s.fillOpacity && s.fillOpacity > 0) {
      ax.fill_between(xData, s.data, 0, { color, alpha: s.fillOpacity });
    }
  }
}

function _renderBar(ax: Axes, spec: ChartSpec, palette: string[], forceStacked?: boolean) {
  const series = spec.series ?? [];
  let bottom: number[] | undefined;
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const isStacked = forceStacked || s.stacked;
    const color = s.color ?? palette[i % palette.length];
    const xData = s.x ?? s.data.map((_, idx) => idx);
    ax.bar(xData, s.data, {
      color,
      label: s.label,
      width: s.barWidth ?? 18,
      bottom: isStacked && bottom ? [...bottom] : undefined,
    });
    if (isStacked) {
      if (!bottom) bottom = new Array(s.data.length).fill(0);
      for (let j = 0; j < s.data.length; j++) bottom[j] += s.data[j];
    }
  }
}

function _renderScatter(ax: Axes, spec: ChartSpec, palette: string[]) {
  const isBubble = spec.type === "bubble";
  const series = spec.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color = s.color ?? palette[i % palette.length];
    const xData = s.x ?? s.data.map((_, idx) => idx);
    // Bubble chart: use sizes array for variable marker sizes
    const sizes = isBubble && s.sizes ? s.sizes : (s.markerSize ?? 4);
    ax.scatter(xData, s.data, { color, label: s.label, s: sizes });
  }
}

function _renderArea(ax: Axes, spec: ChartSpec, palette: string[]) {
  const series = spec.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color = s.color ?? palette[i % palette.length];
    const xData = s.x ?? s.data.map((_, idx) => idx);
    ax.plot(xData, s.data, { color, label: s.label, linewidth: s.lineWidth ?? 1 });
    ax.fill_between(xData, s.data, 0, { color, alpha: s.fillOpacity ?? 0.15 });
  }
}

function _renderHistogram(ax: Axes, spec: ChartSpec, palette: string[]) {
  const series = spec.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color = s.color ?? palette[i % palette.length];
    ax.hist(s.data, { bins: spec.bins ?? 10, color, label: s.label });
  }
}

function _renderCandlestick(ax: Axes, spec: ChartSpec, palette: string[]) {
  // Renders OHLC as bar chart with colored bars for up/down
  // Green (palette[0]) for close > open, Red (palette[1]) for close < open
  const s = (spec.series ?? [])[0];
  if (!s) return;
  const open = s.open ?? [];
  const high = s.high ?? [];
  const low = s.low ?? [];
  const close = s.close ?? s.data ?? [];
  const n = Math.min(open.length, high.length, low.length, close.length);
  if (n === 0) return;

  const upColor = palette[0] ?? "#4ECDC4";
  const downColor = palette[1] ?? "#FF6B6B";
  const wickColor = "#555555";

  for (let i = 0; i < n; i++) {
    const isUp = close[i] >= open[i];
    const bodyBot = Math.min(open[i], close[i]);
    const bodyTop = Math.max(open[i], close[i]);
    const bodyH = bodyTop - bodyBot || 0.001; // avoid zero-height
    const color = isUp ? upColor : downColor;

    // Body as a bar
    ax.bar([i], [bodyH], { color, width: 0.6, bottom: [bodyBot] });

    // Wicks as vertical lines (high/low) — rendered as thin bars
    ax.bar([i], [high[i] - low[i]], { color: wickColor, width: 0.08, bottom: [low[i]] });
  }

  if (spec.xLabels) ax.set_xticks(spec.xLabels);
  if (s.label) {
    // Add invisible series for legend
    ax.axhline(close[0], { color: upColor, label: `${s.label} (up)`, linestyle: "solid" });
    ax.axhline(close[0], { color: downColor, label: `${s.label} (down)`, linestyle: "solid" });
  }
}

function _renderWaterfall(ax: Axes, spec: ChartSpec, palette: string[]) {
  // Waterfall: each bar starts where the previous one ended
  // Positive values go up (palette[0]), negative go down (palette[1])
  // Optional final "total" bar (palette[2])
  const s = (spec.series ?? [])[0];
  if (!s) return;
  const data = s.data;
  const posColor = s.color ?? palette[0] ?? "#4ECDC4";
  const negColor = palette[1] ?? "#FF6B6B";
  const totalColor = palette[2] ?? "#8CA5FF";

  let running = 0;
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    const isTotal = spec.xLabels?.[i]?.toLowerCase() === "total";
    if (isTotal) {
      // Total bar from 0 to running
      ax.bar([i], [running], { color: totalColor, width: 0.7 });
    } else {
      const bottom = val >= 0 ? running : running + val;
      ax.bar([i], [Math.abs(val)], {
        color: val >= 0 ? posColor : negColor,
        width: 0.7,
        bottom: [bottom],
      });
      running += val;
    }
  }

  if (spec.xLabels) ax.set_xticks(spec.xLabels);
}

function _renderViolin(ax: Axes, spec: ChartSpec, palette: string[]) {
  // Violin plot: each series is a distribution rendered as a mirrored KDE curve
  // Uses raw data points to compute a kernel density estimate
  const series = spec.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color = s.color ?? palette[i % palette.length];
    const raw = s.data;
    if (raw.length === 0) continue;

    // Compute KDE (Gaussian kernel)
    const sorted = [...raw].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min || 1;
    const bandwidth = range * 0.15; // Silverman-like bandwidth
    const nPoints = 40;
    const step = range / (nPoints - 1);

    const kde: { y: number; density: number }[] = [];
    for (let j = 0; j < nPoints; j++) {
      const y = min + j * step;
      let density = 0;
      for (const v of raw) {
        const u = (y - v) / bandwidth;
        density += Math.exp(-0.5 * u * u); // Gaussian kernel (unnormalized)
      }
      density /= raw.length * bandwidth;
      kde.push({ y, density });
    }

    // Normalize density to a reasonable width (0.35 units each side)
    const maxDensity = Math.max(...kde.map((k) => k.density)) || 1;
    const halfWidth = 0.35;

    // Plot as mirrored fill_between around x = i
    const xLeft = kde.map((k) => i - (k.density / maxDensity) * halfWidth);
    const xRight = kde.map((k) => i + (k.density / maxDensity) * halfWidth);
    const yVals = kde.map((k) => k.y);

    // Right half
    ax.fill_between(xRight, yVals, yVals.map(() => i), { color, alpha: 0.25 });
    ax.plot(xRight, yVals, { color, linewidth: 1.5 });

    // Left half (mirror)
    ax.fill_between(xLeft, yVals, yVals.map(() => i), { color, alpha: 0.25 });
    ax.plot(xLeft, yVals, { color, linewidth: 1.5, label: s.label });

    // Median line
    const median = sorted[Math.floor(sorted.length / 2)];
    const medIdx = kde.reduce((best, k, idx) =>
      Math.abs(k.y - median) < Math.abs(kde[best].y - median) ? idx : best, 0);
    const medW = (kde[medIdx].density / maxDensity) * halfWidth;
    ax.plot([i - medW, i + medW], [median, median], { color: "#ffffff", linewidth: 2 });
  }

  if (spec.xLabels) ax.set_xticks(spec.xLabels);
}

function _renderBoxplot(ax: Axes, spec: ChartSpec, palette: string[]) {
  // Boxplot: each series provides pre-computed stats OR raw data
  const series = spec.series ?? [];
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const color = s.color ?? palette[i % palette.length];

    let q1: number, median: number, q3: number, wLow: number, wHigh: number;
    let outliers: number[] = [];

    if (s.q1 != null && s.median != null && s.q3 != null) {
      // Pre-computed stats from agent
      q1 = s.q1;
      median = s.median;
      q3 = s.q3;
      wLow = s.whiskerLow ?? q1;
      wHigh = s.whiskerHigh ?? q3;
      outliers = s.outliers ?? [];
    } else {
      // Compute from raw data
      const sorted = [...s.data].sort((a, b) => a - b);
      const n = sorted.length;
      if (n === 0) continue;
      q1 = sorted[Math.floor(n * 0.25)];
      median = sorted[Math.floor(n * 0.5)];
      q3 = sorted[Math.floor(n * 0.75)];
      const iqr = q3 - q1;
      wLow = Math.max(sorted[0], q1 - 1.5 * iqr);
      wHigh = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
      outliers = sorted.filter((v) => v < wLow || v > wHigh);
    }

    // Box (Q1 to Q3)
    const boxH = q3 - q1 || 0.001;
    ax.bar([i], [boxH], { color, width: 0.5, bottom: [q1] });

    // Median line
    ax.plot([i - 0.25, i + 0.25], [median, median], { color: "#ffffff", linewidth: 2 });

    // Whiskers (thin vertical bars)
    // Lower whisker
    ax.bar([i], [q1 - wLow], { color: "#808080", width: 0.06, bottom: [wLow] });
    // Upper whisker
    ax.bar([i], [wHigh - q3], { color: "#808080", width: 0.06, bottom: [q3] });

    // Whisker caps
    ax.plot([i - 0.15, i + 0.15], [wLow, wLow], { color: "#808080", linewidth: 1.5 });
    ax.plot([i - 0.15, i + 0.15], [wHigh, wHigh], { color: "#808080", linewidth: 1.5 });

    // Outliers
    if (outliers.length > 0) {
      ax.scatter(
        outliers.map(() => i),
        outliers,
        { color, s: 3 }
      );
    }

    // Legend entry via label
    if (s.label) {
      ax.axhline(median, { color, label: s.label, linestyle: "solid" });
    }
  }

  if (spec.xLabels) ax.set_xticks(spec.xLabels);
}

// Surface and Pie are rendered via separate components:
// - Surface: Python flash-plot renderer or /api/chart server route
// - Pie: <PieChart slices={spec.slices} /> React component
//
// Use extractPieSlices() and extractSurfaceSpec() helpers below to
// pull the relevant data from a ChartSpec for those renderers.

export function extractPieSlices(spec: ChartSpec, palette: string[] = DEFAULT_COLORS.pie) {
  const resolved = resolveType(spec.type);
  return {
    slices: (spec.slices ?? []).map((s, i) => ({
      value: s.value,
      label: s.label,
      color: s.color ?? palette[i % palette.length],
    })),
    donut: resolved.donut ?? false,
    donutRatio: spec.donutRatio ?? 0.55,
  };
}

export function extractCandlestickData(spec: ChartSpec) {
  const s = (spec.series ?? [])[0];
  if (!s) return null;
  const open = s.open ?? [];
  const high = s.high ?? [];
  const low = s.low ?? [];
  const close = s.close ?? s.data ?? [];
  const n = Math.min(open.length, high.length, low.length, close.length);
  if (n === 0) return null;
  // Extract interval from subtitle (e.g. "4h · Last 12 candles" → "4h")
  const subtitle = (spec as any).subtitle as string | undefined;
  const interval = subtitle?.split("·")[0]?.trim() || undefined;
  return {
    open: open.slice(0, n),
    high: high.slice(0, n),
    low: low.slice(0, n),
    close: close.slice(0, n),
    labels: spec.xLabels,
    ticker: s.label,
    interval,
  };
}

export function extractSurfaceSpec(spec: ChartSpec) {
  const surf = spec.surface;
  if (!surf) return null;
  return {
    z: surf.z,
    x: surf.x,
    y: surf.y,
    color: surf.color ?? DEFAULT_COLORS.surface[0],
    wireframe: surf.wireframe ?? true,
    azimuth: surf.azimuth ?? -0.6,
    elevation: surf.elevation ?? 0.5,
  };
}

