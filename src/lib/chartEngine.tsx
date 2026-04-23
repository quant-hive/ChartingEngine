"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { fetchGraphData, type GraphApiResponse } from "./graphApi";
import { FlashChart, renderChart, type ChartSpec, PieChart, extractPieSlices, Surface3D, type SurfaceMode, CandlestickChart, extractCandlestickData } from "./plot";
import { FLASH_DARK } from "./plot/core";
import { createChart, getBacktestCharts } from "./api";

const CHART_FONT = "var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif";

// ── Chart Types (backward compat) ────────────────────────────────────────

export type ChartType = "line" | "bar";

export interface ChartSeries {
  label: string;
  data: number[];
  color: string;
  fillOpacity: number;
}

export interface ChartConfig {
  title: string;
  xLabels: string[];       // subset for axis display
  allXLabels: string[];    // full labels, one per data point (for tooltips)
  yMin: number;
  yMax: number;
  yStep: number;
  series: ChartSeries[];
}

// ── Auto-axis computation ───────────────────────────────────────────────

function niceNum(value: number, round: boolean): number {
  const exp = Math.floor(Math.log10(Math.abs(value) || 1));
  const frac = value / Math.pow(10, exp);
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exp);
}

function computeAxisTicks(dataMin: number, dataMax: number, targetTicks = 5) {
  if (dataMin === dataMax) {
    dataMin -= 1;
    dataMax += 1;
  }
  const range = niceNum(dataMax - dataMin, false);
  const step = niceNum(range / (targetTicks - 1), true);
  const yMin = Math.floor(dataMin / step) * step;
  const yMax = Math.ceil(dataMax / step) * step;
  return { yMin, yMax, yStep: step };
}

function pickXLabels(labels: string[], maxLabels = 8): string[] {
  if (labels.length <= maxLabels) return labels;
  const step = (labels.length - 1) / (maxLabels - 1);
  const picked: string[] = [];
  for (let i = 0; i < maxLabels; i++) {
    picked.push(labels[Math.round(i * step)]);
  }
  return picked;
}

export function apiToChartConfig(api: GraphApiResponse): ChartConfig {
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of api.series) {
    for (const v of s.data) {
      if (v < globalMin) globalMin = v;
      if (v > globalMax) globalMax = v;
    }
  }
  const { yMin, yMax, yStep } = computeAxisTicks(globalMin, globalMax);
  const xLabels = pickXLabels(api.xLabels);
  return {
    title: api.title,
    xLabels,
    allXLabels: api.xLabels,
    yMin,
    yMax,
    yStep,
    series: api.series,
  };
}

// ── Sanitize backend-generated Scene for FlashChart ─────────────────────
// The backend produces Scene JSON with raw numeric x-axis ticks (0,1,2,...1211)
// which overwhelms the renderer. This function downsamples x-axis ticks to
// ~8 period labels and removes x-axis grid lines for clean rendering.

function realignLineElements(subplot: Record<string, unknown>): void {
  const plotArea = subplot.plotArea as { x?: number; y?: number; w?: number; h?: number } | undefined;
  const yAxis = subplot.yAxis as { min?: number; max?: number; scale?: string } | undefined;
  const elements = subplot.elements as Record<string, unknown>[] | undefined;
  if (!plotArea?.w || !plotArea?.h || !elements?.length) return;

  const paX = plotArea.x ?? 0;
  const paY = plotArea.y ?? 0;
  const paW = plotArea.w;
  const paH = plotArea.h;

  for (const el of elements) {
    if (el.type !== "line" && el.type !== "area") continue;
    const dataValues = el.dataValues as number[] | undefined;
    if (!dataValues?.length || dataValues.length < 2) continue;

    const yMin = yAxis?.min ?? Math.min(...dataValues);
    const yMax = yAxis?.max ?? Math.max(...dataValues);
    const yRange = yMax - yMin || 1;

    const n = dataValues.length;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const x = paX + (i / (n - 1)) * paW;
      const y = paY + paH - ((dataValues[i] - yMin) / yRange) * paH;
      points.push({ x, y });
    }

    el.points = points;
    if (el.type === "line") {
      el.path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    } else if (el.type === "area") {
      const baseY = paY + paH;
      const linePart = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      el.path = `${linePart} L${points[n - 1].x.toFixed(1)},${baseY.toFixed(1)} L${points[0].x.toFixed(1)},${baseY.toFixed(1)} Z`;
    }
  }
}

export function sanitizeApiScene(scene: Record<string, unknown>): Record<string, unknown> {
  if (!scene?.subplots || !Array.isArray(scene.subplots)) return scene;

  const sanitized = JSON.parse(JSON.stringify(scene));

  for (const subplot of sanitized.subplots as Record<string, unknown>[]) {
    realignLineElements(subplot);

    const xAxis = subplot.xAxis as { ticks?: { value: number; label: string; position: number }[]; min?: number; max?: number; range?: number } | undefined;
    const yAxis = subplot.yAxis as { ticks?: { value: number; label: string; position: number }[]; min?: number; max?: number; range?: number } | undefined;
    const plotArea = subplot.plotArea as { x?: number; y?: number; w?: number; h?: number } | undefined;
    const elements = subplot.elements as Record<string, unknown>[] | undefined;

    // ── X-axis tick thinning (only when > 10 ticks) ──
    if (xAxis?.ticks && xAxis.ticks.length > 10) {
      const ticks = xAxis.ticks;
      const maxTicks = 8;

      const allNumeric = ticks.every((t) => /^\d+(\.\d+)?$/.test(t.label));

      if (allNumeric && ticks.length > maxTicks) {
        const total = ticks.length;
        const step = Math.max(1, Math.floor(total / maxTicks));
        const picked: typeof ticks = [];
        for (let i = 0; i < total; i += step) {
          const t = ticks[i];
          const idx = Math.round(t.value);
          let label: string;
          if (total > 500) {
            const yearsFromStart = idx / 252;
            if (yearsFromStart < 0.1) label = "Start";
            else label = `Y${yearsFromStart.toFixed(1)}`;
          } else if (total > 60) {
            label = `M${idx}`;
          } else {
            label = `${idx}`;
          }
          picked.push({ ...t, label });
        }
        if (picked.length > 0 && picked[picked.length - 1] !== ticks[total - 1]) {
          const last = ticks[total - 1];
          const idx = Math.round(last.value);
          const yearsFromStart = idx / 252;
          const label = total > 500 ? `Y${yearsFromStart.toFixed(1)}` : `${idx}`;
          picked.push({ ...last, label });
        }
        xAxis.ticks = picked;
      } else if (!allNumeric && ticks.length > maxTicks) {
        const step = Math.max(1, Math.floor(ticks.length / maxTicks));
        const picked: typeof ticks = [];
        for (let i = 0; i < ticks.length; i += step) {
          picked.push(ticks[i]);
        }
        if (picked[picked.length - 1] !== ticks[ticks.length - 1]) {
          picked.push(ticks[ticks.length - 1]);
        }
        xAxis.ticks = picked;
      }

      const grid = subplot.grid as { lines?: { x1: number; x2: number }[]; axis?: string } | undefined;
      if (grid?.lines && grid.axis !== "y") {
        const xGridLines = grid.lines.filter((l) => l.x1 === l.x2);
        if (xGridLines.length > 10) {
          const yGridLines = grid.lines.filter((l) => l.x1 !== l.x2);
          const xStep = Math.max(1, Math.floor(xGridLines.length / maxTicks));
          const thinned = xGridLines.filter((_, i) => i % xStep === 0);
          grid.lines = [...yGridLines, ...thinned];
        }
      }
    }

    // ── Element processing: line widths, bar sizing, histogram Y-rescale ──
    if (elements && plotArea?.w && plotArea?.h) {
      type BarItem = { width?: number; x?: number; height?: number; y?: number; value?: number };
      const barEntries: { el: Record<string, unknown>; bars: BarItem[]; isHistogram: boolean }[] = [];

      for (const el of elements) {
        if (el.type === "line" && typeof el.lineWidth === "number") {
          el.lineWidth = Math.max(0.5, el.lineWidth * 0.6);
        }
        if (el.type === "bar") {
          const bars = el.bars as BarItem[] | undefined;
          if (!bars?.length) continue;
          const isHistogram = bars.length > 10 && bars.every((b) =>
            typeof b.width === "number" && Math.abs(b.width - (bars[0].width ?? 0)) < 1
          );
          barEntries.push({ el, bars, isHistogram });
        }
      }

      // Normalize widths: ALL non-histogram bar series must share one width
      const grouped = barEntries.filter(b => !b.isHistogram);
      if (grouped.length > 1) {
        const allWidths = grouped.flatMap(b => b.bars.map(bar => bar.width ?? 0)).filter(w => w > 0);
        if (allWidths.length > 0) {
          const uniformW = Math.min(...allWidths);
          for (const { bars } of grouped) {
            for (const bar of bars) {
              if (typeof bar.width === "number" && bar.width !== uniformW) {
                const oldW = bar.width;
                bar.width = uniformW;
                if (typeof bar.x === "number") {
                  bar.x += (oldW - uniformW) / 2;
                }
              }
            }
          }
        }
      } else if (grouped.length === 1) {
        const { bars } = grouped[0];
        const groupW = plotArea.w / bars.length;
        const autoW = Math.min(60, Math.max(4, groupW * 0.6));
        for (const bar of bars) {
          if (typeof bar.width === "number") {
            const oldW = bar.width;
            bar.width = autoW;
            if (typeof bar.x === "number") {
              bar.x += (oldW - autoW) / 2;
            }
          }
        }
      }

      for (const { bars, isHistogram } of barEntries) {
          // Smart Y-axis rescale for skewed histograms:
          // If the tallest bar is >5x the second tallest, cap the Y-axis to
          // make small bars visible — the outlier bar extends above with a
          // clipped indicator.
          if (isHistogram && yAxis?.ticks) {
            const values = bars.map((b) => b.value ?? 0).filter((v) => v > 0);
            if (values.length >= 2) {
              const sorted = [...values].sort((a, b) => b - a);
              const maxVal = sorted[0];
              const secondMax = sorted[1];
              const skewRatio = maxVal / Math.max(1, secondMax);

              if (skewRatio > 5) {
                // Cap Y-axis at ~2x the second-tallest value so small bars become visible
                const capVal = Math.ceil(secondMax * 2.5);
                const paY = plotArea.y ?? 0;
                const paH = plotArea.h;
                const baseline = paY + paH;

                for (const bar of bars) {
                  const v = bar.value ?? 0;
                  if (v <= 0) continue;
                  const ratio = Math.min(v, capVal) / capVal;
                  bar.height = Math.max(4, ratio * paH);
                  bar.y = baseline - bar.height;
                }

                // Regenerate Y-axis ticks for the capped range
                const nTicks = 5;
                const tickStep = capVal / (nTicks - 1);
                const newTicks: typeof yAxis.ticks = [];
                for (let i = 0; i < nTicks; i++) {
                  const val = Math.round(i * tickStep);
                  const pos = baseline - (val / capVal) * paH;
                  newTicks.push({ value: val, label: String(val), position: pos });
                }
                yAxis.ticks = newTicks;
                yAxis.max = capVal;
                if (yAxis.range !== undefined) yAxis.range = capVal - (yAxis.min ?? 0);

                // Regenerate horizontal grid lines to match new ticks
                const grid = subplot.grid as { lines?: { x1: number; y1: number; x2: number; y2: number; color: string; width: number }[]; visible?: boolean; axis?: string } | undefined;
                if (grid?.lines) {
                  const xGridLines = grid.lines.filter((l) => l.x1 === l.x2);
                  const paX = plotArea.x ?? 0;
                  const newYLines = newTicks.map((t) => ({
                    x1: paX, y1: t.position, x2: paX + (plotArea.w ?? 0), y2: t.position,
                    color: "#2a2a2a", width: 0.3,
                  }));
                  grid.lines = [...xGridLines, ...newYLines];
                }

                // Mark the subplot so FlashChart knows it has a capped Y-axis
                (subplot as Record<string, unknown>)._yCapValue = capVal;
                (subplot as Record<string, unknown>)._yMaxValue = maxVal;
              }
            }
          }

          // Ensure non-zero bars have a minimum visible height
          const minH = Math.max(4, plotArea.h * 0.02);
          for (const bar of bars) {
            if (typeof bar.height === "number" && bar.height > 0 && bar.height < minH) {
              const oldH = bar.height;
              bar.height = minH;
              if (typeof bar.y === "number") {
                bar.y -= (minH - oldH);
              }
            }
          }
      }
    }
  }

  return sanitized;
}

// ── Legacy mock data (used by ResponseExpanded) ─────────────────────────

export const MOCK_CHARTS: ChartConfig[] = [
  apiToChartConfig({
    title: "Strategy vs Benchmark.",
    xLabels: [
      "Jun 20", "Jul 20", "Aug 20", "Sep 20", "Oct 20", "Nov 20",
      "Dec 20", "Jan 21", "Feb 21", "Mar 21", "Apr 21", "May 21",
      "Jun 21", "Jul 21", "Aug 21", "Sep 21", "Oct 21", "Nov 21",
      "Dec 21", "Jan 22", "Feb 22", "Mar 22", "Apr 22", "May 22",
      "Jun 22", "Jul 22", "Aug 22", "Sep 22", "Oct 22", "Nov 22",
      "Dec 22", "Jan 23", "Feb 23", "Mar 23", "Apr 23", "May 23",
      "Jun 23", "Jul 23", "Aug 23", "Sep 23", "Oct 23", "Nov 23",
    ],
    series: [
      {
        label: "Strategy", color: "#d4d4d4", fillOpacity: 1,
        data: [
          0, 5, -8, 15, 10, 25, 18, 55, 35, 80, 45, 30, 20, 50, 38, 25,
          15, 10, 18, 30, 22, 15, 55, 40, 65, 20, 38, 50, 35, 80, 110, 60,
          95, 75, 130, 105, 85, 140, 120, 100, 15, 10, 20, 12,
        ],
      },
      {
        label: "Benchmark", color: "#707070", fillOpacity: 0,
        data: [
          5, 8, 10, 12, 15, 14, 16, 18, 15, 20, 18, 14, 16, 15, 12, 18,
          16, 14, 15, 18, 16, 14, 12, 15, 18, 16, 14, 15, 18, 16, 14, 15,
          18, 16, 14, 15, 18, 16, 15, 14, 12, 15, 14, 10,
        ],
      },
    ],
  }),
  apiToChartConfig({
    title: "Drawdown.",
    xLabels: [
      "Jun 20", "Jul 20", "Aug 20", "Sep 20", "Oct 20", "Nov 20",
      "Dec 20", "Jan 21", "Feb 21", "Mar 21", "Apr 21", "May 21",
      "Jun 21", "Jul 21", "Aug 21", "Sep 21", "Oct 21", "Nov 21",
      "Dec 21", "Jan 22", "Feb 22", "Mar 22", "Apr 22", "May 22",
      "Jun 22", "Jul 22", "Aug 22", "Sep 22", "Oct 22", "Nov 22",
      "Dec 22", "Jan 23", "Feb 23", "Mar 23", "Apr 23", "May 23",
      "Jun 23", "Jul 23", "Aug 23", "Sep 23",
    ],
    series: [
      {
        label: "Main", color: "#d4d4d4", fillOpacity: 1,
        data: [
          55, 50, 58, 65, 72, 60, 85, 95, 78, 65, 88, 72, 60, 55, 75, 82,
          68, 58, 62, 70, 55, 80, 90, 72, 95, 105, 85, 78, 110, 95, 130,
          105, 120, 115, 140, 125, 110, 135, 128, 120,
        ],
      },
      {
        label: "Secondary", color: "#707070", fillOpacity: 0,
        data: [
          0, -10, 5, -15, -5, 10, -8, 15, -20, 8, -12, 5, -18, 10, -5,
          -15, 8, -10, 5, -20, 10, -8, -25, 5, -15, 10, -30, 5, -10, 15,
          -20, 8, -12, 5, -25, 10, -8, -15, 5, -10,
        ],
      },
    ],
  }),
];

// ── Bridge: ChartConfig → ChartSpec for renderChart ─────────────────────

const SUBTITLE_MAP: Record<string, string> = {
  "Strategy vs Benchmark.": "Cumulative returns (%)",
  "Drawdown.": "Peak-to-trough decline (%)",
  "Dual Momentum Returns.": "Quarterly performance (%)",
};

function chartConfigToSpec(config: ChartConfig, chartType: ChartType): ChartSpec {
  return {
    type: chartType,
    title: config.title,
    subtitle: SUBTITLE_MAP[config.title] ?? "Cumulative returns (%)",
    xLabels: config.xLabels,
    yAxis: { min: config.yMin, max: config.yMax },
    grid: true,
    series: config.series.map((s) => ({
      data: s.data,
      label: s.label,
      color: s.color,
      fillOpacity: s.fillOpacity,
    })),
  };
}

// ── Legend ───────────────────────────────────────────────────────────

const BAR_HOVER_COLORS = FLASH_DARK.bar.styles.map((s) => ({ top: s.gradTop, bottom: s.gradBottom }));

function ChartLegend({ series, chartType }: { series: ChartSeries[]; chartType: ChartType }) {
  if (series.length <= 1) return null;

  if (chartType === "bar") {
    return (
      <div className="flex items-center justify-center gap-4">
        {series.map((s, idx) => {
          const c = BAR_HOVER_COLORS[idx % BAR_HOVER_COLORS.length];
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span
                className="w-[11px] h-[11px] rounded-[2px]"
                style={{ background: `linear-gradient(to bottom, ${c.top}, ${c.bottom})` }}
              />
              <span
                className="text-white text-[13px]"
                style={{ fontFamily: CHART_FONT }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {series.map((s) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="w-[10px] h-[2px] rounded-full" style={{ backgroundColor: s.color }} />
          <span
            className="text-[#494949] text-[11px]"
            style={{ fontFamily: CHART_FONT }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart Card (used by ResponseExpanded) ───────────────────────────────

export function ChartCard({ config, chartType = "line" }: { config: ChartConfig; chartType?: ChartType }) {
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    gridLines: true,
    axisLabels: true,
    legend: true,
    theme: "naked",
  });

  const baseSpec = chartConfigToSpec(config, chartType);
  const spec = {
    ...baseSpec,
    width: 1100,
    height: 380,
    title: undefined as string | undefined,
    subtitle: undefined as string | undefined,
    grid: chartSettings.gridLines,
    legend: { show: chartSettings.legend },
  };
  const scene = renderChart(spec);
  const outerCls = chartSettings.theme === "light" ? "fp-light" : "";
  const innerCls = chartSettings.axisLabels ? "" : "fp-hide-axis-labels";

  return (
    <div className={`w-full relative pt-4 pb-4 px-4 rounded-lg ${outerCls}`} style={{ background: chartSettings.theme === "naked" ? "transparent" : chartSettings.theme === "light" ? "#fafafa" : "#121212" }}>
      <div className="absolute top-4 right-4 z-10">
        <ChartSettingsDropdown settings={chartSettings} onChange={setChartSettings} />
      </div>
      <ChartHeader title={baseSpec.title} subtitle={baseSpec.subtitle} />
      <div className={`w-full ${innerCls}`} key={`${config.title}-${chartType}-${chartSettings.theme}-${chartSettings.gridLines}-${chartSettings.axisLabels}-${chartSettings.legend}`}>
        <FlashChart scene={scene} />
      </div>
    </div>
  );
}

// ── Skeleton Loader ─────────────────────────────────────────────────────

function GraphSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="h-[18px] w-[180px] bg-[#1f1f1f] rounded mb-[18px]" />
      <div className="w-full aspect-[595/260] bg-[#1a1a1a] rounded relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)",
            animation: "graphShimmer 1.5s ease-in-out infinite",
          }}
        />
        {[0.2, 0.4, 0.6, 0.8].map((pct) => (
          <div
            key={pct}
            className="absolute left-[8%] right-[4%] h-px bg-[#222]"
            style={{ top: `${pct * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Chart Settings ──────────────────────────────────────────────────────

export interface ChartSettings {
  gridLines: boolean;
  axisLabels: boolean;
  legend: boolean;
  theme: "dark" | "light" | "naked";
}

export function ChartSettingsDropdown({
  settings,
  onChange,
}: {
  settings: ChartSettings;
  onChange: (s: ChartSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setPanelPos(null);
    }, 150);
  }, []);

  const handleOpen = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      handleClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, handleClose]);

  const toggle = (key: "gridLines" | "axisLabels" | "legend") => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  const checkboxes: { key: "gridLines" | "axisLabels" | "legend"; label: string }[] = [
    { key: "gridLines", label: "Grid Lines" },
    { key: "axisLabels", label: "Axis Labels" },
    { key: "legend", label: "Legend" },
  ];

  const panelContent = open && panelPos && (
    <div
      ref={panelRef}
      className="fixed w-[160px] rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] p-2"
      style={{
        top: panelPos.top,
        right: panelPos.right,
        zIndex: 9999,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        fontFamily: CHART_FONT,
        animation: closing
          ? "graphSelectorOut 0.15s ease forwards"
          : "graphSelectorIn 0.2s cubic-bezier(0.22,1,0.36,1) forwards",
      }}
    >
      {checkboxes.map(({ key, label }) => (
        <div
          key={key}
          onClick={() => toggle(key)}
          className="flex items-center gap-2.5 px-1.5 py-[6px] rounded-[4px] cursor-pointer hover:bg-[#252525] transition-colors"
        >
          <span
            className="w-[16px] h-[16px] rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              borderColor: settings[key] ? "#9a6dd7" : "#3a3a3a",
              background: settings[key] ? "#9a6dd7" : "transparent",
            }}
          >
            {settings[key] && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="text-[12px] text-white">{label}</span>
        </div>
      ))}

      <div className="flex mt-2 rounded-[5px] overflow-hidden border border-[#2a2a2a]">
        {(["dark", "light", "naked"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ ...settings, theme: t })}
            className="flex-1 py-[5px] text-[11px] font-medium transition-colors cursor-pointer capitalize"
            style={{
              background: settings.theme === t ? "#2a2a2a" : "transparent",
              color: settings.theme === t ? "#fff" : "#555",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (open) handleClose();
          else handleOpen();
        }}
        className="w-[20px] h-[20px] rounded-full bg-[#1e1f24] flex items-center justify-center hover:bg-[#2a2a2a] transition-colors cursor-pointer"
      >
        <svg
          width="8"
          height="5"
          viewBox="0 0 8 5"
          fill="none"
          className="transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M1 1L4 4L7 1" stroke="#808080" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {typeof document !== "undefined" && createPortal(panelContent, document.body)}
    </>
  );
}

// ── Monthly Returns Heatmap ──────────────────────────────────────────────

export interface MonthlyReturnsEntry {
  year: number;
  months: (number | null)[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function tryParseMonthlyGrid(obj: Record<string, unknown>): MonthlyReturnsEntry[] | null {
  // Shape A: { rowLabels: ["2020",...], values: [[...12 nums...], ...] }
  if (Array.isArray(obj.values) && Array.isArray(obj.rowLabels)) {
    return (obj.rowLabels as string[]).map((yr, i) => ({
      year: parseInt(yr),
      months: ((obj.values as number[][])[i] ?? Array(12).fill(null)),
    }));
  }
  // Shape B: { rows: ["2020",...], values: [[...]] }
  if (Array.isArray(obj.values) && Array.isArray(obj.rows)) {
    return (obj.rows as string[]).map((yr, i) => ({
      year: parseInt(yr),
      months: ((obj.values as number[][])[i] ?? Array(12).fill(null)),
    }));
  }
  // Shape C: { years: [2020,...], months: [[...12 per year...]] }
  if (Array.isArray(obj.years) && Array.isArray(obj.months)) {
    return (obj.years as number[]).map((yr, i) => ({
      year: yr,
      months: ((obj.months as number[][])[i] ?? Array(12).fill(null)),
    }));
  }
  // Shape D: { data: [[...12 per year...]], rowLabels/rows, colLabels/cols }
  const inner = obj.data as Record<string, unknown> | undefined;
  if (inner && (Array.isArray(inner.rowLabels) || Array.isArray(inner.rows)) && Array.isArray(inner.values)) {
    return tryParseMonthlyGrid(inner);
  }
  return null;
}

function extractMonthlyReturnsData(scene: Record<string, unknown>): MonthlyReturnsEntry[] | null {
  // Format 1: scene.monthly_data = [{ year, months: [v1..v12] }]
  if (Array.isArray(scene.monthly_data)) {
    return (scene.monthly_data as Record<string, unknown>[]).map((row) => ({
      year: Number(row.year),
      months: (row.months as (number | null)[]) ?? Array(12).fill(null),
    }));
  }

  // Format 2: flat grid shapes on scene root
  const rootTry = tryParseMonthlyGrid(scene);
  if (rootTry) return rootTry;

  // Format 3: scene.data = grid shape
  const sceneData = scene.data as Record<string, unknown> | undefined;
  if (sceneData) {
    const dataTry = tryParseMonthlyGrid(sceneData);
    if (dataTry) return dataTry;
  }

  // Format 4: scan subplot elements for any heatmap/monthly element
  const subplots = scene.subplots as Record<string, unknown>[] | undefined;
  if (!subplots?.length) return null;

  for (const sp of subplots) {
    // Check subplot-level data fields
    const spTry = tryParseMonthlyGrid(sp);
    if (spTry) return spTry;

    const els = sp.elements as Record<string, unknown>[] | undefined;
    if (!els) continue;
    for (const el of els) {
      // Try the element directly (element might hold the grid fields at top level)
      const elTry = tryParseMonthlyGrid(el);
      if (elTry) return elTry;

      // Try el.data sub-object
      const elData = el.data as Record<string, unknown> | undefined;
      if (elData) {
        const elDataTry = tryParseMonthlyGrid(elData);
        if (elDataTry) return elDataTry;
      }

      // Try el.cells: { "2020-01": 2.1, "2020-02": -1.3, ... } key-value map
      const cells = el.cells as Record<string, number> | undefined;
      if (cells && typeof cells === "object" && !Array.isArray(cells)) {
        const yearMap: Record<number, (number | null)[]> = {};
        for (const [k, v] of Object.entries(cells)) {
          const parts = k.split("-");
          const yr = parseInt(parts[0]);
          const mo = parseInt(parts[1]) - 1; // 0-based
          if (!isNaN(yr) && mo >= 0 && mo < 12) {
            if (!yearMap[yr]) yearMap[yr] = Array(12).fill(null);
            yearMap[yr][mo] = v;
          }
        }
        const years = Object.keys(yearMap).map(Number).sort();
        if (years.length > 0) {
          return years.map((yr) => ({ year: yr, months: yearMap[yr] }));
        }
      }
    }
  }

  return null;
}

function computeMonthlyFromEquityCurve(scene: Record<string, unknown>, period?: string): MonthlyReturnsEntry[] | null {
  const subplots = scene?.subplots as Record<string, unknown>[] | undefined;
  if (!subplots?.length) return null;
  const sp = subplots[0];
  const els = sp.elements as Record<string, unknown>[] | undefined;
  if (!els?.length) return null;

  const lineEl = els.find(el => el.type === "line" && Array.isArray(el.dataValues) && (el.dataValues as number[]).length > 0);
  if (!lineEl) return null;
  const values = lineEl.dataValues as number[];
  if (values.length < 2) return null;

  const xAxis = sp.xAxis as Record<string, unknown> | undefined;
  const ticks = xAxis?.ticks as { value: number; label: string }[] | undefined;

  let dateForIndex: (i: number) => Date;

  const tickDates: { idx: number; date: Date }[] = [];
  if (ticks?.length) {
    for (const t of ticks) {
      const parsed = new Date(t.label);
      if (!isNaN(parsed.getTime())) tickDates.push({ idx: Math.round(t.value), date: parsed });
    }
  }

  if (tickDates.length >= 2) {
    tickDates.sort((a, b) => a.idx - b.idx);
    dateForIndex = (i: number): Date => {
      if (i <= tickDates[0].idx) return tickDates[0].date;
      if (i >= tickDates[tickDates.length - 1].idx) return tickDates[tickDates.length - 1].date;
      for (let t = 0; t < tickDates.length - 1; t++) {
        const a = tickDates[t], b = tickDates[t + 1];
        if (i >= a.idx && i <= b.idx) {
          const frac = (i - a.idx) / (b.idx - a.idx);
          return new Date(a.date.getTime() + frac * (b.date.getTime() - a.date.getTime()));
        }
      }
      return tickDates[0].date;
    };
  } else {
    // Numeric-index ticks: infer from period or subtitle
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const periodStr = period || (sp.subtitle as string | undefined);
    if (periodStr) {
      const parts = periodStr.split(/\s+to\s+/i);
      if (parts.length === 2) {
        const s = new Date(parts[0].trim());
        const e = new Date(parts[1].trim());
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) { startDate = s; endDate = e; }
      }
    }
    if (!startDate || !endDate) return null;
    const totalMs = endDate.getTime() - startDate.getTime();
    const n = values.length;
    dateForIndex = (i: number): Date => new Date(startDate!.getTime() + (i / (n - 1)) * totalMs);
  }

  const mv: Record<string, { first: number; last: number }> = {};
  for (let i = 0; i < values.length; i++) {
    const d = dateForIndex(i);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!mv[key]) mv[key] = { first: values[i], last: values[i] };
    else mv[key].last = values[i];
  }

  const years = Array.from(new Set(Object.keys(mv).map(k => parseInt(k.split("-")[0])))).sort();
  if (years.length === 0) return null;

  return years.map(yr => {
    const months: (number | null)[] = Array(12).fill(null);
    for (let m = 0; m < 12; m++) {
      const entry = mv[`${yr}-${m}`];
      if (entry && entry.first !== 0) {
        months[m] = parseFloat((((entry.last - entry.first) / entry.first) * 100).toFixed(2));
      }
    }
    return { year: yr, months };
  });
}

function monthlyReturnColor(val: number | null, maxAbs: number): string {
  if (val === null) return "transparent";
  const intensity = Math.min(Math.abs(val) / Math.max(maxAbs, 0.01), 1);
  const alpha = 0.12 + intensity * 0.65;
  return val >= 0
    ? `rgba(74, 200, 130, ${alpha})`
    : `rgba(220, 70, 70, ${alpha})`;
}

export function MonthlyReturnsChart({
  data,
  settings,
}: {
  data: MonthlyReturnsEntry[];
  settings: ChartSettings;
}) {
  const allVals = data.flatMap((r) => r.months).filter((v): v is number => v !== null);
  const maxAbs = Math.max(...allVals.map(Math.abs), 1);

  const yearTotal = (row: MonthlyReturnsEntry): number | null => {
    const valid = row.months.filter((v): v is number => v !== null);
    return valid.length > 0 ? valid.reduce((s, v) => s + v, 0) : null;
  };

  const fmt = (v: number | null) =>
    v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  const cellBase: React.CSSProperties = {
    fontFamily: CHART_FONT,
    fontSize: 14,
    textAlign: "center",
    borderRadius: 3,
    padding: "5px 4px",
    minWidth: 54,
    transition: "background-color 0.15s",
  };

  if (!settings.axisLabels) {
    return (
      <div className="w-full py-4 text-center text-[16px] text-[#505050]" style={{ fontFamily: CHART_FONT }}>
        Monthly returns hidden (axis labels off)
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto hide-scrollbar">
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "2px 2px" }}>
        <thead>
          <tr>
            <th style={{ fontFamily: CHART_FONT, fontSize: 14, color: "#505050", textAlign: "left", paddingBottom: 8, paddingRight: 12, fontWeight: 400 }}>
              Year
            </th>
            {MONTH_LABELS.map((m) => (
              <th key={m} style={{ fontFamily: CHART_FONT, fontSize: 14, color: "#505050", textAlign: "center", paddingBottom: 8, fontWeight: 400, minWidth: 54 }}>
                {m}
              </th>
            ))}
            {settings.legend && (
              <th style={{ fontFamily: CHART_FONT, fontSize: 14, color: "#505050", textAlign: "center", paddingBottom: 8, fontWeight: 400, minWidth: 58 }}>
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const total = yearTotal(row);
            return (
              <tr key={row.year}>
                <td style={{ fontFamily: CHART_FONT, fontSize: 16, color: "#8f8f8f", paddingRight: 12, paddingTop: 1, paddingBottom: 1, fontWeight: 400, whiteSpace: "nowrap" }}>
                  {row.year}
                </td>
                {row.months.map((val, i) => (
                  <td key={i} style={{ padding: "1px 0" }}>
                    <div
                      style={{
                        ...cellBase,
                        backgroundColor: monthlyReturnColor(val, maxAbs),
                        color: val === null ? "#404040" : "#e5e5e5",
                      }}
                    >
                      {fmt(val)}
                    </div>
                  </td>
                ))}
                {settings.legend && (
                  <td style={{ padding: "1px 0" }}>
                    <div
                      style={{
                        ...cellBase,
                        backgroundColor: monthlyReturnColor(total, maxAbs),
                        color: total === null ? "#404040" : "#f0f0f0",
                        fontWeight: 500,
                        minWidth: 58,
                      }}
                    >
                      {fmt(total)}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Mock ChartSpec data for /chart testing ──────────────────────────────

const MOCK_CHART_SPECS: Record<string, ChartSpec> = {
  line: {
    type: "line",
    title: "Strategy vs Benchmark",
    subtitle: "Cumulative returns (%)",
    xLabels: ["Q1 21", "Q2 21", "Q3 21", "Q4 21", "Q1 22", "Q2 22", "Q3 22", "Q4 22", "Q1 23", "Q2 23", "Q3 23", "Q4 23", "Q1 24", "Q2 24", "Q3 24", "Q4 24"],
    series: [
      { data: [12, 18, 8, 25, 32, 15, -5, 10, 22, 38, 42, 55, 48, 62, 58, 72], label: "Strategy", color: "#d4d4d4", fillOpacity: 0.12 },
      { data: [10, 14, 12, 18, 15, 8, -2, 5, 12, 20, 25, 30, 28, 35, 32, 40], label: "S&P 500", color: "#707070" },
    ],
  },
  bar: {
    type: "bar",
    title: "Sector Allocation",
    subtitle: "Portfolio weight (%)",
    xLabels: ["Tech", "Health", "Finance", "Energy", "Consumer", "Industrial"],
    series: [
      { data: [28, 18, 15, 12, 14, 13], label: "Current", color: "#EF8CFF" },
      { data: [22, 20, 18, 10, 16, 14], label: "Target", color: "#8CA5FF" },
    ],
  },
  stacked_bar: {
    type: "stacked_bar",
    title: "Stacked Revenue",
    subtitle: "Base + Growth by quarter",
    xLabels: ["Q1", "Q2", "Q3", "Q4", "Q5"],
    series: [
      { data: [5, 8, 6, 10, 7], label: "Base", stacked: true },
      { data: [3, 4, 5, 2, 6], label: "Growth", stacked: true },
    ],
  },
  scatter: {
    type: "scatter",
    title: "Risk-Return Profile",
    subtitle: "Annualized metrics",
    xAxis: { label: "Volatility (%)" },
    yAxis: { label: "Return (%)" },
    series: [
      { x: [8, 12, 15, 18, 22, 25, 10, 14, 20, 28], data: [6, 10, 8, 14, 12, 18, 7, 11, 15, 22], label: "Funds", markerSize: 5 },
      { x: [15], data: [12], label: "Benchmark", color: "#FF6B6B", markerSize: 8 },
    ],
  },
  bubble: {
    type: "bubble",
    title: "Market Cap vs P/E",
    subtitle: "Bubble size = volume",
    xAxis: { label: "P/E Ratio" },
    yAxis: { label: "Market Cap ($B)" },
    series: [
      { x: [15, 22, 30, 18, 25, 35, 12, 28], data: [200, 150, 80, 300, 120, 60, 400, 90], label: "Stocks", sizes: [20, 15, 8, 25, 12, 6, 30, 10] },
    ],
  },
  area: {
    type: "area",
    title: "Portfolio Value Over Time",
    subtitle: "Total assets ($K)",
    xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    series: [
      { data: [100, 105, 98, 112, 120, 118, 130, 142, 138, 150, 155, 168], label: "Equities" },
      { data: [50, 52, 54, 53, 55, 58, 57, 60, 62, 61, 64, 66], label: "Bonds" },
    ],
  },
  histogram: {
    type: "histogram",
    title: "Daily Returns Distribution",
    subtitle: "252 trading days",
    bins: 20,
    series: [
      { data: [-3.2, -2.8, -2.1, -1.9, -1.5, -1.2, -1.0, -0.8, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.2, 0.3, 0.4, 0.4, 0.5, 0.5, 0.6, 0.6, 0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 1.0, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.8, 2.1, 2.5, 2.9], label: "Returns" },
    ],
  },
  candlestick: {
    type: "candlestick",
    title: "NIFTY 50",
    subtitle: "4h · Last 12 candles",
    xLabels: ["09:15", "13:15", "09:15", "13:15", "09:15", "13:15", "09:15", "13:15", "09:15", "13:15", "09:15", "13:15"],
    series: [{
      data: [7718, 7732, 7758, 7745, 7770, 7762, 7780, 7755, 7740, 7735, 7715, 7710],
      open: [7700, 7718, 7730, 7760, 7745, 7772, 7760, 7780, 7758, 7742, 7738, 7720],
      high: [7722, 7740, 7762, 7768, 7775, 7778, 7785, 7782, 7760, 7748, 7740, 7725],
      low: [7695, 7715, 7728, 7740, 7742, 7758, 7755, 7750, 7735, 7730, 7708, 7700],
      close: [7718, 7732, 7758, 7745, 7770, 7762, 7780, 7755, 7740, 7735, 7715, 7710],
      label: "NIFTY 50",
    }],
  },
  bokeh: {
    type: "scatter",
    title: "Risk vs Return",
    subtitle: "60 simulated assets",
    xAxis: { label: "Volatility" },
    yAxis: { label: "Return" },
    series: [{
      x: [12, 15, 18, 20, 22, 25, 28, 30, 32, 33, 35, 36, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78, 80, 82, 84, 85, 86, 87, 88, 90],
      data: [3, 5, 8, 10, 7, 12, 14, 11, 18, 15, 20, 17, 22, 19, 25, 21, 24, 28, 20, 30, 26, 32, 22, 35, 28, 38, 30, 25, 40, 33, 42, 36, 28, 45, 38, 48, 35, 50, 42, 52, 40, 55, 45, 48, 50, 53, 46, 55, 50, 58, 52, 48, 55, 52, 58, 54, 50, 56, 53, 60],
      label: "Assets",
      color: "#C084FC",
      markerSize: 5,
    }],
  },
  waterfall: {
    type: "waterfall",
    title: "P&L Attribution",
    subtitle: "Monthly ($K)",
    xLabels: ["Revenue", "COGS", "Gross Profit", "OpEx", "Tax", "Total"],
    series: [
      { data: [500, -200, 300, -150, -45, 105], label: "P&L" },
    ],
  },
  violin: {
    type: "violin",
    title: "Return Distributions by Strategy",
    subtitle: "Daily returns (%)",
    xLabels: ["Momentum", "Mean Rev", "Vol Arb"],
    series: [
      { data: [-2.1, -1.5, -0.8, -0.3, 0.1, 0.4, 0.5, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.5, 1.8, 2.2, 0.6, 0.7, 0.8, 0.9, 1.0, 0.5, 0.3, -0.1, 1.3, 1.4], label: "Momentum" },
      { data: [-1.0, -0.6, -0.3, -0.1, 0.0, 0.1, 0.2, 0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 0.6, 0.7, 0.8, 0.3, 0.4, 0.2, 0.1, 0.5, 0.6, -0.2, -0.4, 0.3, 0.2], label: "Mean Rev" },
      { data: [-0.5, -0.3, -0.1, 0.0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 0.4, 0.5, 0.5, 0.2, 0.3, 0.1, 0.2, 0.3, 0.4, -0.1, 0.0, 0.2, 0.3], label: "Vol Arb" },
    ],
  },
  boxplot: {
    type: "boxplot",
    title: "Monthly Returns by Asset Class",
    subtitle: "10-year history",
    xLabels: ["Equities", "Bonds", "Commodities", "Crypto"],
    series: [
      { data: [-8, -5, -3, -1, 0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12], label: "Equities" },
      { data: [-2, -1, -0.5, 0, 0.2, 0.3, 0.4, 0.5, 0.5, 0.6, 0.7, 0.8, 1.0, 1.2, 1.5, 2.0], label: "Bonds" },
      { data: [-10, -6, -3, -1, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 10, 15, 20], label: "Commodities" },
      { data: [-25, -15, -8, -3, 0, 2, 5, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50], label: "Crypto" },
    ],
  },
  pie: {
    type: "pie",
    title: "Portfolio Allocation",
    subtitle: "Current weights (%)",
    slices: [
      { value: 35, label: "US Equities" },
      { value: 20, label: "Intl Equities" },
      { value: 15, label: "Fixed Income" },
      { value: 12, label: "Real Estate" },
      { value: 10, label: "Commodities" },
      { value: 8, label: "Cash" },
    ],
  },
  donut: {
    type: "donut",
    title: "Expense Ratio Breakdown",
    subtitle: "Fee structure (%)",
    slices: [
      { value: 40, label: "Management Fee" },
      { value: 25, label: "Performance Fee" },
      { value: 15, label: "Admin" },
      { value: 12, label: "Custody" },
      { value: 8, label: "Other" },
    ],
  },
  heatmap: {
    type: "heatmap",
    title: "Correlation Matrix",
    heatmap: {
      data: [
        [1.0, 0.8, 0.3, -0.2, 0.5],
        [0.8, 1.0, 0.4, -0.1, 0.6],
        [0.3, 0.4, 1.0, 0.2, 0.3],
        [-0.2, -0.1, 0.2, 1.0, -0.3],
        [0.5, 0.6, 0.3, -0.3, 1.0],
      ],
      rowLabels: ["SPY", "QQQ", "GLD", "TLT", "BTC"],
      colLabels: ["SPY", "QQQ", "GLD", "TLT", "BTC"],
    },
  },
  surface: {
    type: "surface",
    title: "Implied Volatility Surface",
    surface: {
      z: [
        [0.35, 0.30, 0.28, 0.27, 0.26],
        [0.32, 0.28, 0.25, 0.24, 0.23],
        [0.30, 0.26, 0.23, 0.22, 0.21],
        [0.29, 0.25, 0.22, 0.21, 0.20],
        [0.28, 0.24, 0.21, 0.20, 0.19],
      ],
    },
  },
  surface_3d: {
    type: "surface_3d",
    title: "3D Volatility Surface",
    surface: {
      z: [
        [0.40, 0.35, 0.30, 0.28, 0.27, 0.26],
        [0.36, 0.32, 0.28, 0.25, 0.24, 0.23],
        [0.33, 0.29, 0.25, 0.23, 0.22, 0.21],
        [0.31, 0.27, 0.24, 0.22, 0.21, 0.20],
        [0.30, 0.26, 0.23, 0.21, 0.20, 0.19],
        [0.29, 0.25, 0.22, 0.20, 0.19, 0.18],
      ],
    },
  },
  // Monthly returns heatmap — rendered as MonthlyReturnsChart (not FlashChart)
  monthly_returns: {
    type: "line", // placeholder type; rendering is overridden by chart type check
    title: "Monthly Returns (%)",
  },
};

// Resolve user input like "surface-chart", "stacked bar", "line_chart" → ChartType key
function resolveChartType(input: string): string {
  const normalized = input.toLowerCase().replace(/[-_\s]+(chart|plot|graph)?/g, "").trim();
  // Direct matches
  if (normalized in MOCK_CHART_SPECS) return normalized;
  // Common aliases
  const aliases: Record<string, string> = {
    "stackedbar": "stacked_bar",
    "stacked": "stacked_bar",
    "candle": "candlestick",
    "ohlc": "candlestick",
    "price": "candlestick",
    "surface3d": "surface_3d",
    "3d": "surface_3d",
    "3dsurface": "surface_3d",
    "vol": "violin",
    "box": "boxplot",
    "whisker": "boxplot",
    "boxwhisker": "boxplot",
    "hist": "histogram",
    "distribution": "histogram",
    "filled": "area",
    "filledarea": "area",
    "ring": "donut",
    "heat": "heatmap",
    "correlation": "heatmap",
    "fall": "waterfall",
    "monthly": "monthly_returns",
    "monthlyreturns": "monthly_returns",
    "returns": "monthly_returns",
  };
  if (aliases[normalized]) return aliases[normalized];
  // Partial match
  for (const key of Object.keys(MOCK_CHART_SPECS)) {
    if (key.startsWith(normalized) || normalized.startsWith(key)) return key;
  }
  return "line"; // fallback
}

// ── Unified Chart Header ─────────────────────────────────────────────────

export function ChartHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  if (!title && !subtitle) return null;
  return (
    <div className="pt-4 pb-2">
      {title && (
        <h3
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="text-[#e5e5e5] text-[21px] font-normal leading-tight outline-none cursor-text"
          style={{
            fontFamily: CHART_FONT,
            letterSpacing: "-0.3px",
          }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
        >
          {title}
        </h3>
      )}
      {subtitle && (
        <p
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="text-[#707070] text-[13px] font-normal mt-0.5 outline-none cursor-text"
          style={{ fontFamily: CHART_FONT, letterSpacing: "-0.1px" }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Chart Cell (renders any chart type from /chart command) ──────────────

export function ChartCell({ chartTypeInput }: { chartTypeInput: string }) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("3D");
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    gridLines: true,
    axisLabels: true,
    legend: true,
    theme: "naked",
  });

  const resolvedType = resolveChartType(chartTypeInput);
  const spec = MOCK_CHART_SPECS[resolvedType] ?? MOCK_CHART_SPECS.line;

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      requestAnimationFrame(() => setRevealed(true));
    }, 600 + Math.random() * 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-9">
        <GraphSkeleton />
      </div>
    );
  }

  const wrapStyle = {
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
  };

  // Strip title/subtitle from specs passed to inner components (rendered by ChartHeader instead)
  const isSurface = spec.type === "surface" || spec.type === "surface_3d";

  // Build the chart body
  let chartBody: React.ReactNode = null;
  let extraControls: React.ReactNode = null;

  if (spec.type === "pie" || spec.type === "donut") {
    const pieData = extractPieSlices(spec);
    chartBody = (
      <div className={chartSettings.theme === "light" ? "fp-light" : ""}>
        <PieChart
          data={pieData.slices}
          donut={pieData.donut}
          donutRatio={pieData.donutRatio}
          showLegend={chartSettings.legend}
          lightTheme={chartSettings.theme === "light"}
        />
      </div>
    );
  } else if (isSurface) {
    const surf = spec.surface;
    if (!surf?.z) return null;
    chartBody = (
      <Surface3D
        z={surf.z}
        x={surf.x}
        y={surf.y}
        color={surf.color}
        wireframe={surf.wireframe}
        mode={surfaceMode}
        onModeChange={setSurfaceMode}
      />
    );
    extraControls = (
      <div className="flex items-center justify-between w-full">
        <span className="text-[9px] text-[#444]" style={{ fontFamily: CHART_FONT }}>
          {surfaceMode === "3D" ? "drag to rotate · scroll to zoom · double-click to reset" : ""}
        </span>
        <div className="flex rounded-full overflow-hidden border border-[#2a2a2a]" style={{ fontFamily: CHART_FONT }}>
          {(["2D", "3D"] as SurfaceMode[]).map((m) => (
            <button key={m} onClick={() => setSurfaceMode(m)}
              className="px-2.5 py-1 text-[9px] font-medium transition-colors cursor-pointer"
              style={{ background: surfaceMode === m ? "#2a2a2a" : "#121212", color: surfaceMode === m ? "#fff" : "#555" }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (spec.type === "candlestick" || spec.type === "bokeh") {
    const candleData = extractCandlestickData(spec);
    if (candleData) {
      chartBody = (
        <CandlestickChart
          data={candleData}
          grid={chartSettings.gridLines}
          showLegend={chartSettings.legend}
          theme={chartSettings.theme}
        />
      );
    }
  } else if (resolvedType === "monthly_returns") {
    // Mock monthly returns data for /chart command preview
    const mockMonthlyData: MonthlyReturnsEntry[] = [
      { year: 2021, months: [2.1, -1.3, 4.5, 1.8, 3.2, -0.7, 2.9, 1.4, -2.1, 5.6, 3.1, 1.9] },
      { year: 2022, months: [-3.2, 1.5, -2.8, -4.1, -2.5, -5.2, 4.3, -2.1, -6.2, 4.8, 2.1, -2.9] },
      { year: 2023, months: [4.2, 1.3, 2.8, 0.9, 1.4, 3.1, 2.5, -1.2, 3.8, -1.5, 4.6, 2.3] },
      { year: 2024, months: [1.8, 3.4, 2.1, -0.8, 2.6, 1.5, 3.2, -0.5, 1.9, 2.8, -1.1, 2.4] },
    ];
    chartBody = <MonthlyReturnsChart data={mockMonthlyData} settings={chartSettings} />;
  } else if (spec.type === "heatmap") {
    const fallbackSpec: ChartSpec = {
      type: "line",
      grid: chartSettings.gridLines,
      legend: { show: chartSettings.legend },
      series: (spec.heatmap?.data ?? []).map((row, i) => ({
        data: row,
        label: spec.heatmap?.rowLabels?.[i] ?? `Row ${i + 1}`,
      })),
    };
    const scene = renderChart(fallbackSpec);
    const heatCls = [
      chartSettings.axisLabels ? "" : "fp-hide-axis-labels",
      chartSettings.theme === "light" ? "fp-light" : "",
    ].filter(Boolean).join(" ");
    chartBody = (
      <div className={heatCls}>
        <FlashChart scene={scene} />
      </div>
    );
  } else {
    // All other chart types — strip title/subtitle so it's not rendered twice
    const cleanSpec = {
      ...spec,
      title: undefined,
      subtitle: undefined,
      grid: chartSettings.gridLines,
      legend: { show: chartSettings.legend },
    };
    const scene = renderChart(cleanSpec);
    const innerCls = chartSettings.axisLabels ? "" : "fp-hide-axis-labels";
    chartBody = (
      <div className={innerCls}>
        <FlashChart scene={scene} />
      </div>
    );
  }

  const outerCls = chartSettings.theme === "light" ? "fp-light" : "";

  return (
    <div className={`w-full relative pt-4 pb-4 px-4 rounded-lg ${outerCls}`} style={{ ...wrapStyle, background: chartSettings.theme === "naked" ? "transparent" : chartSettings.theme === "light" ? "#fafafa" : "#121212" }}>
      <div className="absolute top-4 right-4 z-10">
        <ChartSettingsDropdown settings={chartSettings} onChange={setChartSettings} />
      </div>
      <ChartHeader title={spec.title} subtitle={spec.subtitle} />
      <div className="w-full" key={`cc-${chartSettings.theme}-${chartSettings.gridLines}-${chartSettings.axisLabels}-${chartSettings.legend}`}>{chartBody}</div>
      {extraControls && (
        <div className="flex items-center justify-between pb-2">
          {extraControls}
        </div>
      )}
    </div>
  );
}

// ── API Chart Cell (wraps backend Scene JSON with full chart template) ───

function extractSceneTitle(scene: Record<string, unknown>): { title?: string; subtitle?: string } {
  const subplots = scene.subplots as Record<string, unknown>[] | undefined;
  if (!subplots?.length) return {};
  const first = subplots[0];
  return {
    title: first.title as string | undefined,
    subtitle: first.subtitle as string | undefined,
  };
}

function stripSceneTitle(scene: Record<string, unknown>): Record<string, unknown> {
  const subplots = scene.subplots as Record<string, unknown>[] | undefined;
  if (!subplots?.length) return scene;
  return {
    ...scene,
    subplots: subplots.map((sp) => ({ ...sp, title: undefined, subtitle: undefined, titleStyle: undefined, subtitleStyle: undefined })),
  };
}

function shrinkAxisFonts(scene: Record<string, unknown>): Record<string, unknown> {
  if (!scene?.subplots || !Array.isArray(scene.subplots)) return scene;
  const out = JSON.parse(JSON.stringify(scene));
  for (const sp of out.subplots as Record<string, unknown>[]) {
    const scale = (axis: Record<string, unknown> | undefined) => {
      if (!axis) return;
      const ts = axis.tickStyle as Record<string, unknown> | undefined;
      if (ts?.fontSize) ts.fontSize = Math.round((ts.fontSize as number) * 0.8);
    };
    scale(sp.xAxis as Record<string, unknown> | undefined);
    scale(sp.yAxis as Record<string, unknown> | undefined);
  }
  return out;
}

export function ApiChartCell({
  scene: rawScene,
  title: titleOverride,
  subtitle: subtitleOverride,
  compact,
  chartType: chartTypeHint,
  backtestId,
  monthlyData: monthlyDataProp,
  period,
}: {
  scene: Record<string, unknown>;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  chartType?: string;
  backtestId?: string;
  monthlyData?: MonthlyReturnsEntry[];
  period?: string;
}) {
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    gridLines: true,
    axisLabels: true,
    legend: true,
    theme: "naked",
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyReturnsEntry[] | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  const sceneTitle = (() => {
    const sps = rawScene?.subplots as Record<string, unknown>[] | undefined;
    return sps?.[0]?.title as string | undefined;
  })();

  const isMonthly =
    chartTypeHint === "monthly_returns" ||
    rawScene?.chart_type === "monthly_returns" ||
    (chartTypeHint === "heatmap" && /monthly\s*return/i.test(sceneTitle || "")) ||
    (rawScene?.chart_type === "heatmap" && /monthly\s*return/i.test(sceneTitle || "")) ||
    /monthly\s*return/i.test(sceneTitle || "") ||
    (Array.isArray(rawScene?.subplots) &&
      (rawScene.subplots as Record<string, unknown>[]).some(
        (sp) =>
          sp.chart_type === "monthly_returns" ||
          (sp.elements as Record<string, unknown>[] | undefined)?.some(
            (el) => el.type === "monthly_returns" || el.type === "monthly_table"
          )
      ));

  useEffect(() => {
    if (!isMonthly) return;
    if (monthlyDataProp?.length) { setMonthlyData(monthlyDataProp); return; }
    const extracted = extractMonthlyReturnsData(rawScene);
    if (extracted) { setMonthlyData(extracted); return; }
    if (!backtestId) return;
    // Skip refetch if we already have data (from a prior run of this effect)
    if (monthlyData && !period) return;

    let cancelled = false;
    setMonthlyLoading(true);

    (async () => {
      try {
        const res = await createChart({ chart_type: "monthly_returns", backtest_id: backtestId });
        if (cancelled) return;
        if (res.scene) {
          const fetched = extractMonthlyReturnsData(res.scene as Record<string, unknown>);
          if (fetched) { setMonthlyData(fetched); return; }
        }
        const resAny = res as unknown as Record<string, unknown>;
        const fromRoot = extractMonthlyReturnsData(resAny);
        if (fromRoot) { setMonthlyData(fromRoot); return; }
      } catch { /* continue to fallback */ }

      if (cancelled) return;
      try {
        const allCharts = await getBacktestCharts(backtestId);
        if (cancelled) return;
        const eqChart = allCharts.find(c => c.chart_type === "equity_curve" && c.scene);
        if (eqChart?.scene) {
          const computed = computeMonthlyFromEquityCurve(eqChart.scene as Record<string, unknown>, period);
          if (computed) { setMonthlyData(computed); return; }
        }
      } catch { /* endpoint unavailable */ }
    })().finally(() => { if (!cancelled) setMonthlyLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonthly, backtestId, monthlyDataProp, period]);

  if (isMonthly) {
    const fallbackTitle = titleOverride || (rawScene?.title as string) || "Monthly Returns (%)";
    const outerCls = chartSettings.theme === "light" ? "fp-light" : "";
    return (
      <div
        className={`w-full relative pt-4 pb-4 px-4 rounded-lg ${outerCls}`}
        style={{
          background: chartSettings.theme === "naked" ? "transparent" : chartSettings.theme === "light" ? "#fafafa" : "#121212",
        }}
      >
        <div className="absolute top-4 right-4 z-10">
          <ChartSettingsDropdown settings={chartSettings} onChange={setChartSettings} />
        </div>
        <ChartHeader title={fallbackTitle} />
        {monthlyLoading ? (
          <div className="flex items-center gap-2 py-6 text-[11px] text-[#404040]" style={{ fontFamily: CHART_FONT }}>
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
            Loading…
          </div>
        ) : monthlyData ? (
          <MonthlyReturnsChart data={monthlyData} settings={chartSettings} />
        ) : (
          <div className="text-[11px] text-[#404040] py-4" style={{ fontFamily: CHART_FONT }}>
            No monthly return data available.
          </div>
        )}
      </div>
    );
  }

  if (!rawScene || !Array.isArray(rawScene.subplots)) return null;

  const extracted = extractSceneTitle(rawScene);
  const title = titleOverride || extracted.title;
  const subtitle = subtitleOverride || extracted.subtitle;

  let sanitized = sanitizeApiScene(rawScene);
  if (compact) sanitized = shrinkAxisFonts(sanitized);
  const stripped = stripSceneTitle(sanitized);

  const outerCls = chartSettings.theme === "light" ? "fp-light" : "";
  const innerCls = chartSettings.axisLabels ? "" : "fp-hide-axis-labels";

  return (
    <div
      className={`w-full relative pt-4 pb-4 px-4 rounded-lg ${outerCls}`}
      style={{
        background: chartSettings.theme === "naked" ? "transparent" : chartSettings.theme === "light" ? "#fafafa" : "#121212",
      }}
    >
      <div className="absolute top-4 right-4 z-10">
        <ChartSettingsDropdown settings={chartSettings} onChange={setChartSettings} />
      </div>
      <ChartHeader title={title} subtitle={subtitle} />
      <div className={`w-full ${innerCls}`} key={`fc-${chartSettings.theme}-${chartSettings.gridLines}-${chartSettings.axisLabels}-${chartSettings.legend}`}>
        <FlashChart scene={stripped as unknown as import("./plot/core/types").Scene} />
      </div>
    </div>
  );
}

// ── Graph Cell (self-contained: fetches, computes, renders) ─────────────

export function GraphCell({ query }: { query?: string }) {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("line");
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    gridLines: true,
    axisLabels: true,
    legend: true,
    theme: "naked",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const apiData = await fetchGraphData(query);
    const configs = apiData.map(apiToChartConfig);
    setCharts(configs);
    setLoading(false);
    requestAnimationFrame(() => setRevealed(true));
  }, [query]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="w-full flex flex-col gap-9">
        <GraphSkeleton />
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col gap-9"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {charts.map((config) => {
        const baseSpec = chartConfigToSpec(config, chartType);
        const spec = {
          ...baseSpec,
          grid: chartSettings.gridLines,
          legend: { show: chartSettings.legend },
        };
        const scene = renderChart(spec);
        return (
          <div key={config.title} className="w-full">
            <div
              className={`w-full ${chartSettings.axisLabels ? "" : "fp-hide-axis-labels"} ${chartSettings.theme === "light" ? "fp-light" : ""}`}
              key={`${config.title}-${chartType}-${chartSettings.theme}-${chartSettings.gridLines}-${chartSettings.axisLabels}-${chartSettings.legend}`}
            >
              <FlashChart scene={scene} />
            </div>

            <div className="flex items-center justify-between mt-8">
              <div className="flex-1" />
              <div className="flex-1 flex justify-center">
                {chartSettings.legend && <ChartLegend series={config.series} chartType={chartType} />}
              </div>
              <div className="flex-1 flex justify-end">
                <ChartSettingsDropdown settings={chartSettings} onChange={setChartSettings} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
