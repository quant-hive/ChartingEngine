// ── Core Public API ─────────────────────────────────────────────────────
// Framework-agnostic plotting engine with matplotlib-like API.

export { Figure, Axes, figure } from "./figure";
export { renderChart, DEFAULT_COLORS, extractPieSlices, extractCandlestickData, extractSurfaceSpec } from "./renderChart";
export type { ChartSpec, ChartType, SeriesSpec, PieSliceSpec, SurfaceSpec, HeatmapSpec, AxisSpec, LegendSpec } from "./renderChart";
export { getTheme, registerTheme, listThemes, FLASH_DARK } from "./theme";
export { computeTicks, computeLinearTicks, computeLogTicks, pickLabels, linearScale, logScale, scaleValue, generateTickMarks } from "./scales";
export { computeLayout, computeSubplotBounds, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_PADDING, DEFAULT_INSET } from "./layout";
export { buildLinePath, buildAreaPath, buildFillBetweenPath, buildBarRects, buildScatterPoints, computeHistogramBins, dashArray, mapPoint } from "./paths";
export { ChartSpecSchema, validateChartSpec, HEX_COLOR_REGEX, CHART_TYPES } from "./chartSpecSchema";
export type { ValidationResult, ValidationError } from "./chartSpecSchema";

// Re-export all types
export type {
  // Geometry
  Point, Rect, Padding,
  // Scales
  ScaleType, TickMark, AxisConfig,
  // Plot options
  LineStyle, PlotOptions, BarOptions, ScatterOptions, FillBetweenOptions,
  HistOptions, HeatmapOptions, PieOptions, BoxplotOptions,
  AnnotateOptions, TextOptions, GridOptions, LegendOptions,
  // Scene graph
  Scene, SubplotScene, PlotElement,
  LinePlotElement, AreaPlotElement, BarPlotElement, ScatterPlotElement,
  HLinePlotElement, VLinePlotElement, TextPlotElement, AnnotationPlotElement,
  BarRect, ScatterPoint,
  AxisScene, GridScene, GridLine, LegendScene, LegendEntry,
  TextStyle,
  // Theme
  Theme, BarThemeStyle,
  // Config
  FigureConfig,
} from "./types";
