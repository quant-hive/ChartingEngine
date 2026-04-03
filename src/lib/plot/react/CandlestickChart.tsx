"use client";

/**
 * CandlestickChart — Custom candlestick chart component matching Figma design.
 *
 * Features:
 * - Gradient candle bodies (bullish green / bearish red) from Figma
 * - Gradient wicks with warm color at body junction
 * - Top highlight glow on each candle body
 * - OHLC header with colored values
 * - Hover crosshair (vertical + horizontal at close price)
 * - Hover tooltip with OHLC breakdown
 * - Current price badge on y-axis (right side)
 * - Horizontal grid lines (toggleable)
 * - Y-axis price labels on right (Instrument Serif)
 * - X-axis date labels on bottom
 * - Smooth staggered entrance animations
 * - Responsive (SVG viewBox)
 * - Theme support (dark / light / naked)
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";

// ── Candlestick data interface ──────────────────────────────────────────

export interface CandlestickData {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  labels?: string[];
  ticker?: string;
  interval?: string;
}

export interface CandlestickChartProps {
  data: CandlestickData;
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  grid?: boolean;
  showLegend?: boolean;
  theme?: "dark" | "light" | "naked";
}

// ── Color constants from Figma ──────────────────────────────────────────

const BEAR = {
  wick: [
    { offset: "0%", color: "#D24445" },
    { offset: "36%", color: "#FFDCA3" },
    { offset: "77%", color: "#D96058" },
    { offset: "100%", color: "#E57B77" },
  ],
  body: [
    { offset: "0%", color: "rgba(241,148,107,0.9)" },
    { offset: "100%", color: "#FF4948" },
  ],
  highlight: [
    { offset: "0%", color: "#FFF4B8" },
    { offset: "100%", color: "rgba(255,244,184,0)" },
  ],
  ohlcColor: "#E0484C",
};

const BULL = {
  wick: [
    { offset: "0%", color: "#ADE2B4" },
    { offset: "19%", color: "#A5D5A1" },
    { offset: "60%", color: "#88CB86" },
    { offset: "100%", color: "#A0B7AF" },
  ],
  body: [
    { offset: "0%", color: "#8CE97E" },
    { offset: "100%", color: "#317430" },
  ],
  highlight: [
    { offset: "0%", color: "#B9F7B6" },
    { offset: "100%", color: "rgba(185,247,182,0)" },
  ],
  ohlcColor: "#4ECDC4",
};

// ── CSS Animations ──────────────────────────────────────────────────────

const FP_CANDLE_CSS = `
@keyframes fp-candleGridDraw {
  from { stroke-dashoffset: var(--fp-len); }
  to { stroke-dashoffset: 0; }
}
@keyframes fp-candleLabelFade {
  from { opacity: 0; transform: translateX(4px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fp-candleLabelFadeX {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fp-candleGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
@keyframes fp-candleWickGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
@keyframes fp-candleFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fp-candleGlow {
  0% { opacity: 0; filter: brightness(1); }
  50% { opacity: 1; filter: brightness(1.3); }
  100% { opacity: 1; filter: brightness(1); }
}
@keyframes fp-candleShimmer {
  0%, 100% { fill: var(--fp-base); }
  30% { fill: #787878; }
  50% { fill: #c4c4c4; }
  70% { fill: #787878; }
}

/* Light theme overrides */
.fp-candle-light text { fill: #333 !important; }
.fp-candle-light .fp-candle-grid { stroke: #e0e0e0 !important; }
.fp-candle-light .fp-candle-separator { stroke: #ccc !important; }
.fp-candle-light .fp-candle-crosshair { stroke: #bbb !important; }
.fp-candle-light .fp-candle-ohlc-label { color: #333 !important; }
.fp-candle-light .fp-candle-ohlc-ticker { color: #666 !important; }
`;

// ── Helpers ─────────────────────────────────────────────────────────────

function niceNum(value: number, round: boolean): number {
  if (value === 0) return 0;
  const exp = Math.floor(Math.log10(Math.abs(value)));
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

function computePriceTicks(
  min: number,
  max: number,
  targetTicks = 11,
): { min: number; max: number; step: number; ticks: number[] } {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / (targetTicks - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return { min: niceMin, max: niceMax, step, ticks };
}

function fmtPrice(v: number): string {
  if (Math.abs(v) >= 10000) return v.toFixed(2);
  if (Math.abs(v) >= 100) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

// ── Component ───────────────────────────────────────────────────────────

export default function CandlestickChart({
  data,
  title,
  subtitle,
  width: w = 546,
  height: h = 344,
  grid = true,
  showLegend = true,
  theme = "dark",
}: CandlestickChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);

  // IntersectionObserver for entrance animation
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { open, high, low, close, labels, ticker, interval } = data;
  const n = Math.min(open.length, high.length, low.length, close.length);

  const isLight = theme === "light";
  const isNaked = theme === "naked";

  // ── Layout ──────────────────────────────────────────────────────────
  const PAD = { top: 10, right: 62, bottom: 36, left: 14 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const plotX = PAD.left;
  const plotY = PAD.top;

  // ── Price range ─────────────────────────────────────────────────────
  const allHigh = useMemo(() => Math.max(...high.slice(0, n)), [high, n]);
  const allLow = useMemo(() => Math.min(...low.slice(0, n)), [low, n]);
  const priceAxis = useMemo(
    () => computePriceTicks(allLow, allHigh, 11),
    [allLow, allHigh],
  );

  // ── Scale functions ─────────────────────────────────────────────────
  const scaleY = useCallback(
    (price: number) =>
      plotY +
      plotH -
      ((price - priceAxis.min) / (priceAxis.max - priceAxis.min)) * plotH,
    [plotY, plotH, priceAxis.min, priceAxis.max],
  );

  const candleSpacing = plotW / n;
  const candleW = Math.max(3, Math.min(candleSpacing * 0.55, 14));
  const scaleX = useCallback(
    (i: number) => plotX + candleSpacing * (i + 0.5),
    [plotX, candleSpacing],
  );

  // ── Last close for price badge ──────────────────────────────────────
  const lastClose = close[n - 1];
  const lastIsUp = close[n - 1] >= open[n - 1];

  // ── Hovered candle data (default to last) ───────────────────────────
  const hIdx = hoveredCandle ?? n - 1;
  const hOpen = open[hIdx];
  const hHigh = high[hIdx];
  const hLow = low[hIdx];
  const hClose = close[hIdx];
  const hIsUp = hClose >= hOpen;
  const hColor = hIsUp ? BULL.ohlcColor : BEAR.ohlcColor;
  const hChange = hClose - hOpen;
  const hChangePct = (hChange / hOpen) * 100;

  // ── Animation timing ────────────────────────────────────────────────
  const T_GRID = 0;
  const T_LABELS = 0.45;
  const T_SHIMMER = 1.8;
  const T_CANDLES = 0.7;
  const CANDLE_STEP = 0.03;

  // ── Theme colors ────────────────────────────────────────────────────
  const colors = {
    gridLine: isLight ? "#e8e8e8" : "#1e1e22",
    separator: isLight ? "#d0d0d0" : "#2a2a2e",
    crosshair: isLight ? "#bbbbbb" : "#3a3a3e",
    yLabel: isLight ? "#333333" : "#ffffff",
    xLabel: isLight ? "#888888" : "#707073",
    ohlcLabel: isLight ? "#333333" : "#ffffff",
    ohlcTicker: isLight ? "#666666" : "#909092",
    tooltipBg: isLight ? "#f5f5f5" : "#1a1a1e",
    tooltipBorder: isLight ? "#ddd" : "#2a2a2e",
    tooltipText: isLight ? "#555" : "#aaaaaa",
    tooltipHeader: isLight ? "#999" : "#808080",
    fadeBg: isLight ? "#fafafa" : "#121318",
  };

  const aspectPct = (h / w) * 100;
  const themeClass = isLight ? "fp-candle-light" : "";

  return (
    <div className={`relative w-full ${themeClass}`} style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── OHLC Header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center flex-wrap gap-x-1 gap-y-0 px-1 mb-1"
        style={{
          fontSize: 10,
          fontWeight: 500,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s ease 0.3s",
        }}
      >
        {ticker && (
          <span className="fp-candle-ohlc-ticker" style={{ color: colors.ohlcTicker, fontSize: 10, marginRight: 4 }}>
            {ticker}
          </span>
        )}
        {interval && (
          <>
            <span style={{ color: "#3a3a3a", marginRight: 2 }}>|</span>
            <span className="fp-candle-ohlc-ticker" style={{ color: colors.ohlcTicker, fontSize: 10, marginRight: 6 }}>
              {interval}
            </span>
          </>
        )}
        <span className="fp-candle-ohlc-label" style={{ color: colors.ohlcLabel }}>O</span>
        <span style={{ color: hColor }}>{fmtPrice(hOpen)}</span>
        <span className="fp-candle-ohlc-label" style={{ color: colors.ohlcLabel, marginLeft: 4 }}>H</span>
        <span style={{ color: hColor }}>{fmtPrice(hHigh)}</span>
        <span className="fp-candle-ohlc-label" style={{ color: colors.ohlcLabel, marginLeft: 4 }}>L</span>
        <span style={{ color: hColor }}>{fmtPrice(hLow)}</span>
        <span className="fp-candle-ohlc-label" style={{ color: colors.ohlcLabel, marginLeft: 4 }}>C</span>
        <span style={{ color: hColor }}>{fmtPrice(hClose)}</span>
        <span style={{ color: hColor, marginLeft: 6, fontSize: 9 }}>
          {hChange >= 0 ? "+" : ""}
          {fmtPrice(hChange)} ({hChangePct >= 0 ? "+" : ""}
          {hChangePct.toFixed(2)}%)
        </span>
      </div>

      {/* ── SVG Chart ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: `${aspectPct.toFixed(2)}%`,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="block"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <style>{FP_CANDLE_CSS}</style>

          <defs>
            {/* Per-candle gradients */}
            {Array.from({ length: n }, (_, i) => {
              const isUp = close[i] >= open[i];
              const scheme = isUp ? BULL : BEAR;
              const id = `c${i}`;
              return (
                <React.Fragment key={id}>
                  <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1">
                    {scheme.wick.map((s, j) => (
                      <stop key={j} offset={s.offset} stopColor={s.color} />
                    ))}
                  </linearGradient>
                  <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
                    {scheme.body.map((s, j) => (
                      <stop key={j} offset={s.offset} stopColor={s.color} />
                    ))}
                  </linearGradient>
                  <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">
                    {scheme.highlight.map((s, j) => (
                      <stop key={j} offset={s.offset} stopColor={s.color} />
                    ))}
                  </linearGradient>
                </React.Fragment>
              );
            })}

            {/* Left fade gradient */}
            <linearGradient id="candle-fade-l" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={isNaked ? "transparent" : colors.fadeBg} stopOpacity={1} />
              <stop offset="100%" stopColor={isNaked ? "transparent" : colors.fadeBg} stopOpacity={0} />
            </linearGradient>

            {/* Clip for plot area */}
            <clipPath id="candle-plot-clip">
              <rect x={plotX} y={plotY} width={plotW} height={plotH} />
            </clipPath>

            {/* Glow filter for candle bodies */}
            <filter id="candle-body-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
            </filter>
          </defs>

          {/* ── Grid lines (horizontal) ────────────────────────────────── */}
          {grid &&
            priceAxis.ticks.map((price, i) => {
              const y = scaleY(price);
              if (y < plotY - 1 || y > plotY + plotH + 1) return null;
              const len = plotW;
              return (
                <line
                  key={`g${i}`}
                  className="fp-candle-grid"
                  x1={plotX}
                  y1={y}
                  x2={plotX + plotW}
                  y2={y}
                  stroke={colors.gridLine}
                  strokeWidth={0.5}
                  style={
                    visible
                      ? ({
                          "--fp-len": len,
                          strokeDasharray: len,
                          animation: `fp-candleGridDraw 0.6s cubic-bezier(0.22,1,0.36,1) ${(T_GRID + i * 0.04).toFixed(2)}s both`,
                        } as React.CSSProperties)
                      : { opacity: 0 }
                  }
                />
              );
            })}

          {/* ── Y-axis labels (right side, Instrument Serif) ────────────── */}
          {priceAxis.ticks.map((price, i) => {
            const y = scaleY(price);
            if (y < plotY - 6 || y > plotY + plotH + 6) return null;
            const fadeDelay = T_LABELS + i * 0.03;
            const shimmerDelay = T_SHIMMER + i * 0.06;
            return (
              <text
                key={`yt${i}`}
                x={plotX + plotW + 8}
                y={y + 4}
                fontSize={11}
                fontFamily="var(--font-instrument-serif), 'Instrument Serif', serif"
                fill={colors.yLabel}
                style={
                  visible
                    ? ({
                        "--fp-base": colors.yLabel,
                        animation: `fp-candleLabelFade 0.35s ease ${fadeDelay.toFixed(2)}s both, fp-candleShimmer 0.24s ease ${shimmerDelay.toFixed(2)}s 1`,
                      } as React.CSSProperties)
                    : { opacity: 0 }
                }
              >
                {fmtPrice(price)}
              </text>
            );
          })}

          {/* ── X-axis separator ────────────────────────────────────────── */}
          <line
            className="fp-candle-separator"
            x1={plotX}
            y1={plotY + plotH}
            x2={plotX + plotW}
            y2={plotY + plotH}
            stroke={colors.separator}
            strokeWidth={0.5}
            style={
              visible
                ? ({ animation: `fp-candleFadeIn 0.5s ease ${T_LABELS}s both` } as React.CSSProperties)
                : { opacity: 0 }
            }
          />

          {/* ── X-axis labels (bottom) ──────────────────────────────────── */}
          {labels &&
            (() => {
              const maxLabels = Math.max(3, Math.floor(plotW / 50));
              const step = Math.max(1, Math.ceil(n / maxLabels));
              return labels.slice(0, n).map((label, i) => {
                if (i % step !== 0 && i !== n - 1) return null;
                const x = scaleX(i);
                const fadeDelay = T_LABELS + i * 0.02;
                const shimmerDelay = T_SHIMMER + i * 0.06;
                return (
                  <text
                    key={`xt${i}`}
                    x={x}
                    y={plotY + plotH + 18}
                    textAnchor="middle"
                    fontSize={8}
                    fontFamily="'Inter', sans-serif"
                    fontWeight={500}
                    fill={colors.xLabel}
                    style={
                      visible
                        ? ({
                            "--fp-base": colors.xLabel,
                            animation: `fp-candleLabelFadeX 0.35s ease ${fadeDelay.toFixed(2)}s both, fp-candleShimmer 0.24s ease ${shimmerDelay.toFixed(2)}s 1`,
                          } as React.CSSProperties)
                        : { opacity: 0 }
                    }
                  >
                    {label}
                  </text>
                );
              });
            })()}

          {/* ── Candles (clipped to plot area) ──────────────────────────── */}
          <g clipPath="url(#candle-plot-clip)">
            {Array.from({ length: n }, (_, i) => {
              const o = open[i],
                hi = high[i],
                lo = low[i],
                c = close[i];
              const isUp = c >= o;
              const bodyTop = isUp ? c : o;
              const bodyBot = isUp ? o : c;

              const cx = scaleX(i);
              const wickTopY = scaleY(hi);
              const wickBotY = scaleY(lo);
              const bodyTopY = scaleY(bodyTop);
              const bodyBotY = scaleY(bodyBot);
              const bodyH = Math.max(1, bodyBotY - bodyTopY);
              const wickH = Math.max(0.5, wickBotY - wickTopY);

              const delay = T_CANDLES + i * CANDLE_STEP;
              const wickW = 1.2;
              const id = `c${i}`;

              // Grow origin = center of body
              const bodyCenterY = bodyTopY + bodyH / 2;
              const origin = `${cx.toFixed(1)}px ${bodyCenterY.toFixed(1)}px`;

              // Highlight height
              const hlH = Math.max(1, bodyH * 0.08);

              const isHovered = hoveredCandle === i;

              return (
                <g key={i}>
                  {/* Wick */}
                  <rect
                    x={(cx - wickW / 2).toFixed(2)}
                    y={wickTopY.toFixed(2)}
                    width={wickW.toFixed(2)}
                    height={wickH.toFixed(2)}
                    fill={`url(#${id}-w)`}
                    rx={0.6}
                    style={
                      visible
                        ? ({
                            transformOrigin: origin,
                            animation: `fp-candleWickGrow 0.45s cubic-bezier(0.22,1,0.36,1) ${(delay + 0.12).toFixed(2)}s both`,
                          } as React.CSSProperties)
                        : ({ transform: "scaleY(0)", transformOrigin: origin } as React.CSSProperties)
                    }
                  />

                  {/* Body */}
                  <rect
                    x={(cx - candleW / 2).toFixed(2)}
                    y={bodyTopY.toFixed(2)}
                    width={candleW.toFixed(2)}
                    height={bodyH.toFixed(2)}
                    fill={`url(#${id}-b)`}
                    rx={0.8}
                    style={
                      visible
                        ? ({
                            transformOrigin: origin,
                            animation: `fp-candleGrow 0.55s cubic-bezier(0.22,1,0.36,1) ${delay.toFixed(2)}s both`,
                          } as React.CSSProperties)
                        : ({ transform: "scaleY(0)", transformOrigin: origin } as React.CSSProperties)
                    }
                  />

                  {/* Body glow (subtle outer glow) */}
                  <rect
                    x={(cx - candleW / 2 - 1).toFixed(2)}
                    y={(bodyTopY - 1).toFixed(2)}
                    width={(candleW + 2).toFixed(2)}
                    height={(bodyH + 2).toFixed(2)}
                    fill={`url(#${id}-b)`}
                    rx={1}
                    opacity={0.25}
                    filter="url(#candle-body-glow)"
                    style={
                      visible
                        ? ({
                            animation: `fp-candleGlow 0.7s ease ${(delay + 0.35).toFixed(2)}s both`,
                          } as React.CSSProperties)
                        : { opacity: 0 }
                    }
                  />

                  {/* Top highlight */}
                  <rect
                    x={(cx - candleW / 2).toFixed(2)}
                    y={bodyTopY.toFixed(2)}
                    width={candleW.toFixed(2)}
                    height={hlH.toFixed(2)}
                    fill={`url(#${id}-h)`}
                    rx={0.5}
                    style={
                      visible
                        ? ({
                            animation: `fp-candleGlow 0.8s ease ${(delay + 0.4).toFixed(2)}s both`,
                          } as React.CSSProperties)
                        : { opacity: 0 }
                    }
                  />

                  {/* Hover highlight (brighter body on hover) */}
                  {isHovered && (
                    <rect
                      x={(cx - candleW / 2 - 0.5).toFixed(2)}
                      y={(bodyTopY - 0.5).toFixed(2)}
                      width={(candleW + 1).toFixed(2)}
                      height={(bodyH + 1).toFixed(2)}
                      fill={`url(#${id}-b)`}
                      rx={1}
                      opacity={0.3}
                      filter="url(#candle-body-glow)"
                    />
                  )}

                  {/* Hit area */}
                  <rect
                    x={(cx - candleSpacing / 2).toFixed(2)}
                    y={plotY.toFixed(2)}
                    width={candleSpacing.toFixed(2)}
                    height={plotH.toFixed(2)}
                    fill="transparent"
                    style={{ cursor: "crosshair" }}
                    onMouseEnter={() => setHoveredCandle(i)}
                    onMouseLeave={() => setHoveredCandle(null)}
                  />
                </g>
              );
            })}
          </g>

          {/* ── Hover crosshair & tooltip ─────────────────────────────── */}
          {hoveredCandle !== null &&
            (() => {
              const i = hoveredCandle;
              const cx = scaleX(i);
              const c = close[i];
              const o = open[i];
              const isUp = c >= o;
              const closeY = scaleY(c);
              const candleColor = isUp ? BULL.ohlcColor : BEAR.ohlcColor;

              // Tooltip position
              const tipW = 92;
              const tipH = 76;
              let tipX = cx + 14;
              let tipY = scaleY(high[i]) - 10;
              if (tipX + tipW > plotX + plotW) tipX = cx - tipW - 10;
              if (tipY < plotY) tipY = plotY + 4;
              if (tipY + tipH > plotY + plotH) tipY = plotY + plotH - tipH - 4;

              return (
                <g style={{ pointerEvents: "none" }}>
                  {/* Vertical crosshair */}
                  <line
                    className="fp-candle-crosshair"
                    x1={cx}
                    y1={plotY}
                    x2={cx}
                    y2={plotY + plotH}
                    stroke={colors.crosshair}
                    strokeWidth={0.5}
                    strokeDasharray="3 2"
                  />
                  {/* Horizontal crosshair at close */}
                  <line
                    x1={plotX}
                    y1={closeY}
                    x2={plotX + plotW}
                    y2={closeY}
                    stroke={candleColor}
                    strokeWidth={0.5}
                    strokeDasharray="3 2"
                    opacity={0.4}
                  />
                  {/* Close dot */}
                  <circle cx={cx} cy={closeY} r={2.5} fill={candleColor} opacity={0.8} />

                  {/* Tooltip box */}
                  <g transform={`translate(${tipX.toFixed(1)},${tipY.toFixed(1)})`}>
                    <rect
                      width={tipW}
                      height={tipH}
                      rx={4}
                      fill={colors.tooltipBg}
                      stroke={colors.tooltipBorder}
                      strokeWidth={0.5}
                    />
                    <text x={8} y={14} fontSize={8} fill={colors.tooltipHeader} fontWeight={600}>
                      {labels?.[i] ?? `#${i}`}
                    </text>
                    <line x1={8} y1={19} x2={tipW - 8} y2={19} stroke={colors.tooltipBorder} strokeWidth={0.3} />
                    <text x={8} y={32} fontSize={8} fill={colors.tooltipText}>
                      O{" "}
                      <tspan fill={candleColor} fontWeight={600}>
                        {fmtPrice(open[i])}
                      </tspan>
                    </text>
                    <text x={8} y={44} fontSize={8} fill={colors.tooltipText}>
                      H{" "}
                      <tspan fill={candleColor} fontWeight={600}>
                        {fmtPrice(high[i])}
                      </tspan>
                    </text>
                    <text x={8} y={56} fontSize={8} fill={colors.tooltipText}>
                      L{" "}
                      <tspan fill={candleColor} fontWeight={600}>
                        {fmtPrice(low[i])}
                      </tspan>
                    </text>
                    <text x={8} y={68} fontSize={8} fill={colors.tooltipText}>
                      C{" "}
                      <tspan fill={candleColor} fontWeight={600}>
                        {fmtPrice(close[i])}
                      </tspan>
                    </text>
                  </g>
                </g>
              );
            })()}

          {/* ── Current price badge (right side) ─────────────────────── */}
          {(() => {
            const y = scaleY(lastClose);
            if (y < plotY - 10 || y > plotY + plotH + 10) return null;
            const bgColor = lastIsUp ? BULL.ohlcColor : BEAR.ohlcColor;
            return (
              <g
                style={
                  visible
                    ? ({ animation: "fp-candleFadeIn 0.5s ease 1.5s both" } as React.CSSProperties)
                    : { opacity: 0 }
                }
              >
                {/* Price line */}
                <line
                  x1={plotX}
                  y1={y}
                  x2={plotX + plotW}
                  y2={y}
                  stroke={bgColor}
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                  opacity={0.35}
                />
                {/* Badge background */}
                <rect x={plotX + plotW + 2} y={y - 9} width={57} height={18} fill={bgColor} rx={1} />
                {/* Badge text */}
                <text
                  x={plotX + plotW + 6}
                  y={y + 4}
                  fontSize={11}
                  fontFamily="var(--font-instrument-serif), 'Instrument Serif', serif"
                  fill="#ffffff"
                  fontWeight={400}
                >
                  {fmtPrice(lastClose)}
                </text>
              </g>
            );
          })()}

          {/* ── Left edge fade ────────────────────────────────────────── */}
          {!isNaked && (
            <rect
              x={plotX}
              y={plotY}
              width={15}
              height={plotH}
              fill="url(#candle-fade-l)"
              style={{ pointerEvents: "none" }}
            />
          )}

          {/* ── Legend (bullish/bearish) ──────────────────────────────── */}
          {showLegend && (
            <g
              style={
                visible
                  ? ({ animation: "fp-candleFadeIn 0.5s ease 1.5s both" } as React.CSSProperties)
                  : { opacity: 0 }
              }
            >
              {/* Bullish swatch */}
              <rect
                x={plotX + plotW / 2 - 55}
                y={plotY + plotH + 26}
                width={8}
                height={8}
                rx={1.5}
                fill="#8CE97E"
              />
              <text
                x={plotX + plotW / 2 - 43}
                y={plotY + plotH + 33}
                fontSize={8}
                fontFamily="'Inter', sans-serif"
                fill={isLight ? "#666" : "#707073"}
              >
                Bullish
              </text>
              {/* Bearish swatch */}
              <rect
                x={plotX + plotW / 2 + 8}
                y={plotY + plotH + 26}
                width={8}
                height={8}
                rx={1.5}
                fill="#FF4948"
              />
              <text
                x={plotX + plotW / 2 + 20}
                y={plotY + plotH + 33}
                fontSize={8}
                fontFamily="'Inter', sans-serif"
                fill={isLight ? "#666" : "#707073"}
              >
                Bearish
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
