"use client";

import { figure, FlashChart, PieChart } from "@/lib/plot";
import type { PieSlice } from "@/lib/plot";

// Seeded pseudo-random for deterministic data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── 1. Line Chart ────────────────────────────────────────────────────────

function LineDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const strategy = [0, 5, -8, 15, 10, 25, 18, 55, 35, 80, 45, 30, 20, 50, 38, 25, 15, 10, 18, 30, 22, 15, 55, 40, 65, 20, 38, 50, 35, 80, 110, 60, 95, 75, 130, 105, 85, 140, 120, 100];
  const benchmark = [5, 8, 10, 12, 15, 14, 16, 18, 15, 20, 18, 14, 16, 15, 12, 18, 16, 14, 15, 18, 16, 14, 12, 15, 18, 16, 14, 15, 18, 16, 14, 15, 18, 16, 14, 15, 18, 16, 15, 14];

  ax.set_title("Cumulative Returns");
  ax.set_subtitle("Strategy vs Benchmark — Jun 2020 to Mar 2022");
  ax.plot(strategy, { color: "#d4d4d4", label: "Strategy" });
  ax.plot(benchmark, { color: "#707070", label: "Benchmark" });

  const xIdx = strategy.map((_, i) => i);
  ax.fill_between(xIdx, strategy, 0, { color: "#d4d4d4", alpha: 0.15 });

  ax.set_xticks(["Jun 20", "Sep 20", "Dec 20", "Mar 21", "Jun 21", "Sep 21", "Dec 21", "Mar 22"]);
  ax.grid(true);
  ax.legend();

  return <FlashChart scene={fig.render()} />;
}

// ── 2. Multi-line Styles ─────────────────────────────────────────────────

function MultiLineDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const ma20 = [100, 102, 105, 103, 108, 112, 110, 115, 118, 120, 117, 122, 125, 128, 130, 126, 132, 135, 138, 140];
  const ma50 = [98, 99, 101, 102, 104, 106, 108, 110, 112, 114, 115, 116, 118, 120, 122, 124, 126, 128, 130, 132];
  const ma200 = [95, 96, 97, 98, 99, 100, 101, 102, 103, 105, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124];

  ax.plot(ma20, { color: "#d4d4d4", label: "MA 20", linestyle: "solid" });
  ax.plot(ma50, { color: "#4ECDC4", label: "MA 50", linestyle: "dashed" });
  ax.plot(ma200, { color: "#FFD93D", label: "MA 200", linestyle: "dotted" });

  ax.set_xticks(["Jan", "Mar", "May", "Jul", "Sep", "Nov", "Jan", "Mar"]);
  ax.grid(true);
  ax.legend();

  return <FlashChart scene={fig.render()} />;
}

// ── 3. Area Chart (fill_between with baseline) ──────────────────────────

function AreaDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const drawdown = [0, -5, -2, -12, -8, -18, -10, -25, -15, -30, -20, -8, -5, -15, -22, -10, -3, -8, -18, -12];
  const xIdx = drawdown.map((_, i) => i);

  ax.plot(drawdown, { color: "#FF6B6B", label: "Drawdown" });
  ax.fill_between(xIdx, drawdown, 0, { color: "#FF6B6B", alpha: 0.2 });
  ax.axhline(0, { color: "#494949", linestyle: "dashed" });

  ax.set_xticks(["Jan", "Mar", "May", "Jul", "Sep", "Nov"]);
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 4. Bar Chart (single series) ─────────────────────────────────────────

function SingleBarDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const labels = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"];
  const weights = [18, 15, 12, 10, 9, 8, 6];

  ax.bar(labels, weights, { label: "Weight %" });
  ax.set_xticks(labels);
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 5. Grouped Bar Chart ─────────────────────────────────────────────────

function GroupedBarDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const labels = ["Q1 23", "Q2 23", "Q3 23", "Q4 23", "Q1 24", "Q2 24", "Q3 24", "Q4 24"];
  const momentum = [12, 18, 8, 25, 32, 15, -5, 10];
  const spx = [10, 14, 12, 18, 15, 8, -2, 5];

  ax.set_title("Quarterly Returns");
  ax.set_subtitle("Dual Momentum vs S&P 500");
  ax.bar(labels, momentum, { label: "Dual Momentum" });
  ax.bar(labels, spx, { label: "S&P 500" });
  ax.set_xticks(labels);
  ax.grid(true);
  ax.legend();

  return <FlashChart scene={fig.render()} />;
}

// ── 6. Scatter Plot ──────────────────────────────────────────────────────

function ScatterDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const rand = seededRandom(42);
  const n = 50;
  const xData = Array.from({ length: n }, () => rand() * 25);
  const yData = xData.map((x) => x * 0.8 + (rand() - 0.5) * 20);
  const sizes = Array.from({ length: n }, () => 3 + rand() * 10);

  ax.scatter(xData, yData, { s: sizes, color: "#4ECDC4", label: "Assets" });
  ax.axhline(0, { color: "#707070", linestyle: "dashed" });
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 7. Histogram ─────────────────────────────────────────────────────────

function HistogramDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const rand = seededRandom(123);
  // Approximate normal distribution via CLT
  const returns: number[] = [];
  for (let i = 0; i < 500; i++) {
    let sum = 0;
    for (let j = 0; j < 6; j++) sum += rand();
    returns.push((sum - 3) * 4);
  }

  ax.hist(returns, { bins: 20, color: "#C084FC", label: "Daily Returns" });
  ax.axvline(0, { color: "#707070", linestyle: "dashed" });
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 8. Reference Lines ───────────────────────────────────────────────────

function ReferenceLinesDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const price = [145, 148, 142, 155, 160, 158, 165, 170, 168, 175, 180, 172, 185, 190, 188, 195, 200, 198, 205, 210];

  ax.plot(price, { color: "#d4d4d4", label: "Price" });
  ax.axhline(200, { color: "#FF6B6B", linestyle: "dashed" });
  ax.axhline(155, { color: "#4ECDC4", linestyle: "dashed" });
  ax.axhline(175, { color: "#FFD93D", linestyle: "dotted" });

  ax.set_xticks(["W1", "W4", "W8", "W12", "W16", "W20"]);
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 9. Text & Annotations ────────────────────────────────────────────────

function AnnotationDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const data = [10, 15, 12, 28, 25, 35, 30, 45, 40, 55, 48, 62, 58, 75, 70, 85, 80, 95, 90, 100];
  const xIdx = data.map((_, i) => i);

  ax.plot(data, { color: "#d4d4d4", label: "Growth" });
  ax.fill_between(xIdx, data, 0, { color: "#d4d4d4", alpha: 0.08 });

  // Annotate the peak
  ax.annotate("ATH", [19, 100], [15, 110], {
    color: "#4ECDC4", fontsize: 10,
    arrowprops: { color: "#4ECDC4", lw: 1 },
  });

  // Text label
  ax.text(2, 85, "Breakout zone", { color: "#FFD93D", fontsize: 9 });

  ax.set_xticks(["Jan", "Apr", "Jul", "Oct", "Dec"]);
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 10. Stacked Area ─────────────────────────────────────────────────────

function StackedAreaDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const equities = [40, 42, 45, 43, 48, 50, 52, 55, 53, 58, 60, 62, 65, 63, 68, 70];
  const bonds = [25, 26, 24, 27, 26, 28, 27, 29, 28, 30, 29, 31, 30, 32, 31, 33];
  const cash = [10, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10];
  const x = equities.map((_, i) => i);

  // Cumulative stacks
  const total = equities.map((e, i) => e + bonds[i] + cash[i]);
  const eqBond = equities.map((e, i) => e + bonds[i]);

  // Fill between adjacent layers
  ax.fill_between(x, total, eqBond, { color: "#67E8F9", alpha: 0.3 });
  ax.fill_between(x, eqBond, equities, { color: "#FFD93D", alpha: 0.3 });
  ax.fill_between(x, equities, 0, { color: "#4ECDC4", alpha: 0.3 });

  // Line borders
  ax.plot(total, { color: "#67E8F9", label: "Cash" });
  ax.plot(eqBond, { color: "#FFD93D", label: "Bonds" });
  ax.plot(equities, { color: "#4ECDC4", label: "Equities" });

  ax.set_xticks(["Q1 22", "Q2 22", "Q3 22", "Q4 22", "Q1 23", "Q2 23", "Q3 23", "Q4 23"]);
  ax.grid(true);
  ax.legend();

  return <FlashChart scene={fig.render()} />;
}

// ── 11. Multi-series Line with fill_between band ─────────────────────────

function ConfidenceBandDemo() {
  const fig = figure();
  const ax = fig.subplot(1, 1, 1);

  const mean = [50, 52, 55, 53, 58, 62, 60, 65, 68, 70, 67, 72, 75, 78, 80, 76, 82, 85, 88, 90];
  const upper = mean.map((v) => v + 12);
  const lower = mean.map((v) => v - 12);
  const x = mean.map((_, i) => i);

  ax.fill_between(x, upper, lower, { color: "#4ECDC4", alpha: 0.15 });
  ax.plot(mean, { color: "#4ECDC4", label: "Mean Return", linewidth: 1.5 });
  ax.plot(upper, { color: "#4ECDC4", linestyle: "dashed", alpha: 0.5 });
  ax.plot(lower, { color: "#4ECDC4", linestyle: "dashed", alpha: 0.5 });

  ax.set_xticks(["Jan", "Mar", "May", "Jul", "Sep", "Nov"]);
  ax.grid(true);
  ax.legend();

  return <FlashChart scene={fig.render()} />;
}

// ── 12. Pie Chart ─────────────────────────────────────────────────────────

const portfolioAllocation: PieSlice[] = [
  { label: "US Equities", value: 42, color: "#d4d4d4" },
  { label: "Int'l Equities", value: 18, color: "#707070" },
  { label: "Fixed Income", value: 22, color: "#4ECDC4" },
  { label: "Alternatives", value: 10, color: "#FFD93D" },
  { label: "Cash", value: 8, color: "#C084FC" },
];

function PieDemo() {
  return <PieChart data={portfolioAllocation} />;
}

// ── 13. Donut Chart ───────────────────────────────────────────────────────

const sectorExposure: PieSlice[] = [
  { label: "Technology", value: 31, color: "#8CA5FF" },
  { label: "Healthcare", value: 16, color: "#4ECDC4" },
  { label: "Financials", value: 14, color: "#FFD93D" },
  { label: "Consumer", value: 12, color: "#EF8CFF" },
  { label: "Energy", value: 9, color: "#FF6B6B" },
  { label: "Industrials", value: 8, color: "#67E8F9" },
  { label: "Other", value: 10, color: "#555555" },
];

function DonutDemo() {
  return <PieChart data={sectorExposure} donut size={220} />;
}

// ── 14. Small Donut (Compact) ─────────────────────────────────────────────

const riskBreakdown: PieSlice[] = [
  { label: "Equity Risk", value: 55, color: "#FF6B6B" },
  { label: "Rate Risk", value: 25, color: "#4ECDC4" },
  { label: "Credit Risk", value: 12, color: "#FFD93D" },
  { label: "FX Risk", value: 8, color: "#8CA5FF" },
];

function CompactDonutDemo() {
  return <PieChart data={riskBreakdown} donut donutRatio={0.65} size={180} />;
}

// ── Section wrapper ──────────────────────────────────────────────────────

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

// ── Test Page ────────────────────────────────────────────────────────────

export default function TestPage() {
  return (
    <div
      className="min-h-screen bg-[#121212] p-8"
      style={{ overflow: "auto", height: "100vh", position: "fixed", inset: 0 }}
    >
      <h1 className="text-white text-[28px] mb-1" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.3px" }}>
        Flash Plot Engine
      </h1>
      <p className="text-[#555] text-[13px] mb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
        All chart types &middot; matplotlib-like API &rarr; Scene graph &rarr; Animated SVG
      </p>

      <div className="max-w-[640px] flex flex-col gap-16">
        <Section title="1. Line Chart" description="ax.plot(data) with title, subtitle (EB Garamond serif), and area fill">
          <LineDemo />
        </Section>

        <Section title="2. Multi-line Styles" description="solid, dashed, dotted line styles with ax.plot({ linestyle })">
          <MultiLineDemo />
        </Section>

        <Section title="3. Area Chart (Drawdown)" description="ax.fill_between(x, y, 0) with axhline reference">
          <AreaDemo />
        </Section>

        <Section title="4. Bar Chart (Single Series)" description="ax.bar(labels, data) — Figma 9-layer bars with hover">
          <SingleBarDemo />
        </Section>

        <Section title="5. Grouped Bar Chart" description="Two ax.bar() calls — title + subtitle, grouped multi-series with sweep animation">
          <GroupedBarDemo />
        </Section>

        <Section title="6. Scatter Plot" description="ax.scatter(x, y, { s: sizes }) with variable-size markers">
          <ScatterDemo />
        </Section>

        <Section title="7. Histogram" description="ax.hist(data, { bins: 20 }) — auto-binned frequency distribution">
          <HistogramDemo />
        </Section>

        <Section title="8. Reference Lines" description="ax.axhline(y) — support, resistance, mean levels">
          <ReferenceLinesDemo />
        </Section>

        <Section title="9. Text & Annotations" description="ax.text(x, y, str) and ax.annotate(str, xy, xytext) with arrow">
          <AnnotationDemo />
        </Section>

        <Section title="10. Stacked Area" description="Multiple fill_between(x, y1, y2) layers with line borders">
          <StackedAreaDemo />
        </Section>

        <Section title="11. Confidence Band" description="fill_between(x, upper, lower) with mean line and dashed bounds">
          <ConfidenceBandDemo />
        </Section>

        <Section title="12. Pie Chart" description="Portfolio allocation — PieChart with hover explode and inline legend">
          <PieDemo />
        </Section>

        <Section title="13. Donut Chart" description="Sector exposure — PieChart with donut cutout and center label">
          <DonutDemo />
        </Section>

        <Section title="14. Compact Donut" description="Risk breakdown — smaller donut with higher donutRatio">
          <CompactDonutDemo />
        </Section>
      </div>

      <div className="h-20" />
    </div>
  );
}
