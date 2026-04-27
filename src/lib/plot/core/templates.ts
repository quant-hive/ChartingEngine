// ── Institutional Chart Templates ────────────────────────────────────────
// Pre-configured chart templates for financial analysis.
// The Reasoning Engine specifies template name + data; this module handles
// all styling, colors, axis formatting, and layout.
//
// Usage:
//   import { applyTemplate } from "@/lib/plot";
//   const spec = applyTemplate("revenue_margin", { quarters, revenue, margin });
//   renderChart(spec); // or pass to FlashChart

import type { ChartSpec } from "./renderChart";

// ── Professional color palette ──────────────────────────────────────────

const PALETTE = {
  primary:    "#4ECDC4",
  secondary:  "#8CA5FF",
  tertiary:   "#C084FC",
  accent:     "#FFD93D",
  negative:   "#FF6B6B",
  positive:   "#4ECDC4",
  neutral:    "#707070",
  muted:      "#494949",
  surface:    "#1a1a2a",
  text:       "#d4d4d4",
  // Segment colors (ordered for stacked charts)
  segments: ["#4ECDC4", "#8CA5FF", "#C084FC", "#FFD93D", "#FF6B6B", "#67E8F9", "#EF8CFF", "#FCA5A5"],
  // Peer comparison
  peers: ["#4ECDC4", "#8CA5FF", "#C084FC", "#FFD93D", "#FF6B6B", "#67E8F9"],
  // Shareholding
  shareholding: ["#4ECDC4", "#8CA5FF", "#FFD93D", "#707070"],
};

// ── Template data interfaces ────────────────────────────────────────────

export interface RevenueMarginData {
  quarters: string[];
  revenue: number[];
  margin: number[];
  revenueLabel?: string;
  marginLabel?: string;
  currency?: string;
}

export interface SegmentRevenueData {
  quarters: string[];
  segments: { name: string; data: number[] }[];
  currency?: string;
}

export interface PeerComparisonData {
  companies: string[];
  metrics: { name: string; data: number[]; unit?: string }[];
}

export interface PeerValuationData {
  companies: { name: string; x: number; y: number; marketCap?: number }[];
  xLabel: string;
  yLabel: string;
  sectorMedianX?: number;
  sectorMedianY?: number;
}

export interface DCFSensitivityData {
  revenueGrowthRates: number[];
  waccRates: number[];
  targetPrices: number[][];
  currentPrice?: number;
  currency?: string;
}

export interface CandlestickTechnicalsData {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume?: number[];
  sma20?: number[];
  sma50?: number[];
  labels?: string[];
  ticker?: string;
}

export interface WaterfallBridgeData {
  items: { label: string; value: number }[];
  startLabel?: string;
  endLabel?: string;
  currency?: string;
}

export interface ShareholdingData {
  promoter: number;
  fii: number;
  dii: number;
  public: number;
  others?: number;
  asOf?: string;
}

// ── Template registry ───────────────────────────────────────────────────

export type TemplateName =
  | "revenue_margin"
  | "segment_revenue"
  | "peer_comparison"
  | "peer_valuation"
  | "dcf_sensitivity"
  | "candlestick_technicals"
  | "waterfall_bridge"
  | "shareholding";

export type TemplateData =
  | { template: "revenue_margin"; data: RevenueMarginData }
  | { template: "segment_revenue"; data: SegmentRevenueData }
  | { template: "peer_comparison"; data: PeerComparisonData }
  | { template: "peer_valuation"; data: PeerValuationData }
  | { template: "dcf_sensitivity"; data: DCFSensitivityData }
  | { template: "candlestick_technicals"; data: CandlestickTechnicalsData }
  | { template: "waterfall_bridge"; data: WaterfallBridgeData }
  | { template: "shareholding"; data: ShareholdingData };

// ── Template implementations ────────────────────────────────────────────

function buildRevenueMargin(d: RevenueMarginData): ChartSpec {
  const curr = d.currency ?? "₹ Cr";
  return {
    type: "bar",
    title: "Revenue & Margin",
    subtitle: `${curr} · Quarterly`,
    series: [
      {
        data: d.revenue,
        label: d.revenueLabel ?? `Revenue (${curr})`,
        color: PALETTE.primary,
      },
      {
        data: d.margin,
        label: d.marginLabel ?? "OPM (%)",
        color: PALETTE.accent,
        lineWidth: 2,
      },
    ],
    xLabels: d.quarters,
    yAxis: { label: curr },
    grid: true,
    hlines: d.margin.length > 0 ? [{
      y: d.margin.reduce((a, b) => a + b, 0) / d.margin.length,
      color: PALETTE.muted,
      lineStyle: "dashed",
      label: "Avg Margin",
    }] : undefined,
  };
}

function buildSegmentRevenue(d: SegmentRevenueData): ChartSpec {
  const curr = d.currency ?? "₹ Cr";
  return {
    type: "stacked_bar",
    title: "Segment Revenue",
    subtitle: `${curr} · Quarterly breakdown`,
    series: d.segments.map((seg, i) => ({
      data: seg.data,
      label: seg.name,
      color: PALETTE.segments[i % PALETTE.segments.length],
    })),
    xLabels: d.quarters,
    yAxis: { label: curr },
    grid: true,
  };
}

function buildPeerComparison(d: PeerComparisonData): ChartSpec {
  return {
    type: "bar",
    title: "Peer Comparison",
    subtitle: d.metrics.map(m => m.name).join(" · "),
    series: d.metrics.map((m, i) => ({
      data: m.data,
      label: m.unit ? `${m.name} (${m.unit})` : m.name,
      color: PALETTE.peers[i % PALETTE.peers.length],
    })),
    xLabels: d.companies,
    grid: true,
  };
}

function buildPeerValuation(d: PeerValuationData): ChartSpec {
  const sizes = d.companies.map(c => c.marketCap ? Math.sqrt(c.marketCap) / 5 : 6);
  const hasSizes = d.companies.some(c => c.marketCap != null);

  return {
    type: hasSizes ? "bubble" : "scatter",
    title: "Peer Valuation",
    subtitle: `${d.xLabel} vs ${d.yLabel}`,
    series: [{
      data: d.companies.map(c => c.y),
      x: d.companies.map(c => c.x),
      sizes: hasSizes ? sizes : undefined,
      label: "Companies",
      color: PALETTE.primary,
      markerSize: 6,
    }],
    xAxis: { label: d.xLabel },
    yAxis: { label: d.yLabel },
    hlines: d.sectorMedianY != null ? [{
      y: d.sectorMedianY,
      color: PALETTE.muted,
      lineStyle: "dashed",
      label: "Sector Median",
    }] : undefined,
    vlines: d.sectorMedianX != null ? [{
      x: d.sectorMedianX,
      color: PALETTE.muted,
      lineStyle: "dashed",
    }] : undefined,
    annotations: d.companies.map((c, i) => ({
      text: c.name,
      x: c.x,
      y: c.y,
      color: PALETTE.text,
    })),
    grid: true,
  };
}

function buildDCFSensitivity(d: DCFSensitivityData): ChartSpec {
  const curr = d.currency ?? "₹";
  return {
    type: "heatmap",
    title: "DCF Sensitivity",
    subtitle: `Target price (${curr}) · Revenue Growth × WACC`,
    heatmap: {
      data: d.targetPrices,
      rowLabels: d.waccRates.map(r => `${r.toFixed(1)}%`),
      colLabels: d.revenueGrowthRates.map(r => `${r.toFixed(0)}%`),
      colorRange: ["#1565c0", "#ffffff", "#c62828"],
    },
    grid: false,
  };
}

function buildCandlestickTechnicals(d: CandlestickTechnicalsData): ChartSpec {
  const spec: ChartSpec = {
    type: "candlestick",
    title: d.ticker ?? "OHLC",
    subtitle: d.labels ? `${d.labels[0]} – ${d.labels[d.labels.length - 1]}` : undefined,
    series: [{
      data: d.close,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      label: d.ticker,
    }],
    xLabels: d.labels,
    grid: true,
  };

  // Overlay SMAs as additional line series rendered via annotations
  // Since candlestick uses the series[0] for OHLC, we add SMA data as hlines approximation
  // A better approach: render as separate line overlay in the figure API
  if (d.sma20 || d.sma50) {
    const hlines: ChartSpec["hlines"] = [];
    if (d.sma20 && d.sma20.length > 0) {
      const last20 = d.sma20[d.sma20.length - 1];
      hlines.push({ y: last20, color: "#FFD93D", lineStyle: "solid", label: "SMA 20" });
    }
    if (d.sma50 && d.sma50.length > 0) {
      const last50 = d.sma50[d.sma50.length - 1];
      hlines.push({ y: last50, color: "#C084FC", lineStyle: "dashed", label: "SMA 50" });
    }
    spec.hlines = hlines;
  }

  return spec;
}

function buildWaterfallBridge(d: WaterfallBridgeData): ChartSpec {
  const curr = d.currency ?? "₹ Cr";
  const labels = d.items.map(i => i.label);
  const values = d.items.map(i => i.value);

  // Add total bar at the end
  const total = values.reduce((a, b) => a + b, 0);
  labels.push(d.endLabel ?? "Net Profit");
  values.push(total);

  return {
    type: "waterfall",
    title: "Revenue to Profit Bridge",
    subtitle: curr,
    series: [{ data: values, label: "P&L Bridge" }],
    xLabels: labels,
    grid: true,
    yAxis: { label: curr },
  };
}

function buildShareholding(d: ShareholdingData): ChartSpec {
  const slices = [
    { label: "Promoter", value: d.promoter, color: PALETTE.shareholding[0] },
    { label: "FII", value: d.fii, color: PALETTE.shareholding[1] },
    { label: "DII", value: d.dii, color: PALETTE.shareholding[2] },
    { label: "Public", value: d.public, color: PALETTE.shareholding[3] },
  ];
  if (d.others && d.others > 0) {
    slices.push({ label: "Others", value: d.others, color: "#555555" });
  }

  return {
    type: "donut",
    title: "Shareholding Pattern",
    subtitle: d.asOf ? `As of ${d.asOf}` : "Latest quarter",
    slices,
    donutRatio: 0.55,
  };
}

// ── Public API ──────────────────────────────────────────────────────────

const TEMPLATE_BUILDERS: Record<TemplateName, (data: any) => ChartSpec> = {
  revenue_margin: buildRevenueMargin,
  segment_revenue: buildSegmentRevenue,
  peer_comparison: buildPeerComparison,
  peer_valuation: buildPeerValuation,
  dcf_sensitivity: buildDCFSensitivity,
  candlestick_technicals: buildCandlestickTechnicals,
  waterfall_bridge: buildWaterfallBridge,
  shareholding: buildShareholding,
};

export function applyTemplate(template: TemplateName, data: unknown): ChartSpec {
  const builder = TEMPLATE_BUILDERS[template];
  if (!builder) {
    throw new Error(`Unknown template: "${template}". Available: ${Object.keys(TEMPLATE_BUILDERS).join(", ")}`);
  }
  return builder(data);
}

export function listTemplates(): TemplateName[] {
  return Object.keys(TEMPLATE_BUILDERS) as TemplateName[];
}
