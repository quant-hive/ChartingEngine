"use client";

import { applyTemplate, renderChart, FlashChart, PieChart, CandlestickChart, extractCandlestickData, extractPieSlices } from "@/lib/plot";
import type { PieSlice } from "@/lib/plot";

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

// ── 1. Revenue + Margin Dual-Axis ───────────────────────────────────────

function RevenueMarginDemo() {
  const spec = applyTemplate("revenue_margin", {
    quarters: ["Q1 FY23", "Q2 FY23", "Q3 FY23", "Q4 FY23", "Q1 FY24", "Q2 FY24", "Q3 FY24", "Q4 FY24"],
    revenue: [2450, 2680, 2890, 3120, 3350, 3580, 3780, 4020],
    margin: [18.2, 19.5, 20.1, 21.3, 20.8, 22.1, 21.5, 23.2],
    currency: "₹ Cr",
  });
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 2. Segment Revenue Stacked Bar ──────────────────────────────────────

function SegmentRevenueDemo() {
  const spec = applyTemplate("segment_revenue", {
    quarters: ["Q1 FY24", "Q2 FY24", "Q3 FY24", "Q4 FY24"],
    segments: [
      { name: "IT Services", data: [1850, 1920, 2010, 2150] },
      { name: "BPO", data: [680, 720, 750, 810] },
      { name: "Cloud & Infra", data: [420, 480, 520, 580] },
      { name: "Consulting", data: [280, 310, 340, 380] },
    ],
    currency: "₹ Cr",
  });
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 3. Peer Comparison Grouped Bar ──────────────────────────────────────

function PeerComparisonDemo() {
  const spec = applyTemplate("peer_comparison", {
    companies: ["TCS", "Infosys", "Wipro", "HCL Tech", "Tech M"],
    metrics: [
      { name: "PE", data: [28.5, 25.2, 20.1, 22.8, 18.5], unit: "x" },
      { name: "EV/EBITDA", data: [18.2, 16.8, 13.5, 15.2, 12.1], unit: "x" },
      { name: "ROE", data: [42.5, 28.3, 15.8, 22.1, 18.5], unit: "%" },
    ],
  });
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 4. Peer Valuation Scatter ───────────────────────────────────────────

function PeerValuationDemo() {
  const spec = applyTemplate("peer_valuation", {
    companies: [
      { name: "TCS", x: 12.5, y: 28.5, marketCap: 1350000 },
      { name: "Infosys", x: 14.2, y: 25.2, marketCap: 680000 },
      { name: "Wipro", x: 8.5, y: 20.1, marketCap: 250000 },
      { name: "HCL", x: 15.8, y: 22.8, marketCap: 380000 },
      { name: "Tech M", x: 10.2, y: 18.5, marketCap: 150000 },
      { name: "LTIMindtree", x: 18.5, y: 32.1, marketCap: 180000 },
    ],
    xLabel: "Revenue Growth (%)",
    yLabel: "PE (x)",
    sectorMedianX: 13.0,
    sectorMedianY: 24.0,
  });
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 5. DCF Sensitivity Heatmap ──────────────────────────────────────────

function DCFSensitivityDemo() {
  const spec = applyTemplate("dcf_sensitivity", {
    revenueGrowthRates: [8, 10, 12, 14, 16, 18, 20],
    waccRates: [9.0, 9.5, 10.0, 10.5, 11.0, 11.5],
    targetPrices: [
      [1850, 1920, 2010, 2120, 2250, 2400, 2580],
      [1720, 1790, 1870, 1970, 2090, 2230, 2390],
      [1610, 1670, 1750, 1840, 1950, 2080, 2220],
      [1510, 1570, 1640, 1720, 1820, 1940, 2070],
      [1420, 1480, 1540, 1620, 1710, 1820, 1940],
      [1340, 1390, 1460, 1530, 1610, 1710, 1820],
    ],
    currentPrice: 1750,
    currency: "₹",
  });
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 6. Candlestick + Technicals ─────────────────────────────────────────

function CandlestickTechnicalsDemo() {
  const spec = applyTemplate("candlestick_technicals", {
    ticker: "RELIANCE",
    open:  [2420,2435,2450,2440,2460,2475,2465,2480,2490,2485,2500,2510,2505,2520,2530,2525,2540,2550,2545,2560],
    high:  [2440,2455,2465,2470,2480,2485,2490,2500,2510,2508,2520,2525,2525,2540,2545,2548,2558,2565,2568,2580],
    low:   [2410,2425,2435,2430,2445,2458,2455,2470,2478,2475,2488,2495,2490,2508,2518,2515,2530,2538,2535,2550],
    close: [2435,2448,2442,2460,2472,2465,2480,2488,2485,2498,2508,2505,2518,2528,2525,2540,2548,2545,2558,2575],
    sma20: [2420,2425,2430,2435,2440,2445,2450,2455,2460,2465,2470,2475,2480,2485,2490,2495,2500,2505,2510,2515],
    sma50: [2380,2385,2390,2395,2400,2405,2410,2415,2420,2425,2430,2435,2440,2445,2450,2455,2460,2465,2470,2475],
    labels: ["D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","D14","D15","D16","D17","D18","D19","D20"],
  });

  const candleData = extractCandlestickData(spec);
  if (candleData) {
    return <CandlestickChart data={candleData} title={spec.title} subtitle={spec.subtitle} />;
  }
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 7. Waterfall — Revenue to Net Profit Bridge ─────────────────────────

function WaterfallBridgeDemo() {
  const spec = applyTemplate("waterfall_bridge", {
    items: [
      { label: "Revenue", value: 4020 },
      { label: "COGS", value: -2210 },
      { label: "Employee", value: -580 },
      { label: "SG&A", value: -320 },
      { label: "D&A", value: -180 },
      { label: "Other Inc", value: 85 },
      { label: "Interest", value: -120 },
      { label: "Tax", value: -175 },
    ],
    startLabel: "Revenue",
    endLabel: "Net Profit",
    currency: "₹ Cr",
  });
  return <FlashChart scene={renderChart(spec)} />;
}

// ── 8. Shareholding Donut ───────────────────────────────────────────────

function ShareholdingDemo() {
  const spec = applyTemplate("shareholding", {
    promoter: 50.3,
    fii: 22.8,
    dii: 14.5,
    public: 12.4,
    asOf: "Mar 2024",
  });

  const pieData = extractPieSlices(spec);
  const slices: PieSlice[] = pieData.slices.map(s => ({
    label: s.label,
    value: s.value,
    color: s.color,
  }));
  return <PieChart data={slices} donut donutRatio={pieData.donutRatio} />;
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  return (
    <div
      className="min-h-screen bg-[#121212] p-8"
      style={{ overflow: "auto", height: "100vh", position: "fixed", inset: 0 }}
    >
      <h1 className="text-white text-[28px] mb-1" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.3px" }}>
        Institutional Chart Templates
      </h1>
      <p className="text-[#555] text-[13px] mb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
        8 pre-configured templates · Professional palette · ₹ Cr / % / x formatting
      </p>

      <div className="max-w-[640px] flex flex-col gap-16">
        <Section
          title="1. Revenue + Margin"
          description="Bar (revenue ₹ Cr) with margin % overlay and avg margin reference line"
        >
          <RevenueMarginDemo />
        </Section>

        <Section
          title="2. Segment Revenue"
          description="Stacked bar showing quarterly revenue breakdown by business segment"
        >
          <SegmentRevenueDemo />
        </Section>

        <Section
          title="3. Peer Comparison"
          description="Grouped bars comparing PE, EV/EBITDA, and ROE across IT companies"
        >
          <PeerComparisonDemo />
        </Section>

        <Section
          title="4. Peer Valuation Scatter"
          description="PE vs Revenue Growth with sector median reference lines and bubble sizes"
        >
          <PeerValuationDemo />
        </Section>

        <Section
          title="5. DCF Sensitivity Heatmap"
          description="Target price grid across revenue growth (x-axis) × WACC (y-axis)"
        >
          <DCFSensitivityDemo />
        </Section>

        <Section
          title="6. Candlestick + Technicals"
          description="RELIANCE OHLC with SMA 20/50 overlays"
        >
          <CandlestickTechnicalsDemo />
        </Section>

        <Section
          title="7. Waterfall Bridge"
          description="Revenue → Net Profit showing each P&L deduction (₹ Cr)"
        >
          <WaterfallBridgeDemo />
        </Section>

        <Section
          title="8. Shareholding"
          description="Promoter / FII / DII / Public donut — Mar 2024 quarter"
        >
          <ShareholdingDemo />
        </Section>
      </div>

      <div className="h-20" />
    </div>
  );
}
