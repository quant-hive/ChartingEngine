// ── Flash Plot Engine ─────────────────────────────────────────────────────
// Matplotlib-like charting with custom Flash aesthetics.
//
// Usage:
//   import { figure, FlashChart } from "@/lib/plot";
//
//   const fig = figure();
//   const ax = fig.subplot(1, 1, 1);
//   ax.plot(data, { color: "#d4d4d4", label: "Strategy" });
//   ax.set_title("Returns");
//   const scene = fig.render();
//   // <FlashChart scene={scene} />

// Core (framework-agnostic)
export {
  Figure, Axes, figure,
  renderChart, DEFAULT_COLORS, extractPieSlices, extractCandlestickData, extractSurfaceSpec,
  getTheme, registerTheme, listThemes, FLASH_DARK,
  computeTicks, computeLinearTicks, computeLogTicks, pickLabels, linearScale, logScale, scaleValue, generateTickMarks,
  computeLayout, computeSubplotBounds, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_PADDING, DEFAULT_INSET,
  buildLinePath, buildAreaPath, buildFillBetweenPath, buildBarRects, buildScatterPoints, computeHistogramBins, dashArray, mapPoint,
} from "./core";

// Re-export all types
export type {
  ChartSpec, ChartType, SeriesSpec, PieSliceSpec, SurfaceSpec, HeatmapSpec, AxisSpec, LegendSpec,
  Point, Rect, Padding,
  ScaleType, TickMark, AxisConfig,
  LineStyle, PlotOptions, BarOptions, ScatterOptions, FillBetweenOptions,
  HistOptions, HeatmapOptions, PieOptions, BoxplotOptions,
  AnnotateOptions, TextOptions, GridOptions, LegendOptions,
  Scene, SubplotScene, PlotElement,
  LinePlotElement, AreaPlotElement, BarPlotElement, ScatterPlotElement,
  HLinePlotElement, VLinePlotElement, TextPlotElement, AnnotationPlotElement,
  BarRect, ScatterPoint,
  AxisScene, GridScene, GridLine, LegendScene, LegendEntry,
  TextStyle,
  Theme, BarThemeStyle,
  FigureConfig,
  EdgeDistributionScene, EdgeDistributionBar, EdgeDistributionAnnotation,
} from "./core";

// Validator
export { validateChartSpec, ChartSpecSchema, HEX_COLOR_REGEX, CHART_TYPES } from "./core";
export type { ValidationResult, ValidationError } from "./core";

// React renderer
export { FlashChart, PieChart, Surface3D, CandlestickChart, useChartAnimation, shimmerFill } from "./react";
export type { FlashChartProps, PieChartProps, PieSlice, Surface3DProps, SurfaceMode, CandlestickChartProps, CandlestickData, AnimPhase } from "./react";
