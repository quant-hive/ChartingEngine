"use client";

/**
 * FlashChart — React renderer for Flash Plot scenes.
 * Faithful port of flash-plot _render.py.
 * Uses CSS classes for hover interactions (no React state for hover).
 */

import React, { useCallback, useEffect, useRef, useState, memo } from "react";
import type {
  Scene, SubplotScene,
  LinePlotElement, AreaPlotElement, BarPlotElement, BarRect, ScatterPlotElement,
  HLinePlotElement, VLinePlotElement, TextPlotElement, AnnotationPlotElement,
  Theme, BarThemeStyle,
} from "../core/types";
import { getTheme } from "../core/theme";
import { dashArray } from "../core/paths";

// ── Sparkle dot positions (from Figma) ──────────────────────────────────

const SPARKLE_DOTS = [
  { cx: 0.75, cy: 0.761, r: 1 },
  { cx: 0.315, cy: 0.843, r: 1 },
  { cx: 0.675, cy: 0.780, r: 0.5 },
  { cx: 0.459, cy: 0.846, r: 0.5 },
  { cx: 0.238, cy: 0.685, r: 0.75 },
  { cx: 0.45, cy: 0.649, r: 1 },
  { cx: 0.509, cy: 0.870, r: 1 },
  { cx: 0.558, cy: 0.106, r: 1 },
  { cx: 0.225, cy: 0.623, r: 0.5 },
  { cx: 0.331, cy: 0.132, r: 0.5 },
  { cx: 0.475, cy: 0.668, r: 0.5 },
  { cx: 0.626, cy: 0.862, r: 0.5 },
  { cx: 0.685, cy: 0.107, r: 0.5 },
  { cx: 0.138, cy: 0.632, r: 0.75 },
  { cx: 0.368, cy: 0.147, r: 0.75 },
];

// ── CSS Animations (matching flash-plot _render.py _CSS_ANIMATIONS) ─────

const FP_CSS = `
/* Phase 1: Grid draw-in */
@keyframes fp-gridDraw { from { stroke-dashoffset: var(--fp-len); } to { stroke-dashoffset: 0; } }

/* Phase 2: Label appear */
@keyframes fp-labelFadeY { from { opacity: 0; transform: translate(8px, 0); } to { opacity: 1; transform: translate(0, 0); } }
@keyframes fp-labelFadeX { from { opacity: 0; transform: translate(0, -6px); } to { opacity: 1; transform: translate(0, 0); } }

/* Phase 3: Data elements */
@keyframes fp-lineDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes fp-areaFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fp-barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes fp-scatterPop { from { opacity: 0; r: 0; } to { opacity: 1; } }
@keyframes fp-refFade { from { opacity: 0; } to { opacity: 1; } }

/* Shimmer: brightness wave across labels */
@keyframes fp-shimmer {
  0%, 100% { fill: var(--fp-base); }
  30% { fill: #787878; }
  50% { fill: #c4c4c4; }
  70% { fill: #787878; }
}

/* Bar sweep: sequential highlight pulse */
@keyframes fp-barSweep {
  0% { opacity: 0; }
  30% { opacity: 1; }
  100% { opacity: 0; }
}

/* Glow drift animations for bar layers */
@keyframes fp-glowDrift1 {
  0%, 100% { transform: translate(0, 0); }
  30% { transform: translate(0.5px, -0.4px); }
  60% { transform: translate(-0.4px, 0.5px); }
  80% { transform: translate(0.3px, 0.2px); }
}
@keyframes fp-glowDrift2 {
  0%, 100% { transform: translate(0, 0); }
  35% { transform: translate(-0.4px, 0.4px); }
  65% { transform: translate(0.5px, -0.3px); }
  85% { transform: translate(-0.2px, -0.4px); }
}
@keyframes fp-glowDrift3 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(0.2px, 0.5px); }
  55% { transform: translate(-0.5px, -0.2px); }
  80% { transform: translate(0.4px, -0.4px); }
}

/* Sparkle float animations for bar dots */
@keyframes fp-sparkleFloat1 {
  0%, 100% { transform: translate(0, 0); opacity: 0.85; }
  35% { transform: translate(0.5px, -0.8px); opacity: 1; }
  65% { transform: translate(-0.3px, -1.2px); opacity: 0.7; }
  85% { transform: translate(0.4px, -0.4px); opacity: 0.95; }
}
@keyframes fp-sparkleFloat2 {
  0%, 100% { transform: translate(0, 0); opacity: 0.8; }
  30% { transform: translate(-0.6px, -1px); opacity: 1; }
  60% { transform: translate(0.4px, -1.5px); opacity: 0.65; }
  80% { transform: translate(-0.2px, -0.5px); opacity: 0.9; }
}
@keyframes fp-sparkleFloat3 {
  0%, 100% { transform: translate(0, 0); opacity: 0.9; }
  25% { transform: translate(0.3px, -1.2px); opacity: 0.7; }
  50% { transform: translate(-0.5px, -0.6px); opacity: 1; }
  75% { transform: translate(0.4px, -1px); opacity: 0.75; }
}

/* Glow reveal: grow upward from base with fade-in */
@keyframes fp-glowReveal { from { opacity: 0; transform: scaleY(0); } to { opacity: 1; transform: scaleY(1); } }
@keyframes fp-glowFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ── Bar interactions ──────────────────────────────────────────────── */
.fp-bar { cursor: pointer; }

/* Always-on glow (primary series): drift + sparkle always play */
.fp-glow-on .fp-drift1 { animation: fp-glowDrift1 4s ease-in-out infinite; }
.fp-glow-on .fp-drift2 { animation: fp-glowDrift2 3.5s ease-in-out 0.3s infinite; }
.fp-glow-on .fp-drift3 { animation: fp-glowDrift3 3.8s ease-in-out 0.2s infinite; }
.fp-glow-on .fp-drift1b { animation: fp-glowDrift1 4.2s ease-in-out 0.5s infinite; }
.fp-glow-on .fp-sparkle { animation: var(--fp-sparkle-anim); }

/* Hover-only glow (secondary series): hidden by default, shown on hover */
.fp-glow-hover { opacity: 0; transition: opacity 0.35s ease-out; }
.fp-bar:hover .fp-glow-hover { opacity: 1; transition: opacity 0.15s ease-in; }
.fp-glow-hover .fp-drift { animation: none !important; }
.fp-bar:hover .fp-glow-hover .fp-drift1 { animation: fp-glowDrift1 4s ease-in-out infinite !important; }
.fp-bar:hover .fp-glow-hover .fp-drift2 { animation: fp-glowDrift2 3.5s ease-in-out 0.3s infinite !important; }
.fp-bar:hover .fp-glow-hover .fp-drift3 { animation: fp-glowDrift3 3.8s ease-in-out 0.2s infinite !important; }
.fp-bar:hover .fp-glow-hover .fp-drift1b { animation: fp-glowDrift1 4.2s ease-in-out 0.5s infinite !important; }
.fp-glow-hover .fp-sparkle { animation: none !important; }
.fp-bar:hover .fp-glow-hover .fp-sparkle { animation: var(--fp-sparkle-anim) !important; }

/* ── Hover tooltips ─────────────────────────────────────────────────── */
.fp-tip { pointer-events: all; }
.fp-tip-content { opacity: 0; pointer-events: none; transition: opacity 0.12s ease; }
.fp-tip:hover .fp-tip-content { opacity: 1; }
.fp-bar:hover .fp-tip-content { opacity: 1; }

/* ── Hide axis labels toggle ───────────────────────────────────────── */
.fp-hide-axis-labels .fp-tick-label { opacity: 0 !important; animation: none !important; }

/* ── Light theme override ──────────────────────────────────────────── */
.fp-light svg { background: transparent; }
.fp-light .fp-tick-label { fill: #555 !important; }
.fp-light line[stroke="#2a2a2a"], .fp-light line[stroke="rgba(255,255,255,0.06)"] { stroke: #ddd !important; }
/* Title & subtitle */
.fp-light h3 { color: #222 !important; }
.fp-light p { color: #888 !important; }
/* SVG white/light strokes & fills → dark for readability */
.fp-light svg .fp-line-path[stroke="#d4d4d4"] { stroke: #444 !important; }
.fp-light svg .fp-line-path[stroke="#707070"] { stroke: #888 !important; }
.fp-light svg .fp-line-path[stroke="#ffffff"] { stroke: #333 !important; }
.fp-light svg text[fill="#ffffff"], .fp-light svg text[fill="white"] { fill: #222 !important; }
.fp-light svg text[fill="#8f8f8f"] { fill: #666 !important; }
.fp-light svg text[fill="#494949"] { fill: #888 !important; }
/* Legend text */
.fp-light .fp-legend-label { fill: #555 !important; }
/* Dots */
.fp-light svg circle[fill="#121212"] { fill: #fafafa !important; }

/* ── Scroll container ─────────────────────────────────────────────── */
.fp-scroll-hide::-webkit-scrollbar { display: none; }
.fp-scroll-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtVal(v: number): string {
  if (Math.abs(v) >= 1e6) return v.toExponential(2);
  if (Math.abs(v) >= 100) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 1) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v === 0) return "0";
  return v.toPrecision(4);
}

// ── Tooltip Box ─────────────────────────────────────────────────────────

function TooltipBox({
  header,
  entries,
  tx: rawTx,
  ty: rawTy,
  w: tooltipW,
  boundsW,
  paY,
}: {
  header: string;
  entries: { color: string; label: string; valueStr: string }[];
  tx: number;
  ty: number;
  w: number;
  boundsW: number;
  paY: number;
}) {
  const rowH = 18;
  const headerH = 22;
  const pad = 8;
  const totalH = pad + headerH + entries.length * rowH + pad;

  let tx = rawTx + tooltipW + 12 > boundsW ? rawTx - tooltipW - 10 : rawTx + 10;
  let ty = rawTy;
  if (ty + totalH > paY + 200) ty = Math.max(paY, ty - totalH - 10);

  return (
    <g transform={`translate(${tx.toFixed(1)},${ty.toFixed(1)})`}>
      <rect width={tooltipW} height={totalH} rx={5} fill="#1a1a1a" stroke="#2a2a2a" strokeWidth={0.5} />
      <text x={8} y={pad + 11} fill="#808080" fontSize={9} fontWeight={500} fontFamily="'Inter',sans-serif">
        {header}
      </text>
      <line x1={8} y1={pad + headerH - 4} x2={tooltipW - 8} y2={pad + headerH - 4} stroke="#2a2a2a" strokeWidth={0.5} />
      {entries.map((entry, idx) => {
        const ry = pad + headerH + idx * rowH + 12;
        return (
          <g key={idx}>
            <circle cx={14} cy={ry - 3} r={3} fill={entry.color} />
            <text x={22} y={ry} fill="#a0a0a0" fontSize={9} fontFamily="'Inter',sans-serif">
              {entry.label}
            </text>
            <text x={tooltipW - 8} y={ry} textAnchor="end" fill="#e0e0e0" fontSize={9} fontWeight={600} fontFamily="'Inter',sans-serif">
              {entry.valueStr}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Line Hover Overlay ──────────────────────────────────────────────────

function LineHoverOverlay({ subplot, uid }: { subplot: SubplotScene; uid: string }) {
  const pa = subplot.plotArea;
  const w = subplot.bounds.w;
  const lineEls = subplot.elements.filter(e => e.type === "line") as LinePlotElement[];
  if (lineEls.length === 0 || lineEls[0].points.length === 0) return null;

  const nPoints = lineEls[0].points.length;
  const tickLabels = new Map(subplot.xAxis.ticks.map(t => [Math.round(t.position * 10) / 10, t.label]));

  return (
    <>
      {Array.from({ length: nPoints }, (_, i) => {
        const px = lineEls[0].points[i].x;

        // Strip boundaries
        let stripL: number, stripR: number;
        if (nPoints === 1) {
          stripL = pa.x;
          stripR = pa.x + pa.w;
        } else {
          stripL = i > 0 ? px - (px - lineEls[0].points[i - 1].x) / 2 : pa.x;
          stripR = i < nPoints - 1 ? px + (lineEls[0].points[i + 1].x - px) / 2 : pa.x + pa.w;
        }

        // Find closest tick label
        let xLabel = String(i);
        let bestDist = Infinity;
        for (const [tp, tl] of tickLabels) {
          const d = Math.abs(tp - px);
          if (d < bestDist) { bestDist = d; xLabel = tl; }
        }

        // Build entries for all series at this index
        const entries: { color: string; label: string; valueStr: string }[] = [];
        for (const el of lineEls) {
          if (el.dataValues && i < el.dataValues.length) {
            entries.push({ color: el.color, label: el.label ?? el.color, valueStr: fmtVal(el.dataValues[i]) });
          }
        }

        return (
          <g key={`tip-${i}`} className="fp-tip">
            {/* Hit area strip */}
            <rect x={stripL} y={pa.y} width={stripR - stripL} height={pa.h} fill="transparent" />
            <g className="fp-tip-content">
              {/* Crosshair */}
              <line x1={px} y1={pa.y} x2={px} y2={pa.y + pa.h} stroke="#3a3a3a" strokeWidth={0.5} strokeDasharray="3 2" />
              {/* Dots on each line */}
              {lineEls.map((el, elIdx) => {
                if (i >= el.points.length) return null;
                const py = el.points[i].y;
                return (
                  <g key={`dot-${elIdx}`}>
                    <circle cx={px} cy={py} r={3.5} fill="#121212" stroke={el.color} strokeWidth={1.2} />
                    <circle cx={px} cy={py} r={1.5} fill={el.color} />
                  </g>
                );
              })}
              {/* Tooltip */}
              <TooltipBox header={xLabel} entries={entries} tx={px} ty={pa.y + 4} w={120} boundsW={w} paY={pa.y} />
            </g>
          </g>
        );
      })}
    </>
  );
}

// ── Scatter Hover Overlay ───────────────────────────────────────────────

function ScatterHoverOverlay({ subplot, uid }: { subplot: SubplotScene; uid: string }) {
  const pa = subplot.plotArea;
  const w = subplot.bounds.w;
  const scatterEls = subplot.elements.filter(e => e.type === "scatter") as ScatterPlotElement[];
  if (scatterEls.length === 0) return null;

  return (
    <>
      {scatterEls.map((el, elIdx) =>
        el.points.map((pt, i) => {
          const r = Math.max(Math.sqrt(pt.size), 4);
          const entries = [
            { color: el.color, label: "x", valueStr: fmtVal(pt.x) },
            { color: el.color, label: "y", valueStr: fmtVal(pt.y) },
          ];
          return (
            <g key={`sct-${elIdx}-${i}`} className="fp-tip">
              <circle cx={pt.x} cy={pt.y} r={r + 3} fill="transparent" />
              <g className="fp-tip-content">
                <circle cx={pt.x} cy={pt.y} r={r + 1} fill="none" stroke={el.color} strokeWidth={1.5} strokeOpacity={0.6} />
                <TooltipBox header={el.label ?? "Point"} entries={entries} tx={pt.x} ty={pt.y - 8} w={100} boundsW={w} paY={pa.y} />
              </g>
            </g>
          );
        })
      )}
    </>
  );
}

// ── Subplot Renderer ────────────────────────────────────────────────────

function SubplotRenderer({ subplot, theme, sceneWidth, animate = true }: { subplot: SubplotScene; theme: Theme; sceneWidth?: number; animate?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(!animate);
  const [hoveredSeg, setHoveredSeg] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // Collect non-stacked bar tooltip data for top-layer rendering
  type BarTipInfo = { key: string; id: string; bx: number; bw: number; ay: number; color: string; label: string; value: number; xLabel: string };
  const barTipData: BarTipInfo[] = [];

  useEffect(() => {
    if (!animate) return;
    requestAnimationFrame(() => setVisible(true));
  }, [animate]);

  const pa = subplot.plotArea;
  const w = subplot.bounds.w;
  const h = subplot.bounds.h;

  // Timing constants (matching Python _render.py)
  const T_LABELS = 0.675;
  const T_DATA = 1.28;
  const T_SHIMMER = 2.5;
  const SHIMMER_STEP = 0.08;
  const SHIMMER_DUR = 0.24;

  // Bar timing
  let barCount = 0;
  for (const el of subplot.elements) {
    if (el.type === "bar") barCount = Math.max(barCount, (el as BarPlotElement).bars.length);
  }
  const barSweepStart = T_DATA + 0.81 + barCount * 0.054;
  const barSweepStep = 0.12;
  // Glow reveal: fade in after shimmer completes on last bar
  const glowRevealDelay = T_SHIMMER + (barCount > 0 ? (barCount - 1) * SHIMMER_STEP : 0) + SHIMMER_DUR + 0.1;

  const uid = `sp${subplot.row}${subplot.col}`;

  // Collect bar series indices for filter defs
  const barSeriesIndices = [...new Set(
    subplot.elements.filter(e => e.type === "bar").map(e => (e as BarPlotElement).seriesIndex)
  )];

  // Track area indices
  let areaIdx = 0;
  let lineIdx = 0;

  const hasLineEls = subplot.elements.some(e => e.type === "line");
  const hasScatterEls = subplot.elements.some(e => e.type === "scatter");
  // Detect stacked bars: multiple bar series sharing the same x positions
  const barElements = subplot.elements.filter(e => e.type === "bar") as BarPlotElement[];
  const isStackedBars = barElements.length > 1 && barElements.every(
    (el) => el.bars.length > 0 && Math.abs(el.bars[0].x - barElements[0].bars[0].x) < 1
  );

  // Force uniform bar widths across all grouped (non-stacked) series
  if (barElements.length > 1 && !isStackedBars) {
    const allW = barElements.flatMap(el => el.bars.map(b => b.width));
    const minW = Math.min(...allW);
    const maxW = Math.max(...allW);
    if (maxW - minW > 0.5) {
      for (const el of barElements) {
        for (const bar of el.bars) {
          if (bar.width !== minW) {
            const diff = bar.width - minW;
            bar.x += diff / 2;
            bar.width = minW;
          }
        }
      }
    }
  }

  // Calculate extra height for legend
  const hasLegend = !!(subplot.legend && subplot.legend.entries.length > 0);
  const legendFontSize = Math.round(theme.legend.fontSize * (w / 595));
  const legendExtraH = hasLegend ? legendFontSize + 72 : 0;
  const totalH = h + legendExtraH;

  const vbWidth = sceneWidth ?? w;
  const aspectPct = (totalH / vbWidth) * 100;

  // ── Scrollable bar detection ──────────────────────────────────────
  const MAX_VISIBLE_BARS = 12;
  const needsScroll = barCount > MAX_VISIBLE_BARS;
  const scrollRatio = needsScroll ? barCount / MAX_VISIBLE_BARS : 1;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scrollX, setScrollX] = useState(0); // SVG coordinate units

  // Max scroll in SVG units: the extra width that extends beyond the visible plot area
  const maxScrollSvg = needsScroll ? pa.w * (scrollRatio - 1) : 0;

  // Map bar X coordinate and width for scrollable charts
  const mapBarX = (x: number) => needsScroll ? pa.x + (x - pa.x) * scrollRatio - scrollX : x;
  const mapBarW = (bw: number) => needsScroll ? bw * scrollRatio : bw;

  // Arrow scroll step
  const scrollStep = useCallback((dir: 1 | -1) => {
    const step = pa.w * 0.6;
    setScrollX(prev => Math.max(0, Math.min(maxScrollSvg, prev + dir * step)));
  }, [maxScrollSvg, pa.w]);

  const showLeftArrow = needsScroll && scrollX > 2;
  const showRightArrow = needsScroll && scrollX < maxScrollSvg - 2;

  // ── Y-axis zoom for bar charts ───────────────────────────────────
  const [yZoom, setYZoom] = useState(1);
  const hasBars = barElements.length > 0 && !isStackedBars;

  // Collect all bar values to determine the original data range
  const allBarValues = hasBars
    ? barElements.flatMap(el => el.bars.map(b => b.value)).filter(v => v > 0)
    : [];
  const origYMax = allBarValues.length > 0 ? Math.max(...allBarValues) : 0;

  // Zoomed Y-axis max: shrinks as zoom increases, showing lower values in detail
  const zoomedYMax = origYMax > 0 ? origYMax / yZoom : 0;
  const canZoomY = hasBars && origYMax > 0;
  const baseline = pa.y + pa.h;

  // Map a bar value → pixel y and height under current zoom
  const mapBarY = useCallback((value: number) => {
    if (!canZoomY || zoomedYMax <= 0) return { y: 0, h: 0 };
    const ratio = Math.min(value / zoomedYMax, 1);
    const barH = Math.max(ratio > 0 ? 3 : 0, ratio * pa.h);
    return { y: baseline - barH, h: barH };
  }, [canZoomY, zoomedYMax, pa.h, baseline]);

  // Generate Y-axis ticks for the zoomed range
  const zoomedYTicks = (() => {
    if (!canZoomY || yZoom <= 1) return null;
    const nTicks = 5;
    const step = zoomedYMax / (nTicks - 1);
    return Array.from({ length: nTicks }, (_, i) => {
      const val = Math.round(i * step);
      const pos = baseline - (val / zoomedYMax) * pa.h;
      return { value: val, label: String(val), position: pos };
    });
  })();

  // Zoomed Y grid lines
  const zoomedYGridLines = (() => {
    if (!zoomedYTicks) return null;
    return zoomedYTicks.map(t => ({
      x1: pa.x, y1: t.position, x2: pa.x + pa.w, y2: t.position,
    }));
  })();

  const svgElement = (
    <svg
      ref={ref}
      viewBox={`0 0 ${(sceneWidth ?? w).toFixed(1)} ${totalH.toFixed(1)}`}
      className="block"
      style={{ fontFamily: "'Inter', sans-serif", position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <style>{FP_CSS}</style>

      <defs>
        {/* Per-area gradients using each area's own color */}
        {subplot.elements.filter(e => e.type === "area").map((el, i) => {
          const area = el as AreaPlotElement;
          return (
            <linearGradient key={`ag-${i}`} id={`areaGrad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={area.color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={area.color} stopOpacity={0.05} />
            </linearGradient>
          );
        })}

        {/* Scroll clip: clips bar content to plot area width, full height */}
        {needsScroll && (
          <clipPath id={`barScrollClip-${uid}`}>
            <rect x={pa.x} y={0} width={pa.w} height={totalH} />
          </clipPath>
        )}

        {/* Bar clip: clips bars to plot area (used when zoomed or scrolling) */}
        {(needsScroll || canZoomY) && (
          <clipPath id={`barClip-${uid}`}>
            <rect x={needsScroll ? pa.x : 0} y={pa.y} width={needsScroll ? pa.w : w} height={pa.h} />
          </clipPath>
        )}

        {/* Bar filters (matching Python: same sigma values) */}
        {barSeriesIndices.map(si => {
          const filters: [string, number][] = [
            ["SideGlow", 5], ["TopHL", 4], ["BotGlow", 5],
            ["LeftEdge", 5], ["BotWhite", 2.25], ["TopWhite", 2.25],
          ];
          return (
            <React.Fragment key={`bf-${si}`}>
              {filters.map(([name, sigma]) => (
                <filter key={name} id={`bar${name}-${uid}-${si}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation={sigma} />
                </filter>
              ))}
            </React.Fragment>
          );
        })}

      </defs>

      {/* ── Title & Subtitle (editable) ────────────────────────────── */}
      {subplot.titleStyle && subplot.title && (() => {
        const ts = subplot.titleStyle;
        const titleY = 0;
        const titleH = ts.fontSize + 8;
        return (
          <foreignObject x={pa.x} y={titleY} width={pa.w} height={titleH}
            style={visible ? { animation: "fp-refFade 0.6s ease 0s both" } : { opacity: 0 }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{
                fontSize: ts.fontSize,
                fontWeight: ts.fontWeight,
                fontFamily: ts.fontFamily,
                letterSpacing: ts.letterSpacing,
                color: ts.color,
                outline: "none",
                cursor: "text",
                lineHeight: 1,
                whiteSpace: "nowrap",
                background: "transparent",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
            >
              {subplot.title}
            </div>
          </foreignObject>
        );
      })()}
      {subplot.subtitleStyle && subplot.subtitle && (() => {
        const ss = subplot.subtitleStyle;
        const subY = (subplot.titleStyle ? subplot.titleStyle.fontSize + 8 : 0);
        const subH = ss.fontSize + 8;
        return (
          <foreignObject x={pa.x} y={subY} width={pa.w} height={subH}
            style={visible ? { animation: "fp-refFade 0.6s ease 0.1s both" } : { opacity: 0 }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              style={{
                fontSize: ss.fontSize,
                fontWeight: ss.fontWeight,
                fontFamily: ss.fontFamily,
                letterSpacing: ss.letterSpacing,
                color: ss.color,
                outline: "none",
                cursor: "text",
                lineHeight: 1,
                whiteSpace: "nowrap",
                background: "transparent",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
            >
              {subplot.subtitle}
            </div>
          </foreignObject>
        );
      })()}

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {subplot.grid.visible && (() => {
        if (zoomedYGridLines) {
          const xGridLines = subplot.grid.lines.filter(gl => Math.abs(gl.x1 - gl.x2) < 0.5);
          const allLines = [
            ...xGridLines.map((gl, i) => ({ ...gl, key: `gx-${i}` })),
            ...zoomedYGridLines.map((gl, i) => ({
              x1: gl.x1, y1: gl.y1, x2: gl.x2, y2: gl.y1,
              color: "#2a2a2a", width: 0.3, key: `gy-${i}`,
            })),
          ];
          return allLines.map((gl) => {
            const len = Math.sqrt((gl.x2 - gl.x1) ** 2 + ((gl as { y2: number }).y2 - gl.y1) ** 2);
            return (
              <line key={gl.key}
                x1={gl.x1.toFixed(1)} y1={gl.y1.toFixed(1)} x2={gl.x2.toFixed(1)} y2={(gl as { y2: number }).y2.toFixed(1)}
                stroke={gl.color} strokeWidth={gl.width}
                style={{ transition: "y1 0.25s ease, y2 0.25s ease", opacity: visible ? 1 : 0 }}
              />
            );
          });
        }
        return subplot.grid.lines.map((gl, i) => {
          const len = Math.sqrt((gl.x2 - gl.x1) ** 2 + (gl.y2 - gl.y1) ** 2);
          return (
            <line key={`g-${i}`}
              x1={gl.x1.toFixed(1)} y1={gl.y1.toFixed(1)} x2={gl.x2.toFixed(1)} y2={gl.y2.toFixed(1)}
              stroke={gl.color} strokeWidth={gl.width}
              style={visible ? {
                "--fp-len": len, strokeDasharray: len,
                animation: `fp-gridDraw 0.675s cubic-bezier(0.22,1,0.36,1) ${(i * 0.08).toFixed(2)}s both`,
              } as React.CSSProperties : { opacity: 0 }}
            />
          );
        });
      })()}

      {/* ── Y Axis Labels (with shimmer) ─────────────────────────────── */}
      {(zoomedYTicks ?? subplot.yAxis.ticks).map((t, i) => {
        const ts = subplot.yAxis.tickStyle;
        const isZoomed = !!zoomedYTicks;
        const fadeDelay = T_LABELS + i * 0.04;
        const shimmerDelay = T_SHIMMER + i * SHIMMER_STEP;
        return (
          <text
            key={`y-${i}`}
            className="fp-tick-label"
            x="2" y={(t.position + 3).toFixed(1)}
            textAnchor="start"
            fontSize={ts.fontSize} fontWeight={ts.fontWeight} fontFamily={ts.fontFamily}
            letterSpacing={ts.letterSpacing}
            fill={ts.color}
            style={isZoomed
              ? { transition: "y 0.25s ease", opacity: visible ? 1 : 0 } as React.CSSProperties
              : visible ? {
                "--fp-base": ts.color,
                animation: `fp-labelFadeY 0.35s ease ${fadeDelay.toFixed(2)}s both, fp-shimmer ${SHIMMER_DUR}s ease ${shimmerDelay.toFixed(2)}s 1`,
              } as React.CSSProperties : { opacity: 0 }
            }
          >
            {t.label}
          </text>
        );
      })}

      {/* ── X Axis Labels (with shimmer) — only when NOT scrolling bars ── */}
      {!needsScroll && subplot.xAxis.ticks.map((t, i) => {
        const ts = subplot.xAxis.tickStyle;
        const fadeDelay = T_LABELS + i * 0.03;
        const shimmerDelay = T_SHIMMER + i * SHIMMER_STEP;
        return (
          <text
            key={`x-${i}`}
            className="fp-tick-label"
            x={t.position.toFixed(1)} y={(h - 4).toFixed(1)}
            textAnchor="middle"
            fontSize={ts.fontSize} fontWeight={ts.fontWeight} fontFamily={ts.fontFamily}
            letterSpacing={ts.letterSpacing}
            fill={ts.color}
            style={visible ? {
              "--fp-base": ts.color,
              animation: `fp-labelFadeX 0.35s ease ${fadeDelay.toFixed(2)}s both, fp-shimmer ${SHIMMER_DUR}s ease ${shimmerDelay.toFixed(2)}s 1`,
            } as React.CSSProperties : { opacity: 0 }}
          >
            {t.label}
          </text>
        );
      })}

      {/* ── Stacked bar columns (one <g> per column with shared scaleY) ── */}
      {(() => {
        if (!isStackedBars) return null;
        const barEls = subplot.elements.filter(e => e.type === "bar") as BarPlotElement[];

        // Group segments by column index
        type SegInfo = { bar: BarRect; si: number; st: BarThemeStyle; xLabel: string; color: string; label: string };
        const cols = new Map<number, { x: number; minY: number; maxY: number; w: number; segs: SegInfo[] }>();
        for (const barEl of barEls) {
          const si = barEl.seriesIndex;
          const st = theme.bar.styles[si % theme.bar.styles.length];
          for (const bar of barEl.bars) {
            const xLabel = barEl.xLabels?.[bar.index] ?? String(bar.index);
            const seg: SegInfo = { bar, si, st, xLabel, color: barEl.color, label: barEl.label ?? "Value" };
            const c = cols.get(bar.index);
            if (c) {
              c.minY = Math.min(c.minY, bar.y);
              c.maxY = Math.max(c.maxY, bar.y + bar.height);
              c.segs.push(seg);
            } else {
              cols.set(bar.index, { x: bar.x, minY: bar.y, maxY: bar.y + bar.height, w: bar.width, segs: [seg] });
            }
          }
        }

        // Render bars and collect tooltip data for a separate top layer
        const tooltipData: { key: string; segId: string; bx: number; bw: number; ay: number; ah: number; color: string; label: string; value: number; xLabel: string }[] = [];

        const barNodes = Array.from(cols.entries()).map(([colIdx, col]) => {
          const delay = T_DATA + colIdx * 0.054;
          const cx = mapBarX(col.x), cw = mapBarW(col.w);
          const origin = `${(cx + cw / 2).toFixed(1)}px ${(pa.y + pa.h).toFixed(1)}px`;
          const growAnim = `fp-barGrow 0.81s cubic-bezier(0.22,1,0.36,1) ${delay.toFixed(2)}s both`;
          const growStyle = visible
            ? { transformOrigin: origin, animation: growAnim } as React.CSSProperties
            : { transform: "scaleY(0)", transformOrigin: origin } as React.CSSProperties;

          const fullY = col.minY;
          const fullH = col.maxY - col.minY;

          // Glow appears after bar growth completes
          const glowDelay = delay + 0.81;

          return (
            <g key={`stack-col-${colIdx}`}>
              {/* Base rect grows via scaleY */}
              <rect x={cx.toFixed(1)} y={fullY.toFixed(1)} width={cw.toFixed(1)} height={fullH.toFixed(1)}
                fill={theme.bar.defaultFill} shapeRendering="crispEdges" style={growStyle} />

              {col.segs.map(seg => {
                const { bar, si, st, xLabel, color, label } = seg;

                const sc = (hv: number) => (hv / 134) * bar.height;
                const bx = mapBarX(bar.x), bw = mapBarW(bar.width), ay = bar.y, ah = bar.height;

                // Collect tooltip data for top-layer rendering
                tooltipData.push({ key: `tip-${colIdx}-${si}`, segId: `${bar.index}-${si}`, bx, bw, ay, ah, color, label, value: bar.value, xLabel });

                // Each segment base rect also grows independently
                const segOrigin = `${(bx + bw / 2).toFixed(1)}px ${(pa.y + pa.h).toFixed(1)}px`;
                const segGrowStyle = visible
                  ? { transformOrigin: segOrigin, animation: growAnim } as React.CSSProperties
                  : { transform: "scaleY(0)", transformOrigin: segOrigin } as React.CSSProperties;

                return (
                  <g key={`seg-${si}`} className="fp-bar">
                    {/* Segment base grows with scaleY */}
                    <rect x={bx.toFixed(1)} y={ay.toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)}
                      fill={st.fill} style={segGrowStyle} shapeRendering="crispEdges" />
                    {/* Nested <svg> creates a viewport that clips glow to bar bounds */}
                    <svg x={bx.toFixed(1)} y={ay.toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)} overflow="hidden">
                      <g transform={`translate(${(-bx).toFixed(1)},${(-ay).toFixed(1)})`}
                        className="fp-glow-on"
                        style={visible
                          ? { animation: `fp-glowFadeIn 0.5s ease ${(glowDelay + si * 0.1).toFixed(2)}s both` } as React.CSSProperties
                          : { opacity: 0 } as React.CSSProperties}>
                        <rect x={bx.toFixed(1)} y={ay.toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)} fill={st.fill} />
                        <g className="fp-drift fp-drift1" filter={`url(#barSideGlow-${uid}-${si})`}>
                          <path d={`M${bx} ${ay+ah+sc(11)} V${ay+ah-sc(0.5)} C${bx} ${ay+ah-sc(0.5)} ${bx+bw*0.85} ${ay+ah-sc(15)} ${bx+bw*0.85} ${ay+ah-sc(26)} V${ay+sc(21)} C${bx+bw*0.85} ${ay+sc(14)} ${bx+bw*0.275} ${ay+sc(7.69)} ${bx} ${ay+sc(7.5)} V${ay-sc(4)} C${bx} ${ay-sc(4)} ${bx+bw*1.225} ${ay+sc(4.5)} ${bx+bw*1.225} ${ay+sc(21)} V${ay+ah-sc(40.5)} C${bx+bw*1.225} ${ay+ah-sc(8)} ${bx+bw*0.85} ${ay+ah-sc(9.5)} ${bx} ${ay+ah+sc(11)} Z`} fill={st.sideGlow} />
                        </g>
                        <g className="fp-drift fp-drift2" filter={`url(#barTopHL-${uid}-${si})`}>
                          <rect x={(bx + bw * 0.05).toFixed(1)} y={(ay + sc(1)).toFixed(1)} width={(bw * 0.9).toFixed(1)} height={sc(8).toFixed(1)} rx={2} fill={st.topGlow} />
                        </g>
                        <g className="fp-drift fp-drift3" filter={`url(#barBotGlow-${uid}-${si})`}>
                          <path d={`M${bx+bw*0.05} ${ay+ah-sc(8.2)} C${bx+bw*0.05} ${ay+ah-sc(9.2)} ${bx+bw*0.05} ${ay+ah-sc(4)} ${bx+bw*0.17} ${ay+ah-sc(1.5)} C${bx+bw*0.28} ${ay+ah+sc(0.8)} ${bx+bw*0.72} ${ay+ah+sc(0.8)} ${bx+bw*0.83} ${ay+ah-sc(1.5)} C${bx+bw*0.95} ${ay+ah-sc(4)} ${bx+bw*0.95} ${ay+ah-sc(9.2)} ${bx+bw*0.95} ${ay+ah-sc(8.2)} V${ay+ah} H${bx+bw*0.05} V${ay+ah-sc(8.2)}Z`} fill={st.bottomGlow} />
                        </g>
                        <g className="fp-drift fp-drift1b" filter={`url(#barLeftEdge-${uid}-${si})`}>
                          <path d={`M${bx-bw*0.01} ${ay+sc(4)} C${bx+bw*0.045} ${ay+sc(4)} ${bx+bw*0.045} ${ay+sc(4)} ${bx+bw*0.045} ${ay+sc(8)} V${ay+ah-sc(8)} C${bx+bw*0.045} ${ay+ah-sc(4)} ${bx-bw*0.01} ${ay+ah-sc(2)} ${bx-bw*0.01} ${ay+ah} V${ay+sc(4)}Z`} fill={st.leftEdge} />
                        </g>
                        {SPARKLE_DOTS.map((dot, dIdx) => {
                          const floatName = ["fp-sparkleFloat1", "fp-sparkleFloat2", "fp-sparkleFloat3"][dIdx % 3];
                          const dur = 2.5 + (dIdx % 5) * 0.5;
                          const spDelay = (dIdx * 0.2) % 1.5;
                          return (
                            <circle key={dIdx} className="fp-sparkle"
                              cx={(bx + dot.cx * bw).toFixed(1)} cy={(ay + dot.cy * ah).toFixed(1)} r={dot.r} fill={st.sparkle}
                              style={{ "--fp-sparkle-anim": `${floatName} ${dur}s ease-in-out ${spDelay.toFixed(1)}s infinite` } as React.CSSProperties}
                            />
                          );
                        })}
                        <g filter={`url(#barBotWhite-${uid}-${si})`}>
                          <path d={`M${bx} ${ay+ah-sc(3.5)} L${bx+bw*0.5} ${ay+ah-sc(1.5)} L${bx+bw} ${ay+ah-sc(3.5)} V${ay+ah} H${bx} V${ay+ah-sc(3.5)}Z`} fill="white" fillOpacity={0.8} />
                        </g>
                        <g filter={`url(#barTopWhite-${uid}-${si})`}>
                          <path d={`M${bx} ${ay+sc(3.5)} L${bx+bw*0.5} ${ay+sc(1.5)} L${bx+bw} ${ay+sc(3.5)} V${ay} H${bx} V${ay+sc(3.5)}Z`} fill="white" fillOpacity={0.8} />
                        </g>
                      </g>
                    </svg>
                    {/* Hit area — triggers glow (CSS) + tooltip (state) */}
                    <rect x={(bx - 2).toFixed(1)} y={(ay - 2).toFixed(1)} width={(bw + 4).toFixed(1)} height={(ah + 4).toFixed(1)}
                      fill="transparent" pointerEvents="all"
                      onMouseEnter={() => setHoveredSeg(`${bar.index}-${si}`)}
                      onMouseLeave={() => setHoveredSeg(null)} />
                  </g>
                );
              })}
            </g>
          );
        });

        return (
          <>
            <g clipPath={needsScroll ? `url(#barScrollClip-${uid})` : undefined}>
              {barNodes}
            </g>
            {/* Tooltip top layer — rendered after ALL bars, pointer-events: none */}
            {tooltipData.map(t => {
              const isHovered = hoveredSeg === t.segId;
              return (
                <g key={t.key} style={{ pointerEvents: "none", opacity: isHovered ? 1 : 0, transition: "opacity 0.12s ease" }}>
                  <TooltipBox
                    header={t.xLabel}
                    entries={[{ color: t.color, label: t.label, valueStr: fmtVal(t.value) }]}
                    tx={t.bx + t.bw / 2} ty={t.ay - 8} w={110} boundsW={w} paY={pa.y}
                  />
                </g>
              );
            })}
          </>
        );
      })()}

      {/* ── Plot Elements ────────────────────────────────────────────── */}
      {subplot.elements.map((el, elIdx) => {

        // ── Area ──
        if (el.type === "area") {
          const curAreaIdx = areaIdx++;
          const gid = `areaGrad-${uid}-${curAreaIdx}`;
          return (
            <path
              key={`area-${curAreaIdx}`}
              d={el.path}
              fill={`url(#${gid})`}
              opacity={el.alpha}
              style={visible ? { animation: `fp-areaFade 1.08s ease ${(T_DATA + curAreaIdx * 0.135).toFixed(2)}s both` } : { opacity: 0 }}
            />
          );
        }

        // ── Line ──
        if (el.type === "line") {
          const curLineIdx = lineIdx++;
          const da = dashArray(el.lineStyle);
          const delay = T_DATA + curLineIdx * 0.2;
          return (
            <React.Fragment key={`line-${curLineIdx}`}>
              <path
                className="fp-line-path"
                d={el.path} fill="none" stroke={el.color} strokeWidth={el.lineWidth}
                strokeLinejoin="round" pathLength={1} strokeDasharray="1" opacity={el.alpha}
                style={visible ? { animation: `fp-lineDraw 1.89s cubic-bezier(0.22,1,0.36,1) ${delay.toFixed(2)}s both` } : { strokeDashoffset: 1 }}
              />
              {da && el.lineStyle !== "solid" && (
                <path
                  className="fp-line-path"
                  d={el.path} fill="none" stroke={el.color} strokeWidth={el.lineWidth}
                  strokeLinejoin="round" strokeDasharray={da} opacity={el.alpha}
                  style={visible ? { animation: `fp-areaFade 0.3s ease ${(delay + 1.89).toFixed(2)}s both` } : { opacity: 0 }}
                />
              )}
            </React.Fragment>
          );
        }

        // ── Bar ──
        if (el.type === "bar") {
          // Stacked bars are rendered separately above with shared scaleY per column
          if (isStackedBars) return null;

          const barEl = el as BarPlotElement;
          const si = barEl.seriesIndex;
          const st = theme.bar.styles[si % theme.bar.styles.length];

          return (
            <g key={`bars-${si}`} clipPath={needsScroll || canZoomY ? `url(#barClip-${uid})` : undefined}>
              {barEl.bars.map(bar => {
                const delay = T_DATA + bar.index * 0.054;
                const bx = mapBarX(bar.x), bw = mapBarW(bar.width);
                const zoomed = canZoomY && yZoom > 1 ? mapBarY(bar.value) : null;
                const ay = zoomed ? zoomed.y : bar.y;
                const ah = zoomed ? zoomed.h : bar.height;
                const origin = `${(bx + bw / 2).toFixed(1)}px ${(pa.y + pa.h).toFixed(1)}px`;
                const growAnim = `fp-barGrow 0.81s cubic-bezier(0.22,1,0.36,1) ${delay.toFixed(2)}s both`;
                const growStyle = visible
                  ? { transformOrigin: origin, animation: growAnim } as React.CSSProperties
                  : { transform: "scaleY(0)", transformOrigin: origin } as React.CSSProperties;

                const sweepDelay = barSweepStart + bar.index * barSweepStep;
                const sweepStyle = visible
                  ? { animation: `fp-barSweep 0.4s ease ${sweepDelay.toFixed(2)}s 1` } as React.CSSProperties
                  : undefined;


                const sc = (hv: number) => (hv / 134) * ah;

                const xLabel = barEl.xLabels?.[bar.index] ?? String(bar.index);

                return (
                  <g key={bar.index} className="fp-bar">
                    <g style={growStyle}>
                    <rect x={bx.toFixed(1)} y={ay.toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)}
                      fill={theme.bar.defaultFill} shapeRendering="crispEdges"
                    />
                    </g>

                    {/* Nested <svg> clips glow to bar bounds — immune to CSS transforms */}
                    <svg x={bx.toFixed(1)} y={ay.toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)} overflow="hidden">
                      <g transform={`translate(${(-bx).toFixed(1)},${(-ay).toFixed(1)})`}
                        className="fp-glow-on"
                        style={visible
                          ? { animation: `fp-glowFadeIn 0.5s ease ${(delay + 0.3).toFixed(2)}s both` } as React.CSSProperties
                          : { opacity: 0 } as React.CSSProperties}>
                        <rect x={bx.toFixed(1)} y={ay.toFixed(1)} width={bw.toFixed(1)} height={ah.toFixed(1)} fill={st.fill} />
                        <g className="fp-drift fp-drift1" filter={`url(#barSideGlow-${uid}-${si})`}>
                          <path d={`M${bx} ${ay+ah+sc(11)} V${ay+ah-sc(0.5)} C${bx} ${ay+ah-sc(0.5)} ${bx+bw*0.85} ${ay+ah-sc(15)} ${bx+bw*0.85} ${ay+ah-sc(26)} V${ay+sc(21)} C${bx+bw*0.85} ${ay+sc(14)} ${bx+bw*0.275} ${ay+sc(7.69)} ${bx} ${ay+sc(7.5)} V${ay-sc(4)} C${bx} ${ay-sc(4)} ${bx+bw*1.225} ${ay+sc(4.5)} ${bx+bw*1.225} ${ay+sc(21)} V${ay+ah-sc(40.5)} C${bx+bw*1.225} ${ay+ah-sc(8)} ${bx+bw*0.85} ${ay+ah-sc(9.5)} ${bx} ${ay+ah+sc(11)} Z`} fill={st.sideGlow} />
                        </g>
                        <g className="fp-drift fp-drift2" filter={`url(#barTopHL-${uid}-${si})`}>
                          <rect x={(bx + bw * 0.05).toFixed(1)} y={(ay + sc(1)).toFixed(1)} width={(bw * 0.9).toFixed(1)} height={sc(8).toFixed(1)} rx={2} fill={st.topGlow} />
                        </g>
                        <g className="fp-drift fp-drift3" filter={`url(#barBotGlow-${uid}-${si})`}>
                          <path d={`M${bx+bw*0.05} ${ay+ah-sc(8.2)} C${bx+bw*0.05} ${ay+ah-sc(9.2)} ${bx+bw*0.05} ${ay+ah-sc(4)} ${bx+bw*0.17} ${ay+ah-sc(1.5)} C${bx+bw*0.28} ${ay+ah+sc(0.8)} ${bx+bw*0.72} ${ay+ah+sc(0.8)} ${bx+bw*0.83} ${ay+ah-sc(1.5)} C${bx+bw*0.95} ${ay+ah-sc(4)} ${bx+bw*0.95} ${ay+ah-sc(9.2)} ${bx+bw*0.95} ${ay+ah-sc(8.2)} V${ay+ah} H${bx+bw*0.05} V${ay+ah-sc(8.2)}Z`} fill={st.bottomGlow} />
                        </g>
                        <g className="fp-drift fp-drift1b" filter={`url(#barLeftEdge-${uid}-${si})`}>
                          <path d={`M${bx-bw*0.01} ${ay+sc(4)} C${bx+bw*0.045} ${ay+sc(4)} ${bx+bw*0.045} ${ay+sc(4)} ${bx+bw*0.045} ${ay+sc(8)} V${ay+ah-sc(8)} C${bx+bw*0.045} ${ay+ah-sc(4)} ${bx-bw*0.01} ${ay+ah-sc(2)} ${bx-bw*0.01} ${ay+ah} V${ay+sc(4)}Z`} fill={st.leftEdge} />
                        </g>
                        {SPARKLE_DOTS.map((dot, dIdx) => {
                          const floatName = ["fp-sparkleFloat1", "fp-sparkleFloat2", "fp-sparkleFloat3"][dIdx % 3];
                          const dur = 2.5 + (dIdx % 5) * 0.5;
                          const spDelay = (dIdx * 0.2) % 1.5;
                          return (
                            <circle key={dIdx} className="fp-sparkle"
                              cx={(bx + dot.cx * bw).toFixed(1)} cy={(ay + dot.cy * ah).toFixed(1)} r={dot.r} fill={st.sparkle}
                              style={{ "--fp-sparkle-anim": `${floatName} ${dur}s ease-in-out ${spDelay.toFixed(1)}s infinite` } as React.CSSProperties}
                            />
                          );
                        })}
                        <g filter={`url(#barBotWhite-${uid}-${si})`}>
                          <path d={`M${bx} ${ay+ah-sc(3.5)} L${bx+bw*0.5} ${ay+ah-sc(1.5)} L${bx+bw} ${ay+ah-sc(3.5)} V${ay+ah} H${bx} V${ay+ah-sc(3.5)}Z`} fill="white" fillOpacity={0.8} />
                        </g>
                        <g filter={`url(#barTopWhite-${uid}-${si})`}>
                          <path d={`M${bx} ${ay+sc(3.5)} L${bx+bw*0.5} ${ay+sc(1.5)} L${bx+bw} ${ay+sc(3.5)} V${ay} H${bx} V${ay+sc(3.5)}Z`} fill="white" fillOpacity={0.8} />
                        </g>
                      </g>
                    </svg>

                    {/* Hit area for hover tooltip */}
                    <rect x={(bx - 2).toFixed(1)} y={(ay - 2).toFixed(1)} width={(bw + 4).toFixed(1)} height={(ah + 4).toFixed(1)}
                      fill="transparent" pointerEvents="all" opacity={0}
                      onMouseEnter={() => setHoveredBar(`${si}-${bar.index}`)}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                    {(() => { barTipData.push({ key: `bt-${si}-${bar.index}`, id: `${si}-${bar.index}`, bx, bw, ay, color: barEl.color, label: barEl.label ?? "Value", value: bar.value, xLabel }); return null; })()}
                  </g>
                );
              })}
            </g>
          );
        }

        // ── Scatter ──
        if (el.type === "scatter") {
          const scatterEl = el as ScatterPlotElement;
          return (
            <React.Fragment key={`scatter-${elIdx}`}>
              {scatterEl.points.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)} r={Math.sqrt(pt.size).toFixed(1)}
                  fill={pt.color ?? scatterEl.color} opacity={scatterEl.alpha}
                  style={visible ? { animation: `fp-scatterPop 0.5s ease ${(T_DATA + i * 0.02).toFixed(2)}s both` } : { opacity: 0 }}
                />
              ))}
            </React.Fragment>
          );
        }

        // ── HLine ──
        if (el.type === "hline") {
          const hline = el as HLinePlotElement;
          const da = dashArray(hline.lineStyle);
          return (
            <line
              key={`hline-${elIdx}`}
              x1={hline.xMin.toFixed(1)} y1={hline.y.toFixed(1)} x2={hline.xMax.toFixed(1)} y2={hline.y.toFixed(1)}
              stroke={hline.color} strokeWidth={hline.lineWidth}
              strokeDasharray={da ?? undefined}
              style={visible ? { animation: `fp-refFade 0.5s ease ${T_DATA}s both` } : { opacity: 0 }}
            />
          );
        }

        // ── VLine ──
        if (el.type === "vline") {
          const vline = el as VLinePlotElement;
          const da = dashArray(vline.lineStyle);
          return (
            <line
              key={`vline-${elIdx}`}
              x1={vline.x.toFixed(1)} y1={vline.yMin.toFixed(1)} x2={vline.x.toFixed(1)} y2={vline.yMax.toFixed(1)}
              stroke={vline.color} strokeWidth={vline.lineWidth}
              strokeDasharray={da ?? undefined}
              style={visible ? { animation: `fp-refFade 0.5s ease ${T_DATA}s both` } : { opacity: 0 }}
            />
          );
        }

        // ── Text ──
        if (el.type === "text") {
          const txt = el as TextPlotElement;
          return (
            <text
              key={`text-${elIdx}`}
              x={txt.x.toFixed(1)} y={txt.y.toFixed(1)}
              textAnchor={txt.anchor}
              fontSize={txt.style.fontSize} fontWeight={txt.style.fontWeight} fontFamily={txt.style.fontFamily}
              fill={txt.style.color}
              transform={txt.rotation ? `rotate(${txt.rotation} ${txt.x.toFixed(1)} ${txt.y.toFixed(1)})` : undefined}
              style={visible ? { animation: "fp-refFade 0.5s ease 1.5s both" } : { opacity: 0 }}
            >
              {txt.content}
            </text>
          );
        }

        // ── Annotation ──
        if (el.type === "annotation") {
          const ann = el as AnnotationPlotElement;
          const tx = ann.xytext?.x ?? ann.xy.x;
          const ty = ann.xytext?.y ?? ann.xy.y;
          return (
            <g key={`annot-${elIdx}`} style={visible ? { animation: "fp-refFade 0.5s ease 1.5s both" } : { opacity: 0 }}>
              {ann.xytext && (
                <line
                  x1={ann.xytext.x.toFixed(1)} y1={ann.xytext.y.toFixed(1)}
                  x2={ann.xy.x.toFixed(1)} y2={ann.xy.y.toFixed(1)}
                  stroke={ann.arrowColor ?? ann.style.color} strokeWidth={ann.arrowWidth ?? 1}
                />
              )}
              <text
                x={tx.toFixed(1)} y={ty.toFixed(1)}
                fontSize={ann.style.fontSize} fontFamily={ann.style.fontFamily} fill={ann.style.color}
              >
                {ann.text}
              </text>
            </g>
          );
        }

        return null;
      })}

      {/* ── Bar tooltip top layer (rendered after all bars so never occluded) ── */}
      {barTipData.map(t => {
        const isHovered = hoveredBar === t.id;
        return (
          <g key={t.key} style={{ pointerEvents: "none", opacity: isHovered ? 1 : 0, transition: "opacity 0.12s ease" }}>
            <TooltipBox
              header={t.xLabel}
              entries={[{ color: t.color, label: t.label, valueStr: fmtVal(t.value) }]}
              tx={t.bx + t.bw / 2} ty={t.ay - 8} w={110} boundsW={w} paY={pa.y}
            />
          </g>
        );
      })}

      {/* ── Scrolling X Axis Labels (clipped to plot area) ──────── */}
      {needsScroll && (
        <g clipPath={`url(#barScrollClip-${uid})`}>
          {subplot.xAxis.ticks.map((t, i) => {
            const ts = subplot.xAxis.tickStyle;
            const fadeDelay = T_LABELS + i * 0.03;
            const shimmerDelay = T_SHIMMER + i * SHIMMER_STEP;
            const mappedX = mapBarX(t.position);
            return (
              <text
                key={`x-${i}`}
                className="fp-tick-label"
                x={mappedX.toFixed(1)} y={(h - 4).toFixed(1)}
                textAnchor="middle"
                fontSize={ts.fontSize} fontWeight={ts.fontWeight} fontFamily={ts.fontFamily}
                letterSpacing={ts.letterSpacing}
                fill={ts.color}
                style={visible ? {
                  "--fp-base": ts.color,
                  animation: `fp-labelFadeX 0.35s ease ${fadeDelay.toFixed(2)}s both, fp-shimmer ${SHIMMER_DUR}s ease ${shimmerDelay.toFixed(2)}s 1`,
                } as React.CSSProperties : { opacity: 0 }}
              >
                {t.label}
              </text>
            );
          })}
        </g>
      )}

      {/* ── Legend ─────────────────────────────────────────────────── */}
      {subplot.legend && subplot.legend.entries.length > 0 && (() => {
        const lg = subplot.legend;
        const fontSize = Math.round(theme.legend.fontSize * Math.min(w / 595, 1.25));
        const itemH = fontSize + 4;
        const gapX = fontSize * 2.5;
        const totalW = lg.entries.reduce((sum, e) => sum + fontSize + 4 + e.label.length * fontSize * 0.55 + gapX, -gapX);
        const lx = pa.x + (pa.w - totalW) / 2;
        const ly = pa.y + pa.h + 64;
        let cx = lx;
        return (
          <g style={visible ? { animation: "fp-refFade 0.5s ease 1.5s both" } : { opacity: 0 }}>
            {lg.entries.map((entry, i) => {
              const ex = cx;
              const swatchW = fontSize;
              const labelX = ex + swatchW + 4;
              const labelW = entry.label.length * fontSize * 0.55;
              cx += swatchW + 4 + labelW + gapX;
              return (
                <g key={i}>
                  {entry.type === "line" ? (
                    <line x1={ex} y1={ly + itemH / 2} x2={ex + swatchW} y2={ly + itemH / 2}
                      stroke={entry.color} strokeWidth={2} />
                  ) : (
                    <rect x={ex} y={ly + 2} width={swatchW} height={itemH - 4} rx={2}
                      fill={entry.color} />
                  )}
                  <text x={labelX} y={ly + itemH / 2 + 1}
                    dominantBaseline="middle"
                    fontSize={fontSize} fontFamily={theme.legend.fontFamily}
                    fill={theme.text.secondary}
                  >
                    {entry.label}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* ── Hover overlays (rendered last so they're on top) ──────── */}
      {hasLineEls && <LineHoverOverlay subplot={subplot} uid={uid} />}
      {hasScatterEls && <ScatterHoverOverlay subplot={subplot} uid={uid} />}
    </svg>
  );

  // Attach native wheel listener with { passive: false } so preventDefault stops page scroll
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || (!needsScroll && !canZoomY)) return;
    const handler = (e: WheelEvent) => {
      if (needsScroll) {
        e.preventDefault();
        const pxW = el.clientWidth;
        const svgToPixRatio = pxW / w;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const svgDelta = delta / svgToPixRatio;
        setScrollX(prev => Math.max(0, Math.min(maxScrollSvg, prev + svgDelta * 1.5)));
      } else if (canZoomY) {
        e.preventDefault();
        const delta = e.deltaY;
        setYZoom(prev => {
          const factor = delta < 0 ? 1.15 : 1 / 1.15;
          return Math.max(1, Math.min(100, prev * factor));
        });
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [needsScroll, canZoomY, w, maxScrollSvg]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: `${aspectPct.toFixed(2)}%`,
        transition: "padding-bottom 0.35s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {svgElement}

      {/* Y-axis zoom controls */}
      {canZoomY && (
        <div style={{
          position: "absolute",
          right: 6,
          top: `${((pa.y / totalH) * 100).toFixed(1)}%`,
          display: "flex", flexDirection: "column", gap: 2,
          zIndex: 3,
          opacity: yZoom > 1 ? 1 : 0.4,
          transition: "opacity 0.2s ease",
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = yZoom > 1 ? "1" : "0.4"; }}
        >
          <button onClick={() => setYZoom(prev => Math.min(100, prev * 1.5))}
            style={{
              width: 22, height: 22, borderRadius: 4, border: "1px solid #2a2a2a",
              background: "#1a1a1a", color: "#888", fontSize: 13, lineHeight: "20px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Inter', sans-serif",
            }}
          >+</button>
          <button onClick={() => setYZoom(prev => Math.max(1, prev / 1.5))}
            style={{
              width: 22, height: 22, borderRadius: 4, border: "1px solid #2a2a2a",
              background: "#1a1a1a", color: "#888", fontSize: 13, lineHeight: "20px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Inter', sans-serif",
            }}
          >&minus;</button>
          {yZoom > 1 && (
            <button onClick={() => setYZoom(1)}
              style={{
                width: 22, height: 22, borderRadius: 4, border: "1px solid #2a2a2a",
                background: "#1a1a1a", color: "#888", fontSize: 8, lineHeight: "20px",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Inter', sans-serif",
              }}
              title="Reset zoom"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 3.5H4V1M1.5 3.5A3.5 3.5 0 1 1 2.3 6.5" stroke="#888" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Left arrow indicator — starts at plot area left edge (after y-axis labels) */}
      {needsScroll && (() => {
        const leftPct = `${((pa.x / w) * 100).toFixed(2)}%`;
        return (
          <div style={{
            position: "absolute", left: leftPct, top: 0, bottom: 0,
            width: 36,
            pointerEvents: showLeftArrow ? "auto" : "none",
            opacity: showLeftArrow ? 1 : 0,
            transition: "opacity 0.3s ease",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(to right, rgba(18,18,18,0.85), transparent)",
            cursor: "pointer", zIndex: 2,
          }}
            onClick={() => scrollStep(-1)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        );
      })()}

      {/* Right arrow indicator */}
      {needsScroll && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: 36,
          pointerEvents: showRightArrow ? "auto" : "none",
          opacity: showRightArrow ? 1 : 0,
          transition: "opacity 0.3s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(to left, rgba(18,18,18,0.85), transparent)",
          cursor: "pointer", zIndex: 2,
        }}
          onClick={() => scrollStep(1)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Main FlashChart Component ───────────────────────────────────────────

export interface FlashChartProps {
  scene: Scene;
  className?: string;
  animate?: boolean;
}

function FlashChartInner({ scene, className, animate = true }: FlashChartProps) {
  if (!scene?.subplots?.length) return null;
  const theme = getTheme(scene.theme);

  return (
    <div className={className}>
      {scene.subplots.map((subplot, i) => (
        <SubplotRenderer key={i} subplot={subplot} theme={theme} sceneWidth={scene.width} animate={animate} />
      ))}
    </div>
  );
}

const FlashChart = memo(FlashChartInner);
export default FlashChart;
