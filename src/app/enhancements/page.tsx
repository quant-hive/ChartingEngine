"use client";

import { renderChart, FlashChart } from "@/lib/plot";

// ── E1: Dotted and dashdot lineStyle for hlines/vlines ──────────────────

function DottedLinesDemo() {
  const scene = renderChart({
    type: "line",
    title: "Reference Line Styles",
    subtitle: "All four lineStyle options on hlines and vlines",
    series: [
      { data: [10, 25, 18, 35, 28, 42, 38, 50, 45, 55], label: "Price", color: "#d4d4d4" },
    ],
    xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    hlines: [
      { y: 20, color: "#4ECDC4", lineStyle: "solid", label: "Support (solid)" },
      { y: 30, color: "#FFD93D", lineStyle: "dashed", label: "Mean (dashed)" },
      { y: 40, color: "#FF6B6B", lineStyle: "dotted", label: "Resistance (dotted)" },
      { y: 48, color: "#C084FC", lineStyle: "dashdot", label: "Target (dashdot)" },
    ],
    vlines: [
      { x: 3, color: "#67E8F9", lineStyle: "dotted" },
      { x: 7, color: "#EF8CFF", lineStyle: "dashdot" },
    ],
    grid: true,
  });

  return <FlashChart scene={scene} />;
}

// ── E2: Heatmap with 3-color diverging colorRange ───────────────────────

function HeatmapDivergingDemo() {
  // Monthly returns (%) for 5 strategies over 12 months
  const data = [
    [ 2.1, -0.5,  1.8,  3.2, -1.1,  0.4,  2.5, -0.8,  1.2,  0.9, -1.5,  3.8],
    [-0.3,  1.2,  0.5, -2.1,  1.8,  0.3, -0.7,  2.2,  0.1, -1.3,  1.5,  0.8],
    [ 0.8,  0.3, -1.2,  1.5,  0.6, -0.4,  1.1, -0.2,  0.9,  0.5, -0.8,  1.3],
    [ 3.5, -2.8,  4.1, -1.5,  2.9, -3.2,  5.1, -2.1,  3.8, -1.8,  4.5, -2.5],
    [ 0.2,  0.4,  0.1, -0.1,  0.3,  0.5,  0.2,  0.6,  0.3,  0.4,  0.1,  0.5],
  ];

  const scene = renderChart({
    type: "heatmap",
    title: "Monthly Returns (%)",
    subtitle: "Strategy × Month — diverging blue→white→red",
    heatmap: {
      data,
      rowLabels: ["Momentum", "Mean Rev", "Carry", "Vol Arb", "Market Neutral"],
      colLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      colorRange: ["#1565c0", "#ffffff", "#c62828"],
    },
  });

  return <FlashChart scene={scene} />;
}

function Heatmap2ColorDemo() {
  const data = [
    [0.92, 0.85, 0.45, 0.32],
    [0.85, 1.00, 0.52, 0.28],
    [0.45, 0.52, 1.00, 0.68],
    [0.32, 0.28, 0.68, 1.00],
  ];

  const scene = renderChart({
    type: "heatmap",
    title: "Correlation Matrix",
    subtitle: "2-color linear scale — dark to teal",
    heatmap: {
      data,
      rowLabels: ["AAPL", "MSFT", "GOOGL", "AMZN"],
      colLabels: ["AAPL", "MSFT", "GOOGL", "AMZN"],
      colorRange: ["#0d1117", "#4ECDC4"],
    },
  });

  return <FlashChart scene={scene} />;
}

// ── E3: Null values in data — gaps in line/area, skipped bars ───────────

function NullLineDemo() {
  const scene = renderChart({
    type: "line",
    title: "Line with Gaps",
    subtitle: "null values at indices 4-5 and 9 create visible breaks",
    series: [
      {
        data: [10, 18, 25, 22, null, null, 35, 42, 38, null, 50, 55],
        label: "Strategy",
        color: "#d4d4d4",
        fillOpacity: 0.12,
      },
      {
        data: [8, 12, 15, 18, 20, 22, 24, 26, 28, 30, 32, 34],
        label: "Benchmark",
        color: "#707070",
      },
    ],
    xLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    grid: true,
  });

  return <FlashChart scene={scene} />;
}

function NullBarDemo() {
  const scene = renderChart({
    type: "bar",
    title: "Bars with Missing Data",
    subtitle: "null at indices 2 and 5 — empty slots in the layout",
    series: [
      { data: [18, 25, null, 30, 22, null, 15], label: "Revenue", color: "#EF8CFF" },
    ],
    xLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    grid: true,
  });

  return <FlashChart scene={scene} />;
}

function NullScatterDemo() {
  const scene = renderChart({
    type: "scatter",
    title: "Scatter with Missing Y",
    subtitle: "null y-values at indices 2, 5, 8 are skipped",
    series: [
      {
        data: [5, 12, null, 8, 18, null, 25, 15, null, 30],
        x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        label: "Assets",
        color: "#4ECDC4",
        markerSize: 6,
      },
    ],
    grid: true,
  });

  return <FlashChart scene={scene} />;
}

// ── Section wrapper ─────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-white text-[18px] mb-1" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.15px" }}>
        {title}
      </h2>
      <p className="text-[#555] text-[12px] mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
        {description}
      </p>
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EnhancementsPage() {
  return (
    <div
      className="min-h-screen bg-[#121212] p-8"
      style={{ overflow: "auto", height: "100vh", position: "fixed", inset: 0 }}
    >
      <h1 className="text-white text-[28px] mb-1" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.3px" }}>
        Enhancement Tests
      </h1>
      <p className="text-[#555] text-[13px] mb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
        E1: dotted/dashdot hlines &middot; E2: heatmap with diverging colorRange &middot; E3: null data handling
      </p>

      <div className="max-w-[640px] flex flex-col gap-16">
        <Section
          title="E1 — Reference Line Styles"
          description="All four lineStyle options: solid (#4ECDC4), dashed (#FFD93D), dotted (#FF6B6B), dashdot (#C084FC). Two vlines with dotted and dashdot."
        >
          <DottedLinesDemo />
        </Section>

        <Section
          title="E2a — Heatmap (3-color diverging)"
          description="Monthly returns heatmap with blue→white→red diverging scale. Negative = blue, zero = white, positive = red."
        >
          <HeatmapDivergingDemo />
        </Section>

        <Section
          title="E2b — Heatmap (2-color linear)"
          description="Correlation matrix with dark→teal linear scale. Values 0→1."
        >
          <Heatmap2ColorDemo />
        </Section>

        <Section
          title="E3a — Line Chart with Null Gaps"
          description="Strategy line has nulls at indices 4-5 and 9. Should see 3 separate line segments with visible breaks. Benchmark is continuous."
        >
          <NullLineDemo />
        </Section>

        <Section
          title="E3b — Bar Chart with Null Skips"
          description="Revenue bars with null at Wed and Sat. Those slots should be empty — 5 bars rendered out of 7."
        >
          <NullBarDemo />
        </Section>

        <Section
          title="E3c — Scatter with Null Y-values"
          description="10 data points with 3 nulls at indices 2, 5, 8. Should see only 7 dots rendered."
        >
          <NullScatterDemo />
        </Section>
      </div>

      <div className="h-20" />
    </div>
  );
}
