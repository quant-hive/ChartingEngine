"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { fetchGraphData, type GraphApiResponse } from "./graphApi";
import { FlashChart, renderChart, type ChartSpec, PieChart, extractPieSlices, Surface3D, type SurfaceMode, CandlestickChart, extractCandlestickData } from "./plot";
import { FLASH_DARK } from "./plot/core";

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
                style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif" }}
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
            style={{ fontFamily: "'Inter', sans-serif" }}
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
      <div className={`w-full ${innerCls}`} key={`${config.title}-${chartType}`}>
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
        fontFamily: "'Inter', sans-serif",
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
            fontFamily: "var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif",
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
          style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.1px" }}
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
        <span className="text-[9px] text-[#444]" style={{ fontFamily: "'Inter', sans-serif" }}>
          {surfaceMode === "3D" ? "drag to rotate · scroll to zoom · double-click to reset" : ""}
        </span>
        <div className="flex rounded-full overflow-hidden border border-[#2a2a2a]" style={{ fontFamily: "'Inter', sans-serif" }}>
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
      <div className="w-full">{chartBody}</div>
      {extraControls && (
        <div className="flex items-center justify-between pb-2">
          {extraControls}
        </div>
      )}
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
              key={`${config.title}-${chartType}`}
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
