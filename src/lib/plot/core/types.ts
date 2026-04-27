// ── Core Types ──────────────────────────────────────────────────────────
// Framework-agnostic type definitions for the plotting engine.
// No React, no SVG — just data structures.

// ── Geometry ────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Scales ──────────────────────────────────────────────────────────────

export type ScaleType = "linear" | "log" | "symlog" | "category";

export interface TickMark {
  value: number;
  label: string;
  position: number; // pixel position along the axis
}

export interface AxisConfig {
  label?: string;
  scale: ScaleType;
  min?: number;
  max?: number;
  ticks?: number[] | string[];
  tickCount?: number;
  tickFormat?: (value: number) => string;
  visible?: boolean;
}

// ── Plot Commands (what the user calls) ─────────────────────────────────

export type LineStyle = "solid" | "dashed" | "dotted" | "dashdot";

export interface PlotOptions {
  color?: string;
  label?: string;
  linewidth?: number;
  linestyle?: LineStyle;
  alpha?: number;
  zorder?: number;
}

export interface BarOptions {
  color?: string | string[];
  label?: string;
  width?: number;
  alpha?: number;
  edgecolor?: string;
  zorder?: number;
  bottom?: number[];
}

export interface ScatterOptions {
  color?: string | string[];
  label?: string;
  s?: number | number[]; // marker size
  marker?: "o" | "s" | "^" | "v" | "d" | "x" | "+";
  alpha?: number;
  edgecolor?: string;
  zorder?: number;
}

export interface FillBetweenOptions {
  color?: string;
  alpha?: number;
  label?: string;
  where?: "above" | "below" | boolean[];
  zorder?: number;
}

export interface HistOptions {
  bins?: number | number[];
  color?: string;
  label?: string;
  alpha?: number;
  edgecolor?: string;
  density?: boolean;
  cumulative?: boolean;
  zorder?: number;
}

export interface HeatmapOptions {
  cmap?: string;
  vmin?: number;
  vmax?: number;
  aspect?: "auto" | "equal" | number;
  interpolation?: "nearest" | "bilinear";
}

export interface PieOptions {
  colors?: string[];
  labels?: string[];
  autopct?: string | ((pct: number) => string);
  startangle?: number;
  explode?: number[];
}

export interface BoxplotOptions {
  color?: string;
  widths?: number;
  showfliers?: boolean;
  showmeans?: boolean;
  labels?: string[];
}

export interface AnnotateOptions {
  color?: string;
  fontsize?: number;
  fontweight?: number | string;
  ha?: "left" | "center" | "right";
  va?: "top" | "center" | "bottom" | "baseline";
  arrowprops?: {
    arrowstyle?: string;
    color?: string;
    lw?: number;
  };
  zorder?: number;
}

export interface TextOptions {
  color?: string;
  fontsize?: number;
  fontweight?: number | string;
  fontfamily?: string;
  ha?: "left" | "center" | "right";
  va?: "top" | "center" | "bottom" | "baseline";
  rotation?: number;
  zorder?: number;
}

export interface GridOptions {
  visible?: boolean;
  axis?: "x" | "y" | "both";
  color?: string;
  linewidth?: number;
  linestyle?: LineStyle;
  alpha?: number;
}

export interface LegendOptions {
  loc?:
    | "upper-left"
    | "upper-right"
    | "lower-left"
    | "lower-right"
    | "center"
    | "best";
  fontsize?: number;
  frameon?: boolean;
}

// ── Scene Graph (output of figure.render()) ─────────────────────────────
// This is the intermediate representation consumed by renderers.

export interface Scene {
  width: number;
  height: number;
  theme: string;
  subplots: SubplotScene[];
}

export interface SubplotScene {
  row: number;
  col: number;
  bounds: Rect;
  plotArea: Rect;
  title?: string;
  titleStyle?: TextStyle;
  subtitle?: string;
  subtitleStyle?: TextStyle;
  xAxis: AxisScene;
  yAxis: AxisScene;
  yAxisRight?: AxisScene;
  grid: GridScene;
  elements: PlotElement[];
  legend?: LegendScene;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  letterSpacing?: string;
  color: string;
}

export interface AxisScene {
  visible: boolean;
  label?: string;
  labelStyle?: TextStyle;
  ticks: TickMark[];
  tickStyle: TextStyle;
  scale: ScaleType;
  min: number;
  max: number;
  range: number;
}

export interface GridScene {
  visible: boolean;
  axis: "x" | "y" | "both";
  lines: GridLine[];
}

export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface LegendScene {
  entries: LegendEntry[];
  position: string;
}

export interface LegendEntry {
  label: string;
  color: string;
  type: "line" | "bar" | "scatter" | "area";
  lineStyle?: LineStyle;
  lineWidth?: number;
  barGradient?: { top: string; bottom: string };
}

// ── Plot Elements ───────────────────────────────────────────────────────

export type PlotElement =
  | LinePlotElement
  | AreaPlotElement
  | BarPlotElement
  | ScatterPlotElement
  | HLinePlotElement
  | VLinePlotElement
  | TextPlotElement
  | AnnotationPlotElement
  | EdgeDistributionElement;

export interface LinePlotElement {
  type: "line";
  points: Point[];
  path: string; // SVG path data
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  alpha: number;
  label?: string;
  zorder: number;
  dataValues?: number[]; // actual y-data values (for tooltip display)
}

export interface AreaPlotElement {
  type: "area";
  points: Point[];
  path: string;
  color: string;
  alpha: number;
  label?: string;
  zorder: number;
}

export interface BarPlotElement {
  type: "bar";
  bars: BarRect[];
  seriesIndex: number;
  color: string;
  label?: string;
  zorder: number;
  xLabels?: string[]; // x-axis labels per bar (for tooltip display)
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  index: number;
}

export interface ScatterPlotElement {
  type: "scatter";
  points: ScatterPoint[];
  color: string;
  marker: string;
  alpha: number;
  label?: string;
  zorder: number;
}

export interface ScatterPoint {
  x: number;
  y: number;
  size: number;
  color?: string; // per-point override
}

export interface HLinePlotElement {
  type: "hline";
  y: number;
  xMin: number;
  xMax: number;
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  zorder: number;
}

export interface VLinePlotElement {
  type: "vline";
  x: number;
  yMin: number;
  yMax: number;
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  zorder: number;
}

export interface TextPlotElement {
  type: "text";
  x: number;
  y: number;
  content: string;
  style: TextStyle;
  anchor: "inherit" | "start" | "middle" | "end";
  rotation?: number;
  zorder: number;
}

export interface AnnotationPlotElement {
  type: "annotation";
  text: string;
  xy: Point;
  xytext?: Point;
  style: TextStyle;
  arrowColor?: string;
  arrowWidth?: number;
  zorder: number;
}

export interface EdgeDistributionBar {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeDistributionAnnotation {
  y: number;
  label: string;
  color: string;
}

export interface EdgeDistributionElement {
  type: "edgeDistribution";
  bars: EdgeDistributionBar[];
  color: string;
  opacity: number;
  annotations: EdgeDistributionAnnotation[];
  areaX: number;
  areaWidth: number;
  zorder: number;
}

// ── Theme ───────────────────────────────────────────────────────────────

export interface Theme {
  name: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
    axis: string;
  };
  grid: {
    color: string;
    width: number;
  };
  axis: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: string;
  };
  title: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number | string;
    letterSpacing: string;
    color: string;
  };
  subtitle: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number | string;
    letterSpacing: string;
    color: string;
  };
  legend: {
    fontFamily: string;
    fontSize: number;
  };
  tooltip: {
    background: string;
    border: string;
    text: string;
    header: string;
    fontFamily: string;
  };
  defaultColors: string[];
  bar: {
    defaultFill: string;
    styles: BarThemeStyle[];
  };
  area: {
    gradientOpacityTop: number;
    gradientOpacityBottom: number;
  };
}

export interface BarThemeStyle {
  fill: string;
  sideGlow: string;
  topGlow: string;
  bottomGlow: string;
  leftEdge: string;
  sparkle: string;
  gradTop: string;
  gradBottom: string;
}

// ── Figure Config ───────────────────────────────────────────────────────

export interface FigureConfig {
  width?: number;
  height?: number;
  theme?: string;
  dpi?: number;
}
