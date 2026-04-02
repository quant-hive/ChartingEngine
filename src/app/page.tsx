"use client";

import React, { useState, useCallback } from "react";
import { FlashChart, PieChart, Surface3D, renderChart } from "@/lib/plot";
import type { Scene } from "@/lib/plot";
import { ChartSettingsDropdown, ChartHeader } from "@/lib/chartEngine";
import type { ChartSettings } from "@/lib/chartEngine";

// ── Default ChartSpec examples ──────────────────────────────────────────

const EXAMPLES: Record<string, string> = {
  line: JSON.stringify({
    type: "line",
    title: "Strategy vs Benchmark",
    subtitle: "Cumulative returns (%)",
    series: [
      { data: [0, 5, 12, 8, 18, 25, 20, 32, 28, 40], label: "Strategy", color: "#d4d4d4" },
      { data: [0, 3, 6, 5, 9, 12, 11, 15, 14, 18], label: "Benchmark", color: "#707070" },
    ],
    xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    grid: true,
  }, null, 2),

  bar: JSON.stringify({
    type: "bar",
    title: "Sector Allocation",
    subtitle: "Portfolio weight (%)",
    series: [
      { data: [28, 18, 15, 12, 14, 13], label: "Current", color: "#EF8CFF" },
      { data: [22, 20, 18, 10, 16, 14], label: "Target", color: "#8CA5FF" },
    ],
    xLabels: ["Tech", "Health", "Finance", "Energy", "Consumer", "Industrial"],
    grid: true,
  }, null, 2),

  pie: JSON.stringify({
    type: "pie",
    title: "Portfolio Allocation",
    slices: [
      { label: "US Equities", value: 35 },
      { label: "Intl Equities", value: 20 },
      { label: "Fixed Income", value: 15 },
      { label: "Real Estate", value: 12 },
      { label: "Commodities", value: 10 },
      { label: "Cash", value: 8 },
    ],
  }, null, 2),

  donut: JSON.stringify({
    type: "donut",
    title: "Revenue Breakdown",
    slices: [
      { label: "Subscriptions", value: 45 },
      { label: "Enterprise", value: 30 },
      { label: "API", value: 15 },
      { label: "Other", value: 10 },
    ],
    donutRatio: 0.55,
  }, null, 2),

  scatter: JSON.stringify({
    type: "scatter",
    title: "Risk vs Return",
    subtitle: "Annualized metrics",
    series: [
      { data: [8, 12, 6, 15, 10, 18, 5, 14], x: [5, 8, 3, 12, 7, 15, 2, 10], label: "Funds", color: "#4ECDC4", markerSize: 6 },
    ],
    xAxis: { label: "Volatility (%)" },
    yAxis: { label: "Return (%)" },
    grid: true,
  }, null, 2),

  area: JSON.stringify({
    type: "area",
    title: "AUM Growth",
    subtitle: "Assets under management ($M)",
    series: [
      { data: [100, 120, 115, 140, 160, 155, 180, 200, 195, 220, 250, 270], label: "AUM", color: "#C084FC", fillOpacity: 0.15 },
    ],
    xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    grid: true,
  }, null, 2),

  histogram: JSON.stringify({
    type: "histogram",
    title: "Return Distribution",
    subtitle: "Daily returns (20 bins)",
    series: [
      { data: [-3, -2.5, -2, -1.5, -1, -0.5, 0, 0.2, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2, -0.3, 0.1, 0.4, 0.7, -0.8, -0.2, 0.3, 0.6, 1.1, -1.2, 0.9, -0.1, 0.5, 1.3, -0.7, 2.5, 3, -2.8, 2.2, -1.8, 0.15, 0.65, 1.7, -0.65, 0.35], label: "Returns" },
    ],
    bins: 20,
  }, null, 2),

  surface: JSON.stringify({
    type: "surface_3d",
    title: "Volatility Surface",
    surface: {
      z: [
        [0.3, 0.28, 0.25, 0.23, 0.22, 0.21, 0.2, 0.19],
        [0.28, 0.26, 0.23, 0.21, 0.2, 0.19, 0.18, 0.18],
        [0.25, 0.23, 0.21, 0.19, 0.18, 0.17, 0.17, 0.17],
        [0.23, 0.21, 0.19, 0.18, 0.17, 0.16, 0.16, 0.16],
        [0.22, 0.2, 0.18, 0.17, 0.16, 0.16, 0.15, 0.15],
        [0.21, 0.19, 0.17, 0.16, 0.16, 0.15, 0.15, 0.15],
      ],
      wireframe: true,
    },
  }, null, 2),

  candlestick: JSON.stringify({
    type: "candlestick",
    title: "NVDA Price Action",
    subtitle: "Daily OHLC",
    series: [{
      data: [130, 135, 128, 140, 138, 145, 142, 150, 147, 155],
      open: [125, 130, 136, 127, 141, 137, 146, 141, 151, 146],
      high: [132, 137, 138, 142, 143, 147, 148, 152, 153, 157],
      low: [123, 128, 126, 125, 136, 135, 140, 139, 145, 144],
      close: [130, 135, 128, 140, 138, 145, 142, 150, 147, 155],
    }],
    xLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Mon", "Tue", "Wed", "Thu", "Fri"],
  }, null, 2),

  waterfall: JSON.stringify({
    type: "waterfall",
    title: "P&L Bridge",
    subtitle: "Quarterly revenue breakdown ($M)",
    series: [{ data: [50, 12, -8, 25, -15, 5, -3, 18], label: "Revenue" }],
    xLabels: ["Base", "Sales", "Churn", "Upsell", "Refunds", "Services", "Costs", "Growth"],
    grid: true,
  }, null, 2),

  heatmap: JSON.stringify({
    type: "heatmap",
    title: "Correlation Matrix",
    heatmap: {
      data: [
        [1.0, 0.85, 0.32, -0.15, 0.45],
        [0.85, 1.0, 0.28, -0.22, 0.38],
        [0.32, 0.28, 1.0, 0.65, -0.12],
        [-0.15, -0.22, 0.65, 1.0, -0.35],
        [0.45, 0.38, -0.12, -0.35, 1.0],
      ],
      rowLabels: ["SPY", "QQQ", "GLD", "TLT", "VIX"],
      colLabels: ["SPY", "QQQ", "GLD", "TLT", "VIX"],
    },
  }, null, 2),
};

// ── Pie color defaults ──────────────────────────────────────────────────

const PIE_COLORS = ["#4aaaba", "#d8b4fe", "#fbbf24", "#f9a8d4", "#6dd5c8", "#a5f3d8", "#C084FC", "#FF6B6B", "#67E8F9", "#FFD93D"];

// ── Types ───────────────────────────────────────────────────────────────

interface RenderResult {
  componentHint: "FlashChart" | "PieChart" | "Surface3D";
  chartType: string;
  scene?: Scene;
  pieData?: { slices: { label: string; value: number; color: string }[]; donut: boolean; donutRatio: number };
  surfaceData?: { z: number[][]; x?: number[][]; y?: number[][]; wireframe: boolean };
  svg?: string;
  error?: string;
}

type RenderMode = "local" | "api";

// ── Page ────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [specText, setSpecText] = useState(EXAMPLES.bar);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<RenderMode>("local");
  const [activeExample, setActiveExample] = useState("bar");
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    gridLines: true, axisLabels: true, legend: true, theme: "naked",
  });

  const handleRender = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const rawSpec = JSON.parse(specText);
      const spec = {
        ...rawSpec,
        title: undefined,
        subtitle: undefined,
        grid: chartSettings.gridLines,
        legend: { show: chartSettings.legend },
      };

      if (mode === "api") {
        const res = await fetch("/api/chart/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spec }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResult(data);
      } else {
        const type = spec.type;

        if (type === "pie" || type === "donut") {
          const slices = (spec.slices ?? []).map((s: any, i: number) => ({
            label: s.label,
            value: s.value,
            color: s.color ?? PIE_COLORS[i % PIE_COLORS.length],
          }));
          setResult({
            componentHint: "PieChart",
            chartType: type,
            pieData: { slices, donut: type === "donut", donutRatio: spec.donutRatio ?? 0.55 },
          });
        } else if (type === "surface" || type === "surface_3d") {
          setResult({
            componentHint: "Surface3D",
            chartType: type,
            surfaceData: spec.surface ? { ...spec.surface, wireframe: spec.surface.wireframe ?? true } : undefined,
          });
        } else {
          const scene = renderChart(spec);
          setResult({ componentHint: "FlashChart", chartType: type, scene });
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to render");
    } finally {
      setLoading(false);
    }
  }, [specText, mode, chartSettings]);

  const loadExample = (key: string) => {
    setActiveExample(key);
    setSpecText(EXAMPLES[key]);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-normal" style={{ fontFamily: "var(--font-eb-garamond), 'EB Garamond', Georgia, serif" }}>
            Flash Plot Playground
          </h1>
          <p className="text-[#707070] text-[13px] mt-1">
            Paste a ChartSpec JSON and render it. Same schema as the <code className="text-[#9a6dd7]">chart_render</code> MCP tool.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/test" className="text-[12px] text-[#707070] hover:text-[#999] transition-colors">
            Gallery
          </a>
          <a href="https://github.com/quant-hive/ChartingEngine" target="_blank" className="text-[12px] text-[#707070] hover:text-[#999] transition-colors">
            GitHub
          </a>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left: Editor */}
        <div className="w-[480px] flex-shrink-0 border-r border-[#2a2a2a] flex flex-col">
          {/* Example buttons */}
          <div className="px-4 py-3 border-b border-[#2a2a2a] flex flex-wrap gap-1.5">
            {Object.keys(EXAMPLES).map((key) => (
              <button
                key={key}
                onClick={() => loadExample(key)}
                className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer capitalize"
                style={{
                  background: activeExample === key ? "#9a6dd7" : "#1e1f24",
                  color: activeExample === key ? "#fff" : "#888",
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {/* JSON editor */}
          <div className="flex-1 p-4 overflow-hidden">
            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              spellCheck={false}
              className="w-full h-full bg-[#0f0f0f] text-[#d4d4d4] text-[12px] leading-[1.6] p-4 rounded-lg border border-[#2a2a2a] resize-none outline-none focus:border-[#9a6dd7] transition-colors"
              style={{ fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace" }}
            />
          </div>

          {/* Controls */}
          <div className="px-4 py-3 border-t border-[#2a2a2a] flex items-center gap-3">
            <div className="flex rounded-md overflow-hidden border border-[#2a2a2a]">
              {(["local", "api"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer"
                  style={{
                    background: mode === m ? "#2a2a2a" : "transparent",
                    color: mode === m ? "#fff" : "#555",
                  }}
                >
                  {m === "local" ? "Local" : "API"}
                </button>
              ))}
            </div>

            <button
              onClick={handleRender}
              disabled={loading}
              className="flex-1 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer"
              style={{ background: "#9a6dd7", color: "#fff", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Rendering..." : "Render Chart"}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Status bar */}
          {result && (
            <div className="px-6 py-2 border-b border-[#2a2a2a] flex items-center gap-4 text-[11px]">
              <span className="text-[#707070]">Component:</span>
              <span className="text-[#4ECDC4] font-medium">{result.componentHint}</span>
              <span className="text-[#707070]">Type:</span>
              <span className="text-[#C084FC] font-medium">{result.chartType}</span>
              {result.scene && (
                <>
                  <span className="text-[#707070]">Elements:</span>
                  <span className="text-[#FFD93D] font-medium">{result.scene.subplots?.[0]?.elements?.length ?? 0}</span>
                </>
              )}
            </div>
          )}

          {/* Chart preview */}
          <div className="flex-1 flex items-center justify-center p-8">
            {error && (
              <div className="bg-[#2a1a1a] border border-[#ff4444] rounded-lg px-6 py-4 max-w-[500px]">
                <p className="text-[#ff6b6b] text-[13px] font-medium mb-1">Render Error</p>
                <p className="text-[#ff9999] text-[12px]">{error}</p>
              </div>
            )}

            {!result && !error && (
              <div className="text-[#333] text-[14px]">
                Select a chart type above and click Render
              </div>
            )}

            {result && (() => {
              const outerCls = chartSettings.theme === "light" ? "fp-light" : "";
              const innerCls = chartSettings.axisLabels ? "" : "fp-hide-axis-labels";
              const bg = chartSettings.theme === "naked" ? "transparent" : chartSettings.theme === "light" ? "#fafafa" : "#121212";
              const parsedSpec = (() => { try { return JSON.parse(specText); } catch { return {}; } })();

              return (
                <div className={`w-full max-w-[800px] relative pt-4 pb-4 px-4 rounded-lg ${outerCls}`} style={{ background: bg }}>
                  <div className="absolute top-4 right-4 z-10">
                    <ChartSettingsDropdown settings={chartSettings} onChange={setChartSettings} />
                  </div>
                  <ChartHeader title={parsedSpec.title} subtitle={parsedSpec.subtitle} />

                  {result.componentHint === "FlashChart" && result.scene && (
                    <div className={`w-full ${innerCls}`}>
                      <FlashChart scene={result.scene} />
                    </div>
                  )}

                  {result.componentHint === "PieChart" && result.pieData && (
                    <div className={chartSettings.theme === "light" ? "fp-light" : ""}>
                      <PieChart
                        data={result.pieData.slices}
                        donut={result.pieData.donut}
                        donutRatio={result.pieData.donutRatio}
                        showLegend={chartSettings.legend}
                        lightTheme={chartSettings.theme === "light"}
                      />
                    </div>
                  )}

                  {result.componentHint === "Surface3D" && result.surfaceData && (
                    <Surface3D
                      z={result.surfaceData.z}
                      x={result.surfaceData.x}
                      y={result.surfaceData.y}
                      wireframe={result.surfaceData.wireframe}
                    />
                  )}
                </div>
              );
            })()}
          </div>

          {/* Scene JSON preview */}
          {result && <ScenePreview result={result} />}
        </div>
      </div>
    </div>
  );
}

// ── Collapsible Scene JSON viewer ───────────────────────────────────────

function ScenePreview({ result }: { result: RenderResult }) {
  const [expanded, setExpanded] = useState(false);
  const json = JSON.stringify(result, null, 2);
  const lines = json.split("\n").length;

  return (
    <div className="border-t border-[#2a2a2a]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-2 flex items-center justify-between text-[11px] text-[#707070] hover:text-[#999] transition-colors cursor-pointer"
      >
        <span>Response JSON ({lines} lines)</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="px-6 pb-4 max-h-[300px] overflow-auto">
          <pre className="text-[11px] leading-[1.5] text-[#666] bg-[#0f0f0f] rounded-lg p-4 border border-[#2a2a2a] overflow-x-auto" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}
