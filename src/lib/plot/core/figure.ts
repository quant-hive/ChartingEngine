import type {
  FigureConfig,
  Scene,
  SubplotScene,
  PlotElement,
  LinePlotElement,
  AreaPlotElement,
  BarPlotElement,
  ScatterPlotElement,
  HLinePlotElement,
  VLinePlotElement,
  TextPlotElement,
  AnnotationPlotElement,
  PlotOptions,
  BarOptions,
  ScatterOptions,
  FillBetweenOptions,
  HistOptions,
  GridOptions,
  LegendOptions,
  TextOptions,
  AnnotateOptions,
  AxisScene,
  GridScene,
  LegendScene,
  LegendEntry,
  LineStyle,
  Rect,
  Theme,
} from "./types";
import { computeTicks, pickLabels, generateTickMarks, scaleValue } from "./scales";
import { computeLayout, computeSubplotBounds, DEFAULT_WIDTH, DEFAULT_HEIGHT } from "./layout";
import { buildLinePath, buildAreaPath, buildFillBetweenPath, buildBarRects, buildScatterPoints, computeHistogramBins } from "./paths";
import { getTheme } from "./theme";

// ── Internal command types ──────────────────────────────────────────────

interface PlotCmd {
  kind: "line";
  xData: number[] | null;
  yData: number[];
  opts: PlotOptions;
}
interface BarCmd {
  kind: "bar";
  xData: number[] | string[];
  yData: number[];
  opts: BarOptions;
}
interface ScatterCmd {
  kind: "scatter";
  xData: number[];
  yData: number[];
  opts: ScatterOptions;
}
interface FillCmd {
  kind: "fill_between";
  xData: number[];
  y1Data: number[];
  y2Data: number | number[];
  opts: FillBetweenOptions;
}
interface HistCmd {
  kind: "hist";
  data: number[];
  opts: HistOptions;
}
interface HLineCmd {
  kind: "hline";
  y: number;
  opts: PlotOptions;
}
interface VLineCmd {
  kind: "vline";
  x: number;
  opts: PlotOptions;
}
interface TextCmd {
  kind: "text";
  x: number;
  y: number;
  content: string;
  opts: TextOptions;
}
interface AnnotateCmd {
  kind: "annotate";
  text: string;
  xy: [number, number];
  xytext?: [number, number];
  opts: AnnotateOptions;
}

type DrawCmd = PlotCmd | BarCmd | ScatterCmd | FillCmd | HistCmd | HLineCmd | VLineCmd | TextCmd | AnnotateCmd;

// ── Axes Class ──────────────────────────────────────────────────────────

export class Axes {
  private commands: DrawCmd[] = [];
  private _title?: string;
  private _subtitle?: string;
  private _xlabel?: string;
  private _ylabel?: string;
  private _xlim?: [number, number];
  private _ylim?: [number, number];
  private _xscale: "linear" | "log" | "symlog" | "category" = "linear";
  private _yscale: "linear" | "log" | "symlog" | "category" = "linear";
  private _xticks?: number[] | string[];
  private _yticks?: number[];
  private _xticklabels?: string[];
  private _grid: GridOptions = { visible: true, axis: "y" };
  private _legend?: LegendOptions;
  private _allXLabels?: string[];
  private _colorIdx = 0;

  constructor(
    private row: number,
    private col: number,
    private theme: Theme
  ) {}

  // ── Matplotlib-like API ───────────────────────────────────────────────

  plot(yData: number[], opts?: PlotOptions): this;
  plot(xData: number[], yData: number[], opts?: PlotOptions): this;
  plot(...args: unknown[]): this {
    let xData: number[] | null = null;
    let yData: number[];
    let opts: PlotOptions = {};

    if (args.length >= 2 && Array.isArray(args[0]) && Array.isArray(args[1])) {
      xData = args[0] as number[];
      yData = args[1] as number[];
      opts = (args[2] as PlotOptions) ?? {};
    } else {
      yData = args[0] as number[];
      opts = (args[1] as PlotOptions) ?? {};
    }

    if (!opts.color) {
      opts.color = this.theme.defaultColors[this._colorIdx % this.theme.defaultColors.length];
      this._colorIdx++;
    }
    this.commands.push({ kind: "line", xData, yData, opts });
    return this;
  }

  bar(xData: number[] | string[], yData: number[], opts?: BarOptions): this {
    this.commands.push({ kind: "bar", xData, yData, opts: opts ?? {} });
    return this;
  }

  scatter(xData: number[], yData: number[], opts?: ScatterOptions): this {
    if (!opts?.color) {
      const color = this.theme.defaultColors[this._colorIdx % this.theme.defaultColors.length];
      this._colorIdx++;
      opts = { ...opts, color };
    }
    this.commands.push({ kind: "scatter", xData, yData, opts: opts ?? {} });
    return this;
  }

  fill_between(xData: number[], y1: number[], y2: number | number[] = 0, opts?: FillBetweenOptions): this {
    this.commands.push({ kind: "fill_between", xData, y1Data: y1, y2Data: y2, opts: opts ?? {} });
    return this;
  }

  hist(data: number[], opts?: HistOptions): this {
    this.commands.push({ kind: "hist", data, opts: opts ?? {} });
    return this;
  }

  axhline(y: number, opts?: PlotOptions): this {
    this.commands.push({ kind: "hline", y, opts: opts ?? {} });
    return this;
  }

  axvline(x: number, opts?: PlotOptions): this {
    this.commands.push({ kind: "vline", x, opts: opts ?? {} });
    return this;
  }

  text(x: number, y: number, content: string, opts?: TextOptions): this {
    this.commands.push({ kind: "text", x, y, content, opts: opts ?? {} });
    return this;
  }

  annotate(text: string, xy: [number, number], xytext?: [number, number], opts?: AnnotateOptions): this {
    this.commands.push({ kind: "annotate", text, xy, xytext, opts: opts ?? {} });
    return this;
  }

  set_title(title: string): this { this._title = title; return this; }
  set_subtitle(subtitle: string): this { this._subtitle = subtitle; return this; }
  set_xlabel(label: string): this { this._xlabel = label; return this; }
  set_ylabel(label: string): this { this._ylabel = label; return this; }
  set_xlim(min: number, max: number): this { this._xlim = [min, max]; return this; }
  set_ylim(min: number, max: number): this { this._ylim = [min, max]; return this; }
  set_xscale(scale: "linear" | "log" | "symlog"): this { this._xscale = scale; return this; }
  set_yscale(scale: "linear" | "log" | "symlog"): this { this._yscale = scale; return this; }
  set_xticks(ticks: number[] | string[], labels?: string[]): this {
    this._xticks = ticks;
    if (labels) this._xticklabels = labels;
    return this;
  }
  set_yticks(ticks: number[]): this { this._yticks = ticks; return this; }

  /** Store full x labels (one per data point) for tooltips */
  set_xticklabels(labels: string[]): this {
    this._allXLabels = labels;
    return this;
  }

  grid(visible: boolean | GridOptions, opts?: GridOptions): this {
    if (typeof visible === "boolean") {
      this._grid = { visible, ...opts };
    } else {
      this._grid = visible;
    }
    return this;
  }

  legend(opts?: LegendOptions): this {
    this._legend = opts ?? {};
    return this;
  }

  // ── Render to scene ───────────────────────────────────────────────────

  _render(bounds: Rect): SubplotScene {
    // Reserve vertical space for title + subtitle above the plot area
    const titleH = this._title ? this.theme.title.fontSize + 4 : 0;
    const subtitleH = this._subtitle ? this.theme.subtitle.fontSize + 4 : 0;
    const headerH = titleH + subtitleH + (titleH || subtitleH ? 6 : 0);

    const layout = computeLayout(bounds.w, bounds.h);
    // SVG viewBox starts at (0,0) — plotArea is relative to subplot origin, NOT figure
    const plotArea = {
      x: layout.plotArea.x,
      y: layout.plotArea.y + headerH,
      w: layout.plotArea.w,
      h: layout.plotArea.h - headerH,
    };

    // Pre-compute histogram bins for bounds computation
    const histResults = new Map<number, { edges: number[]; counts: number[] }>();
    this.commands.forEach((cmd, idx) => {
      if (cmd.kind === "hist") {
        histResults.set(idx, computeHistogramBins(cmd.data, cmd.opts.bins));
      }
    });

    // Collect data bounds
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    let hasBarCmd = false;
    let hasHistCmd = false;
    let histEdges: number[] = [];
    let barSeriesCount = 0;
    let hasStackedBars = false;

    for (let i = 0; i < this.commands.length; i++) {
      const cmd = this.commands[i];
      if (cmd.kind === "line") {
        for (const v of cmd.yData) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        if (cmd.xData) {
          for (const v of cmd.xData) { xMin = Math.min(xMin, v); xMax = Math.max(xMax, v); }
        } else {
          xMin = Math.min(xMin, 0);
          xMax = Math.max(xMax, cmd.yData.length - 1);
        }
      } else if (cmd.kind === "bar") {
        hasBarCmd = true;
        barSeriesCount++;
        if (cmd.opts.bottom) {
          hasStackedBars = true;
          // For stacked bars, the top of each bar is bottom[i] + yData[i]
          for (let j = 0; j < cmd.yData.length; j++) {
            const bot = cmd.opts.bottom[j] ?? 0;
            const top = bot + cmd.yData[j];
            yMin = Math.min(yMin, bot);
            yMax = Math.max(yMax, top);
          }
        } else {
          for (const v of cmd.yData) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        }
        if (typeof cmd.xData[0] === "number") {
          for (const v of cmd.xData as number[]) { xMin = Math.min(xMin, v); xMax = Math.max(xMax, v); }
        }
      } else if (cmd.kind === "scatter") {
        for (const v of cmd.xData) { xMin = Math.min(xMin, v); xMax = Math.max(xMax, v); }
        for (const v of cmd.yData) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
      } else if (cmd.kind === "fill_between") {
        for (const v of cmd.y1Data) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        if (Array.isArray(cmd.y2Data)) {
          for (const v of cmd.y2Data) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
        } else {
          yMin = Math.min(yMin, cmd.y2Data);
          yMax = Math.max(yMax, cmd.y2Data);
        }
      } else if (cmd.kind === "hist") {
        hasHistCmd = true;
        const result = histResults.get(i)!;
        histEdges = result.edges;
        xMin = Math.min(xMin, result.edges[0]);
        xMax = Math.max(xMax, result.edges[result.edges.length - 1]);
        yMin = Math.min(yMin, 0);
        yMax = Math.max(yMax, Math.max(...result.counts) * 1.1);
      }
    }

    // Bar charts should include 0 in y range (but not stacked/candlestick bars with bottom offsets)
    if (hasBarCmd && !hasStackedBars) {
      yMin = Math.min(yMin, 0);
    }

    // Apply user overrides
    if (this._xlim) { xMin = this._xlim[0]; xMax = this._xlim[1]; }
    if (this._ylim) { yMin = this._ylim[0]; yMax = this._ylim[1]; }

    // Compute ticks
    const yTickResult = computeTicks(this._yscale, yMin, yMax, 5);
    if (!this._ylim) { yMin = yTickResult.min; yMax = yTickResult.max; }
    const yRange = yMax - yMin || 1;

    const xTickResult = this._xscale !== "category"
      ? computeTicks(this._xscale, xMin, xMax, 8)
      : { min: xMin, max: xMax, step: 1, ticks: [] as number[] };

    // Build y tick marks
    const yTicks = this._yticks ?? yTickResult.ticks;
    const yTickMarks = generateTickMarks(
      yTicks, yMin, yMax,
      plotArea.y + plotArea.h, plotArea.y, // inverted for SVG
      this._yscale
    );

    // Build x tick marks — handle string labels for all chart types
    let xTickMarks: ReturnType<typeof generateTickMarks>;

    if (this._xticks && typeof this._xticks[0] === "string") {
      const labels = this._xticks as string[];
      if (hasBarCmd) {
        // Center labels under bar groups
        const barCmd = this.commands.find(c => c.kind === "bar") as BarCmd;
        const n = barCmd ? barCmd.yData.length : labels.length;
        const groupW = plotArea.w / n;
        xTickMarks = labels.map((label, i) => ({
          value: i, label,
          position: plotArea.x + i * groupW + groupW / 2,
        }));
      } else {
        // Find max data points to avoid labels beyond data
        let maxDataPts = labels.length;
        for (const cmd of this.commands) {
          if (cmd.kind === "line") maxDataPts = Math.min(maxDataPts, cmd.yData.length);
          else if (cmd.kind === "fill_between") maxDataPts = Math.min(maxDataPts, cmd.y1Data.length);
        }
        const trimmed = labels.slice(0, maxDataPts);
        // Evenly space labels across the plot width
        xTickMarks = trimmed.map((label, i) => ({
          value: i, label,
          position: plotArea.x + (trimmed.length <= 1 ? plotArea.w / 2 : (i / (trimmed.length - 1)) * plotArea.w),
        }));
      }
    } else if (hasBarCmd) {
      const barCmd = this.commands.find(c => c.kind === "bar") as BarCmd;
      if (barCmd && typeof barCmd.xData[0] === "string") {
        const labels = barCmd.xData as string[];
        const groupW = plotArea.w / labels.length;
        xTickMarks = labels.map((label, i) => ({
          value: i, label,
          position: plotArea.x + i * groupW + groupW / 2,
        }));
      } else {
        xTickMarks = generateTickMarks(
          (this._xticks as number[]) ?? xTickResult.ticks, xMin, xMax,
          plotArea.x, plotArea.x + plotArea.w,
          this._xscale
        );
      }
    } else if (hasHistCmd && !this._xticks) {
      // For histograms, use actual bin edges as ticks so labels align with bar starts.
      // Thin out edges if there are too many (target ~6-8 labels max).
      const maxLabels = 8;
      let edgeTicks: number[];
      if (histEdges.length <= maxLabels) {
        edgeTicks = histEdges;
      } else {
        // Pick evenly-spaced edges including first and last
        const step = Math.ceil(histEdges.length / maxLabels);
        edgeTicks = histEdges.filter((_, i) => i % step === 0);
        if (edgeTicks[edgeTicks.length - 1] !== histEdges[histEdges.length - 1]) {
          edgeTicks.push(histEdges[histEdges.length - 1]);
        }
      }
      xTickMarks = generateTickMarks(
        edgeTicks, xMin, xMax,
        plotArea.x, plotArea.x + plotArea.w,
        this._xscale,
        (v: number) => {
          const r = parseFloat(v.toFixed(2));
          return String(Number.isInteger(r) ? r : r);
        }
      );
    } else {
      // Filter numeric ticks to data range so labels don't extend beyond data
      const rawTicks = (this._xticks as number[]) ?? xTickResult.ticks;
      const filteredXTicks = this._xticks ? rawTicks : rawTicks.filter(t => t >= xMin - 1e-9 && t <= xMax + 1e-9);
      xTickMarks = generateTickMarks(
        filteredXTicks, xMin, xMax,
        plotArea.x, plotArea.x + plotArea.w,
        this._xscale
      );
    }

    // Axes scenes — scale font size proportionally so charts with larger
    // viewBoxes render visually-consistent labels when both scale to fit.
    const fontScale = bounds.w / DEFAULT_WIDTH;
    const tickStyle = {
      fontFamily: this.theme.axis.fontFamily,
      fontSize: Math.round(this.theme.axis.fontSize * fontScale),
      fontWeight: this.theme.axis.fontWeight,
      letterSpacing: this.theme.axis.letterSpacing,
      color: this.theme.text.muted,
    };

    const xAxis: AxisScene = {
      visible: true,
      label: this._xlabel,
      ticks: xTickMarks,
      tickStyle,
      scale: this._xscale,
      min: xMin,
      max: xMax,
      range: xMax - xMin,
    };

    const yAxis: AxisScene = {
      visible: true,
      label: this._ylabel,
      ticks: yTickMarks,
      tickStyle,
      scale: this._yscale,
      min: yMin,
      max: yMax,
      range: yRange,
    };

    // Grid
    const gridScene: GridScene = {
      visible: this._grid.visible !== false,
      axis: this._grid.axis ?? "y",
      lines: [],
    };
    if (gridScene.visible) {
      const gridAxis = gridScene.axis;
      if (gridAxis === "y" || gridAxis === "both") {
        for (const tick of yTickMarks) {
          gridScene.lines.push({
            x1: plotArea.x,
            y1: tick.position,
            x2: plotArea.x + plotArea.w,
            y2: tick.position,
            color: this._grid.color ?? this.theme.grid.color,
            width: this._grid.linewidth ?? this.theme.grid.width,
          });
        }
      }
      if (gridAxis === "x" || gridAxis === "both") {
        for (const tick of xTickMarks) {
          gridScene.lines.push({
            x1: tick.position,
            y1: plotArea.y,
            x2: tick.position,
            y2: plotArea.y + plotArea.h,
            color: this._grid.color ?? this.theme.grid.color,
            width: this._grid.linewidth ?? this.theme.grid.width,
          });
        }
      }
    }

    // Build plot elements
    const elements: PlotElement[] = [];
    const legendEntries: LegendEntry[] = [];
    let zorder = 0;
    let barSeriesIdx = 0;
    const xRange = xMax - xMin || 1;

    for (let cmdIdx = 0; cmdIdx < this.commands.length; cmdIdx++) {
      const cmd = this.commands[cmdIdx];
      zorder++;
      switch (cmd.kind) {
        case "line": {
          let path: string;
          let points: { x: number; y: number }[];

          if (cmd.xData) {
            // Custom x data — map using x scale
            points = cmd.yData.map((v, i) => ({
              x: plotArea.x + scaleValue(this._xscale, cmd.xData![i], xMin, xMax, 0, plotArea.w),
              y: plotArea.y + plotArea.h - scaleValue(this._yscale, v, yMin, yMax, 0, plotArea.h),
            }));
            path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
          } else {
            ({ path, points } = buildLinePath(cmd.yData, plotArea, yMin, yMax, this._yscale));
          }
          const color = cmd.opts.color ?? this.theme.defaultColors[0];
          elements.push({
            type: "line",
            points,
            path,
            color,
            lineWidth: cmd.opts.linewidth ?? 1,
            lineStyle: (cmd.opts.linestyle ?? "solid") as LineStyle,
            alpha: cmd.opts.alpha ?? 1,
            label: cmd.opts.label,
            zorder: cmd.opts.zorder ?? zorder,
            dataValues: [...cmd.yData],
          } satisfies LinePlotElement);
          if (cmd.opts.label) {
            legendEntries.push({ label: cmd.opts.label, color, type: "line", lineStyle: cmd.opts.linestyle as LineStyle, lineWidth: cmd.opts.linewidth });
          }
          break;
        }
        case "bar": {
          const barWidth = cmd.opts.width ?? 20;
          const color = (typeof cmd.opts.color === "string" ? cmd.opts.color : cmd.opts.color?.[0]) ?? this.theme.bar.styles[barSeriesIdx % this.theme.bar.styles.length].fill;
          // Stacked bars: all series at same x position (seriesIndex=0, numSeries=1)
          const effectiveIdx = hasStackedBars ? 0 : barSeriesIdx;
          const effectiveCount = hasStackedBars ? 1 : barSeriesCount;
          const bars = buildBarRects(cmd.yData, effectiveIdx, effectiveCount, plotArea, yMin, yMax, barWidth, 3, cmd.opts.bottom);
          const xLabels = cmd.xData
            ? cmd.xData.map(x => String(x))
            : cmd.yData.map((_, i) => String(i));
          elements.push({
            type: "bar",
            bars: bars.map((b, i) => ({ ...b, value: cmd.yData[i], index: i })),
            seriesIndex: barSeriesIdx,
            color,
            label: cmd.opts.label,
            zorder: cmd.opts.zorder ?? zorder,
            xLabels,
          } satisfies BarPlotElement);
          if (cmd.opts.label) {
            const style = this.theme.bar.styles[barSeriesIdx % this.theme.bar.styles.length];
            legendEntries.push({ label: cmd.opts.label, color, type: "bar", barGradient: { top: style.gradTop, bottom: style.gradBottom } });
          }
          barSeriesIdx++;
          break;
        }
        case "scatter": {
          const color = (typeof cmd.opts.color === "string" ? cmd.opts.color : undefined) ?? this.theme.defaultColors[0];
          const pts = buildScatterPoints(cmd.xData, cmd.yData, plotArea, xMin, xMax, yMin, yMax, cmd.opts.s, this._xscale, this._yscale);
          elements.push({
            type: "scatter",
            points: pts.map(p => ({ ...p, color: undefined })),
            color,
            marker: cmd.opts.marker ?? "o",
            alpha: cmd.opts.alpha ?? 1,
            label: cmd.opts.label,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies ScatterPlotElement);
          if (cmd.opts.label) {
            legendEntries.push({ label: cmd.opts.label, color, type: "scatter" });
          }
          break;
        }
        case "fill_between": {
          let path: string;
          let points: { x: number; y: number }[];

          if (Array.isArray(cmd.y2Data)) {
            // Fill between two arrays
            ({ path, points } = buildFillBetweenPath(cmd.y1Data, cmd.y2Data, plotArea, yMin, yMax, this._yscale, cmd.xData, xMin, xMax, this._xscale));
          } else {
            // Fill from data to constant baseline
            ({ path, points } = buildAreaPath(cmd.y1Data, plotArea, yMin, yMax, cmd.y2Data, this._yscale, cmd.xData, xMin, xMax, this._xscale));
          }
          const color = cmd.opts.color ?? this.theme.defaultColors[0];
          elements.push({
            type: "area",
            points,
            path,
            color,
            alpha: cmd.opts.alpha ?? 0.15,
            label: cmd.opts.label,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies AreaPlotElement);
          if (cmd.opts.label) {
            legendEntries.push({ label: cmd.opts.label, color, type: "area" });
          }
          break;
        }
        case "hist": {
          const result = histResults.get(cmdIdx)!;
          const { edges, counts } = result;
          const n = counts.length;
          const color = cmd.opts.color ?? this.theme.defaultColors[0];

          // Position histogram bars according to bin edges (not indices)
          const bars = counts.map((count, i) => {
            const barX = plotArea.x + ((edges[i] - xMin) / xRange) * plotArea.w;
            const barW = ((edges[i + 1] - edges[i]) / xRange) * plotArea.w * 0.92;
            const barY = plotArea.y + plotArea.h - ((count - yMin) / yRange) * plotArea.h;
            const barH = Math.max(1, ((count - yMin) / yRange) * plotArea.h);
            return { x: barX, y: barY, width: barW, height: barH, value: count, index: i };
          });

          elements.push({
            type: "bar",
            bars,
            seriesIndex: 0,
            color,
            label: cmd.opts.label,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies BarPlotElement);
          break;
        }
        case "hline": {
          const py = plotArea.y + plotArea.h - ((cmd.y - yMin) / yRange) * plotArea.h;
          elements.push({
            type: "hline",
            y: py,
            xMin: plotArea.x,
            xMax: plotArea.x + plotArea.w,
            color: cmd.opts.color ?? this.theme.text.secondary,
            lineWidth: cmd.opts.linewidth ?? 1,
            lineStyle: (cmd.opts.linestyle ?? "dashed") as LineStyle,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies HLinePlotElement);
          break;
        }
        case "vline": {
          const px = plotArea.x + ((cmd.x - xMin) / xRange) * plotArea.w;
          elements.push({
            type: "vline",
            x: px,
            yMin: plotArea.y,
            yMax: plotArea.y + plotArea.h,
            color: cmd.opts.color ?? this.theme.text.secondary,
            lineWidth: cmd.opts.linewidth ?? 1,
            lineStyle: (cmd.opts.linestyle ?? "dashed") as LineStyle,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies VLinePlotElement);
          break;
        }
        case "text": {
          const px = plotArea.x + ((cmd.x - xMin) / xRange) * plotArea.w;
          const py = plotArea.y + plotArea.h - ((cmd.y - yMin) / yRange) * plotArea.h;
          elements.push({
            type: "text",
            x: px,
            y: py,
            content: cmd.content,
            style: {
              fontFamily: cmd.opts.fontfamily ?? this.theme.axis.fontFamily,
              fontSize: cmd.opts.fontsize ?? 12,
              fontWeight: cmd.opts.fontweight ?? 400,
              color: cmd.opts.color ?? this.theme.text.primary,
            },
            anchor: ({ left: "start", center: "middle", right: "end" } as const)[cmd.opts.ha ?? "left"] ?? "start",
            rotation: cmd.opts.rotation,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies TextPlotElement);
          break;
        }
        case "annotate": {
          const [annotX, annotY] = cmd.xy;
          const px = plotArea.x + ((annotX - xMin) / xRange) * plotArea.w;
          const py = plotArea.y + plotArea.h - ((annotY - yMin) / yRange) * plotArea.h;
          let textX = px, textY = py;
          if (cmd.xytext) {
            textX = plotArea.x + ((cmd.xytext[0] - xMin) / xRange) * plotArea.w;
            textY = plotArea.y + plotArea.h - ((cmd.xytext[1] - yMin) / yRange) * plotArea.h;
          }
          elements.push({
            type: "annotation",
            text: cmd.text,
            xy: { x: px, y: py },
            xytext: cmd.xytext ? { x: textX, y: textY } : undefined,
            style: {
              fontFamily: this.theme.axis.fontFamily,
              fontSize: cmd.opts.fontsize ?? 11,
              fontWeight: cmd.opts.fontweight ?? 400,
              color: cmd.opts.color ?? this.theme.text.primary,
            },
            arrowColor: cmd.opts.arrowprops?.color,
            arrowWidth: cmd.opts.arrowprops?.lw,
            zorder: cmd.opts.zorder ?? zorder,
          } satisfies AnnotationPlotElement);
          break;
        }
      }
    }

    // Sort by zorder
    elements.sort((a, b) => a.zorder - b.zorder);

    // Legend
    let legendScene: LegendScene | undefined;
    if (this._legend && legendEntries.length > 0) {
      legendScene = {
        entries: legendEntries,
        position: this._legend.loc ?? "best",
      };
    }

    return {
      row: this.row,
      col: this.col,
      bounds,
      plotArea,
      title: this._title,
      titleStyle: this._title ? {
        fontFamily: this.theme.title.fontFamily,
        fontSize: Math.round(this.theme.title.fontSize * fontScale),
        fontWeight: this.theme.title.fontWeight,
        letterSpacing: this.theme.title.letterSpacing,
        color: this.theme.title.color,
      } : undefined,
      subtitle: this._subtitle,
      subtitleStyle: this._subtitle ? {
        fontFamily: this.theme.subtitle.fontFamily,
        fontSize: Math.round(this.theme.subtitle.fontSize * fontScale),
        fontWeight: this.theme.subtitle.fontWeight,
        letterSpacing: this.theme.subtitle.letterSpacing,
        color: this.theme.subtitle.color,
      } : undefined,
      xAxis,
      yAxis,
      grid: gridScene,
      elements,
      legend: legendScene,
    };
  }
}

// ── Figure Class ────────────────────────────────────────────────────────

export class Figure {
  private width: number;
  private height: number;
  private theme: Theme;
  private nrows = 1;
  private ncols = 1;
  private axesMap = new Map<string, Axes>();

  constructor(config?: FigureConfig) {
    this.width = config?.width ?? DEFAULT_WIDTH;
    this.height = config?.height ?? DEFAULT_HEIGHT;
    this.theme = getTheme(config?.theme ?? "flash-dark");
  }

  subplot(nrows: number, ncols: number, index: number): Axes {
    this.nrows = Math.max(this.nrows, nrows);
    this.ncols = Math.max(this.ncols, ncols);
    const row = Math.floor((index - 1) / ncols);
    const col = (index - 1) % ncols;
    const key = `${row}-${col}`;
    if (!this.axesMap.has(key)) {
      this.axesMap.set(key, new Axes(row, col, this.theme));
    }
    return this.axesMap.get(key)!;
  }

  /** Shorthand: get the single axes (like plt.gca()) */
  gca(): Axes {
    return this.subplot(1, 1, 1);
  }

  /** Convenience: add_subplot is an alias for subplot */
  add_subplot(nrows: number, ncols: number, index: number): Axes {
    return this.subplot(nrows, ncols, index);
  }

  set_size(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  render(): Scene {
    const subplotBounds = computeSubplotBounds(this.nrows, this.ncols, this.width, this.height);
    const subplots: SubplotScene[] = [];

    for (const [, axes] of this.axesMap) {
      const r = (axes as unknown as { row: number }).row;
      const c = (axes as unknown as { col: number }).col;
      subplots.push(axes._render(subplotBounds[r][c]));
    }

    return {
      width: this.width,
      height: this.height,
      theme: this.theme.name,
      subplots,
    };
  }

  toJSON(): object {
    return this.render();
  }
}

// ── Convenience Functions (matplotlib top-level style) ──────────────────

export function figure(config?: FigureConfig): Figure {
  return new Figure(config);
}
