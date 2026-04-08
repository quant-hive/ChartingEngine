"use client";

import { figure, FlashChart, CandlestickChart, Surface3D } from "@/lib/plot";
import type { CandlestickData } from "@/lib/plot";

// ── Seeded RNG ────────────────────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── 1. Waterfall Chart — P&L Attribution ─────────────────────────────────

function WaterfallDemo() {
  const fig = figure({ width: 620, height: 280 });
  const ax = fig.subplot(1, 1, 1);

  // P&L contributions (positive = gain, negative = loss; last bar is "Total")
  const labels = ["Equities", "Fixed\nIncome", "Alts", "Fx\nHedge", "Alpha", "Costs", "Total"];
  const values = [42, 18, 12, -8, 25, -15, 0]; // Total is computed by waterfall

  // Compute running total for the "Total" bar
  const running = values.slice(0, -1).reduce((a, b) => a + b, 0);
  const data = [...values.slice(0, -1), running];

  ax.set_title("P&L Attribution");
  ax.set_subtitle("Quarterly contributions by asset class — Q1 2024");

  let cumulative = 0;
  for (let i = 0; i < data.length; i++) {
    const isTotal = i === data.length - 1;
    const val = data[i];
    const color = isTotal ? "#8CA5FF" : val >= 0 ? "#4ECDC4" : "#FF6B6B";
    const bottom = isTotal ? 0 : val >= 0 ? cumulative : cumulative + val;
    ax.bar([i], [Math.abs(isTotal ? val : val)], {
      color,
      width: 0.65,
      bottom: [bottom],
    });
    if (!isTotal) cumulative += val;
  }

  // Zero baseline
  ax.axhline(0, { color: "#333", linestyle: "solid" });
  ax.set_xticks(labels);
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 2. Violin Plot — Strategy Return Distributions ────────────────────────

function ViolinDemo() {
  const fig = figure({ width: 620, height: 300 });
  const ax = fig.subplot(1, 1, 1);

  const rand = seededRandom(77);
  function normal(mean: number, std: number, n: number) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < 6; j++) s += rand();
      out.push((s - 3) * (std / 1.5) + mean);
    }
    return out;
  }

  ax.set_title("Return Distributions");
  ax.set_subtitle("Daily returns by strategy — 2023 backtest");

  const strategies = [
    { name: "Momentum", data: normal(0.08, 1.8, 250), color: "#C084FC" },
    { name: "Mean Rev", data: normal(0.04, 0.9, 250), color: "#4ECDC4" },
    { name: "Carry",    data: normal(0.12, 0.6, 250), color: "#FFD93D" },
    { name: "Vol Arb",  data: normal(0.02, 2.4, 250), color: "#FF6B6B" },
  ];

  for (let i = 0; i < strategies.length; i++) {
    const { data, color } = strategies[i];
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0], max = sorted[n - 1];
    const range = max - min || 1;
    const bw = range * 0.15;
    const nPts = 40;

    const kde: { y: number; d: number }[] = [];
    for (let j = 0; j < nPts; j++) {
      const y = min + (j / (nPts - 1)) * range;
      let d = 0;
      for (const v of data) {
        const u = (y - v) / bw;
        d += Math.exp(-0.5 * u * u);
      }
      d /= n * bw;
      kde.push({ y, d });
    }

    const maxD = Math.max(...kde.map((k) => k.d)) || 1;
    const hw = 0.35;
    const xR = kde.map((k) => i + (k.d / maxD) * hw);
    const xL = kde.map((k) => i - (k.d / maxD) * hw);
    const ys = kde.map((k) => k.y);

    ax.fill_between(xR, ys, ys.map(() => i), { color, alpha: 0.25 });
    ax.plot(xR, ys, { color, linewidth: 1.5 });
    ax.fill_between(xL, ys, ys.map(() => i), { color, alpha: 0.25 });
    ax.plot(xL, ys, { color, linewidth: 1.5, label: strategies[i].name });

    const med = sorted[Math.floor(n / 2)];
    const medIdx = kde.reduce((b, k, idx) =>
      Math.abs(k.y - med) < Math.abs(kde[b].y - med) ? idx : b, 0);
    const medW = (kde[medIdx].d / maxD) * hw;
    ax.plot([i - medW, i + medW], [med, med], { color: "#fff", linewidth: 2 });
  }

  ax.set_xticks(strategies.map((s) => s.name));
  ax.axhline(0, { color: "#494949", linestyle: "dashed" });
  ax.grid(true);
  ax.legend();

  return <FlashChart scene={fig.render()} />;
}

// ── 3. Boxplot — Annual Returns by Year ───────────────────────────────────

function BoxplotDemo() {
  const fig = figure({ width: 620, height: 300 });
  const ax = fig.subplot(1, 1, 1);

  const rand = seededRandom(55);
  const years = ["2019", "2020", "2021", "2022", "2023", "2024"];
  const palette = ["#C084FC", "#4ECDC4", "#FFD93D", "#FF6B6B", "#67E8F9", "#8CA5FF"];

  function normalSample(mean: number, std: number, n: number) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < 6; j++) s += rand();
      out.push((s - 3) * (std / 1.5) + mean);
    }
    return out;
  }

  ax.set_title("Annual Return Distribution");
  ax.set_subtitle("Daily return percentiles by year — S&P 500");

  const yearParams = [
    { mean: 0.12, std: 0.8 },
    { mean: -0.05, std: 2.5 },
    { mean: 0.25, std: 1.2 },
    { mean: -0.18, std: 1.8 },
    { mean: 0.15, std: 0.9 },
    { mean: 0.22, std: 0.7 },
  ];

  for (let i = 0; i < years.length; i++) {
    const color = palette[i];
    const sorted = [...normalSample(yearParams[i].mean, yearParams[i].std, 252)].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const med = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const wLow = Math.max(sorted[0], q1 - 1.5 * iqr);
    const wHigh = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
    const outliers = sorted.filter((v) => v < wLow || v > wHigh);

    // Box
    ax.bar([i], [q3 - q1 || 0.001], { color, width: 0.5, bottom: [q1] });
    // Median
    ax.plot([i - 0.25, i + 0.25], [med, med], { color: "#fff", linewidth: 2 });
    // Lower whisker
    ax.bar([i], [q1 - wLow], { color: "#808080", width: 0.06, bottom: [wLow] });
    // Upper whisker
    ax.bar([i], [wHigh - q3], { color: "#808080", width: 0.06, bottom: [q3] });
    // Caps
    ax.plot([i - 0.15, i + 0.15], [wLow, wLow], { color: "#808080", linewidth: 1.5 });
    ax.plot([i - 0.15, i + 0.15], [wHigh, wHigh], { color: "#808080", linewidth: 1.5 });
    // Outliers
    if (outliers.length > 0) {
      ax.scatter(outliers.map(() => i), outliers, { color, s: 3 });
    }
  }

  ax.set_xticks(years);
  ax.axhline(0, { color: "#494949", linestyle: "dashed" });
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── 4. Candlestick — OHLC Chart ───────────────────────────────────────────

function CandlestickDemo() {
  const rand = seededRandom(99);
  const n = 40;

  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  const labels: string[] = [];

  // Generate realistic OHLC data
  let price = 185;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  for (let i = 0; i < n; i++) {
    const o = price + (rand() - 0.5) * 2;
    const c = o + (rand() - 0.48) * 4;
    const h = Math.max(o, c) + rand() * 2;
    const l = Math.min(o, c) - rand() * 2;
    open.push(+o.toFixed(2));
    close.push(+c.toFixed(2));
    high.push(+h.toFixed(2));
    low.push(+l.toFixed(2));
    if (i % 5 === 0) labels.push(months[Math.floor(i / 5) % months.length]);
    else labels.push("");
    price = c;
  }

  const data: CandlestickData = {
    open, high, low, close, labels,
    ticker: "AAPL",
    interval: "1D",
  };

  return (
    <CandlestickChart
      data={data}
      title="AAPL"
      subtitle="Daily · Jan–Aug 2024"
      timeframes={["1H", "4H", "1D", "1W"]}
      activeTimeframe="1D"
    />
  );
}

// ── 5. 3D Surface — Implied Volatility Surface ────────────────────────────

function Surface3DDemo() {
  const strikes = 16;
  const expiries = 12;

  // IV surface: smile shape + term structure
  const z: number[][] = [];
  for (let row = 0; row < expiries; row++) {
    const rowData: number[] = [];
    const t = row / (expiries - 1); // 0 = short expiry, 1 = long
    for (let col = 0; col < strikes; col++) {
      const moneyness = (col / (strikes - 1)) - 0.5; // -0.5 to +0.5
      // IV smile: higher at wings, decreasing with time (term structure)
      const smile = 0.25 + 1.5 * moneyness * moneyness;
      const termDecay = 0.9 - t * 0.25;
      const skew = -0.3 * moneyness; // downward skew
      rowData.push(smile * termDecay + skew + 0.02);
    }
    z.push(rowData);
  }

  return (
    <Surface3D
      z={z}
      color="#C084FC"
      wireframe
      title="Implied Volatility Surface"
      subtitle="SPX options · Strike × Expiry · Apr 2024"
      width={620}
      height={340}
    />
  );
}

// ── 6. Bubble Chart — Risk vs Return ─────────────────────────────────────

function BubbleDemo() {
  const fig = figure({ width: 620, height: 300 });
  const ax = fig.subplot(1, 1, 1);

  const assets = [
    { name: "AAPL",  ret: 24,  vol: 18, mktcap: 40 },
    { name: "MSFT",  ret: 28,  vol: 16, mktcap: 38 },
    { name: "GOOGL", ret: 16,  vol: 20, mktcap: 28 },
    { name: "AMZN",  ret: 12,  vol: 22, mktcap: 26 },
    { name: "NVDA",  ret: 85,  vol: 45, mktcap: 35 },
    { name: "META",  ret: 35,  vol: 30, mktcap: 20 },
    { name: "TSLA",  ret: -18, vol: 55, mktcap: 18 },
    { name: "BRK",   ret: 14,  vol: 12, mktcap: 30 },
    { name: "JPM",   ret: 22,  vol: 14, mktcap: 22 },
    { name: "V",     ret: 18,  vol: 11, mktcap: 15 },
  ];

  const x = assets.map((a) => a.vol);
  const y = assets.map((a) => a.ret);
  const sizes = assets.map((a) => a.mktcap / 4);

  const palette = ["#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#8CA5FF",
                   "#EF8CFF", "#FCA5A5", "#d4d4d4", "#4aaaba"];

  for (let i = 0; i < assets.length; i++) {
    ax.scatter([x[i]], [y[i]], { color: palette[i % palette.length], s: sizes[i] });
    ax.text(x[i] + 0.8, y[i], assets[i].name, { color: "#808080", fontsize: 8 });
  }

  ax.set_title("Risk vs Return");
  ax.set_subtitle("Bubble size = market cap weight · 2023 annual returns");
  ax.axhline(0, { color: "#494949", linestyle: "dashed" });
  ax.set_xlabel("Volatility (%)");
  ax.set_ylabel("Return (%)");
  ax.grid(true);

  return <FlashChart scene={fig.render()} />;
}

// ── Section wrapper ───────────────────────────────────────────────────────

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

// ── Demo Page ─────────────────────────────────────────────────────────────

export default function DemoPage() {
  return (
    <div
      className="min-h-screen bg-[#121212] p-8"
      style={{ overflow: "auto", height: "100vh", position: "fixed", inset: 0 }}
    >
      <h1 className="text-white text-[28px] mb-1" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.3px" }}>
        Flash Plot — Advanced Charts
      </h1>
      <p className="text-[#555] text-[13px] mb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
        Waterfall · Violin · Boxplot · Candlestick · 3D Surface · Bubble
      </p>

      <div className="max-w-[640px] flex flex-col gap-16">
        <Section
          title="1. Waterfall — P&L Attribution"
          description="Incremental +/− bars showing contributions by asset class; total bar in blue"
        >
          <WaterfallDemo />
        </Section>

        <Section
          title="2. Violin — Return Distributions"
          description="KDE curves mirrored around each strategy; white line = median"
        >
          <ViolinDemo />
        </Section>

        <Section
          title="3. Boxplot — Annual Returns"
          description="Q1/Q3 box, median line, 1.5×IQR whiskers, and outlier dots per year"
        >
          <BoxplotDemo />
        </Section>

        <Section
          title="4. Candlestick — AAPL Daily"
          description="Gradient OHLC candles with ticker badge, timeframe selector, and zoom/scroll"
        >
          <CandlestickDemo />
        </Section>

        <Section
          title="5. 3D Surface — Implied Volatility"
          description="SPX IV surface across strike × expiry — drag to rotate, scroll to zoom"
        >
          <Surface3DDemo />
        </Section>

        <Section
          title="6. Bubble — Risk vs Return"
          description="Scatter with variable bubble size (market cap weight) across mega-caps"
        >
          <BubbleDemo />
        </Section>
      </div>

      <div className="h-20" />
    </div>
  );
}
