"use client";

/**
 * CandlestickChart — Figma frame 332:34.
 *
 * Features: gradient candles, OHLC pill, ticker badge, timeframe selector,
 * calendar icon, UTC clock, price badges, zoom (ctrl+wheel / pinch),
 * smooth horizontal scroll (wheel / drag), hidden scrollbar.
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────

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
  timeframes?: string[];
  activeTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
}

// ── Figma color constants ───────────────────────────────────────────────

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

const DEFAULT_TIMEFRAMES = ["5y", "1y", "3m", "1m", "5d", "1d"];

// ── CSS ─────────────────────────────────────────────────────────────────

const CANDLE_CSS = `
@keyframes fp-cGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes fp-cFade{from{opacity:0}to{opacity:1}}
@keyframes fp-cGlow{0%{opacity:0;filter:brightness(1)}50%{opacity:1;filter:brightness(1.3)}100%{opacity:1;filter:brightness(1)}}
@keyframes fp-cGrid{from{stroke-dashoffset:var(--l)}to{stroke-dashoffset:0}}
@keyframes fp-cLblY{from{opacity:0;transform:translateX(4px)}to{opacity:1;transform:translateX(0)}}
@keyframes fp-cLblX{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.fp-candle-scroll::-webkit-scrollbar{display:none}
.fp-candle-scroll{-ms-overflow-style:none;scrollbar-width:none}
.fp-candle-light text{fill:#333!important}
.fp-candle-light .cGrid{stroke:#e0e0e0!important}
.fp-candle-light .cSep{stroke:#ccc!important}
`;

// ── Helpers ─────────────────────────────────────────────────────────────

function niceNum(v: number, round: boolean): number {
  if (v === 0) return 0;
  const e = Math.floor(Math.log10(Math.abs(v)));
  const f = v / 10 ** e;
  let n: number;
  if (round) { n = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; }
  else { n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; }
  return n * 10 ** e;
}

function priceTicks(min: number, max: number, target = 8) {
  if (min === max) { min -= 1; max += 1; }
  const range = niceNum(max - min, false);
  const step = niceNum(range / (target - 1), true);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, step, ticks };
}

function fmt(v: number): string {
  return Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4);
}

function utcStr(): string {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const s = off >= 0 ? "+" : "-";
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")} (UTC${s}${Math.floor(Math.abs(off) / 60)})`;
}

// ── Calendar icon ───────────────────────────────────────────────────────

function CalIcon({ c = "#707073", s = 11 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <rect x="1" y="3" width="12" height="10" rx="1.5" stroke={c} strokeWidth="1.2" fill="none" />
      <line x1="4" y1="1" x2="4" y2="4.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="10" y1="1" x2="10" y2="4.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="1" y1="6.5" x2="13" y2="6.5" stroke={c} strokeWidth="1" />
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────

export default function CandlestickChart({
  data,
  width: propW,
  height: containerH = 260,
  grid = true,
  showLegend = true,
  theme = "dark",
  timeframes = DEFAULT_TIMEFRAMES,
  activeTimeframe: propTf,
  onTimeframeChange,
}: CandlestickChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [intTf, setIntTf] = useState("1m");
  const [utc, setUtc] = useState(utcStr);
  const [zoom, setZoom] = useState(1);
  const [measuredW, setMeasuredW] = useState(0);

  // ── Measure container width ─────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMeasuredW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const containerW = propW ?? (measuredW > 0 ? measuredW : 800);

  const tf = propTf ?? intTf;
  const { open, high, low, close, labels, ticker, interval } = data;
  const n = Math.min(open.length, high.length, low.length, close.length);

  const isLight = theme === "light";
  const isNaked = theme === "naked";

  // ── Intersection observer ─────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── UTC clock ─────────────────────────────────────────────────────
  useEffect(() => { const id = setInterval(() => setUtc(utcStr()), 1000); return () => clearInterval(id); }, []);

  // ── Layout constants ──────────────────────────────────────────────
  const Y_AXIS_W = 65; // right y-axis width (fixed)
  const PLOT_PAD = { top: 6, bottom: 22, left: 10 };
  const chartW = containerW - Y_AXIS_W; // scrollable area width
  const plotH = containerH - PLOT_PAD.top - PLOT_PAD.bottom;

  // ── Candle geometry (zoom-aware) ──────────────────────────────────
  const BASE_SPACING = 42;
  const candleSpacing = BASE_SPACING * zoom;
  const candleW = Math.max(3, Math.min(candleSpacing * 0.45, 18 * zoom));
  const innerW = Math.max(chartW, n * candleSpacing + PLOT_PAD.left * 2);

  // ── Price range ───────────────────────────────────────────────────
  const allHigh = useMemo(() => Math.max(...high.slice(0, n)), [high, n]);
  const allLow = useMemo(() => Math.min(...low.slice(0, n)), [low, n]);
  const axis = useMemo(() => priceTicks(allLow, allHigh, 8), [allLow, allHigh]);

  const scaleY = useCallback(
    (p: number) => PLOT_PAD.top + plotH - ((p - axis.min) / (axis.max - axis.min || 1)) * plotH,
    [plotH, axis.min, axis.max],
  );
  const scaleX = useCallback(
    (i: number) => PLOT_PAD.left + candleSpacing * (i + 0.5),
    [candleSpacing],
  );

  // ── Last candle ───────────────────────────────────────────────────
  const lastClose = close[n - 1];
  const lastOpen = open[n - 1];
  const lastUp = lastClose >= lastOpen;

  // ── Hovered candle ────────────────────────────────────────────────
  const hi2 = hovered ?? n - 1;
  const hO = open[hi2], hH = high[hi2], hL = low[hi2], hC = close[hi2];
  const hUp = hC >= hO;
  const hCol = hUp ? BULL.ohlcColor : BEAR.ohlcColor;

  // ── Theme colors ──────────────────────────────────────────────────
  const C = {
    bg: isNaked ? "transparent" : isLight ? "#fafafa" : "#121318",
    grid: isLight ? "#e8e8e8" : "#1e1e22",
    sep: isLight ? "#d0d0d0" : "#2a2a2e",
    cross: isLight ? "#bbb" : "#3a3a3e",
    yLbl: isLight ? "#333" : "#fff",
    xLbl: isLight ? "#888" : "#707073",
    ohlcBg: isLight ? "#e8e8e8" : "#242424",
    ohlcLbl: isLight ? "#333" : "#fff",
    ticker: isLight ? "#666" : "#909092",
    tipBg: isLight ? "#f5f5f5" : "#1a1a1e",
    tipBrd: isLight ? "#ddd" : "#2a2a2e",
    tipTxt: isLight ? "#555" : "#aaa",
    tipHdr: isLight ? "#999" : "#808080",
    fade: isLight ? "#fafafa" : "#121318",
    tfTxt: isLight ? "#999" : "#707073",
    tfAct: isLight ? "#333" : "#fff",
    utcTxt: isLight ? "#999" : "#707073",
    div: isLight ? "#ccc" : "#3a3a3e",
  };

  // ── Zoom handler (ctrl+wheel / pinch) ─────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(4, Math.max(0.3, z - e.deltaY * 0.003)));
    } else {
      // Horizontal scroll
      if (scrollRef.current) {
        e.preventDefault();
        scrollRef.current.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
      }
    }
  }, []);

  // Scroll to end on mount (show latest candles)
  useEffect(() => {
    if (scrollRef.current && innerW > chartW) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [innerW, chartW, visible]);

  const themeClass = isLight ? "fp-candle-light" : "";

  return (
    <div
      ref={wrapRef}
      className={themeClass}
      style={{
        position: "relative",
        width: "100%",
        fontFamily: "'Inter', sans-serif",
        background: C.bg,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <style>{CANDLE_CSS}</style>

      {/* ── Row 1: OHLC pill (left) + Ticker|Interval (right) ──────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px 4px", opacity: visible ? 1 : 0, transition: "opacity 0.5s ease 0.3s",
      }}>
        <div className="fp-candle-ohlc-bg" style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: C.ohlcBg, borderRadius: 2, padding: "2px 8px",
          fontSize: 9, fontWeight: 500, lineHeight: "18px",
        }}>
          <span style={{ color: C.ohlcLbl }}>O</span>
          <span style={{ color: hCol }}>{fmt(hO)}</span>
          <span style={{ color: C.ohlcLbl, marginLeft: 4 }}>H</span>
          <span style={{ color: hCol }}>{fmt(hH)}</span>
          <span style={{ color: C.ohlcLbl, marginLeft: 4 }}>L</span>
          <span style={{ color: hCol }}>{fmt(hL)}</span>
          <span style={{ color: C.ohlcLbl, marginLeft: 4 }}>C</span>
          <span style={{ color: hCol }}>{fmt(hC)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9 }}>
          {ticker && <span style={{ color: C.ticker }}>{ticker}</span>}
          {interval && ticker && <span style={{ color: "#3a3a3e" }}>|</span>}
          {interval && <span style={{ color: C.ticker }}>{interval}</span>}
        </div>
      </div>

      {/* ── Chart area: scrollable candles (left) + fixed y-axis (right) ── */}
      <div style={{ display: "flex", position: "relative", height: containerH }}>

        {/* Scrollable candle area */}
        <div
          ref={scrollRef}
          className="fp-candle-scroll"
          onWheel={onWheel}
          style={{
            flex: 1, overflowX: "auto", overflowY: "hidden",
            scrollBehavior: "smooth", position: "relative",
          }}
        >
          <svg
            width={innerW}
            height={containerH}
            style={{ display: "block", fontFamily: "'Inter', sans-serif" }}
          >
            <defs>
              {Array.from({ length: n }, (_, i) => {
                const up = close[i] >= open[i];
                const s = up ? BULL : BEAR;
                const id = `c${i}`;
                return (
                  <React.Fragment key={id}>
                    <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1">
                      {s.wick.map((g, j) => <stop key={j} offset={g.offset} stopColor={g.color} />)}
                    </linearGradient>
                    <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
                      {s.body.map((g, j) => <stop key={j} offset={g.offset} stopColor={g.color} />)}
                    </linearGradient>
                    <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">
                      {s.highlight.map((g, j) => <stop key={j} offset={g.offset} stopColor={g.color} />)}
                    </linearGradient>
                  </React.Fragment>
                );
              })}
              <linearGradient id="cFadeL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={isNaked ? "transparent" : C.fade} stopOpacity={1} />
                <stop offset="100%" stopColor={isNaked ? "transparent" : C.fade} stopOpacity={0} />
              </linearGradient>
              <clipPath id="cClip">
                <rect x={0} y={PLOT_PAD.top} width={innerW} height={plotH} />
              </clipPath>
              <filter id="cGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
              </filter>
            </defs>

            {/* Grid lines */}
            {grid && axis.ticks.map((p, i) => {
              const y = scaleY(p);
              if (y < PLOT_PAD.top - 1 || y > PLOT_PAD.top + plotH + 1) return null;
              return (
                <line key={`g${i}`} className="cGrid" x1={0} y1={y} x2={innerW} y2={y}
                  stroke={C.grid} strokeWidth={0.5}
                  style={visible ? { "--l": innerW, strokeDasharray: innerW, animation: `fp-cGrid 0.6s ease ${(i * 0.04).toFixed(2)}s both` } as React.CSSProperties : { opacity: 0 }}
                />
              );
            })}

            {/* X-axis separator */}
            <line className="cSep" x1={0} y1={PLOT_PAD.top + plotH} x2={innerW} y2={PLOT_PAD.top + plotH}
              stroke={C.sep} strokeWidth={0.5}
              style={visible ? { animation: "fp-cFade 0.5s ease 0.45s both" } as React.CSSProperties : { opacity: 0 }}
            />

            {/* X-axis labels */}
            {labels && labels.slice(0, n).map((lbl, i) => {
              const maxLbls = Math.max(3, Math.floor(innerW / (60 * zoom)));
              const step = Math.max(1, Math.ceil(n / maxLbls));
              if (i % step !== 0 && i !== n - 1) return null;
              return (
                <text key={`x${i}`} x={scaleX(i)} y={PLOT_PAD.top + plotH + 15} textAnchor="middle"
                  fontSize={9} fontWeight={500} fill={C.xLbl}
                  style={visible ? { animation: `fp-cLblX 0.35s ease ${(0.45 + i * 0.02).toFixed(2)}s both` } as React.CSSProperties : { opacity: 0 }}
                >{lbl}</text>
              );
            })}

            {/* Candles */}
            <g clipPath="url(#cClip)">
              {Array.from({ length: n }, (_, i) => {
                const o = open[i], hi = high[i], lo = low[i], c = close[i];
                const up = c >= o;
                const bTop = up ? c : o, bBot = up ? o : c;
                const cx = scaleX(i);
                const wTY = scaleY(hi), wBY = scaleY(lo);
                const bTY = scaleY(bTop), bBY = scaleY(bBot);
                const bH = Math.max(1, bBY - bTY);
                const wH = Math.max(0.5, wBY - wTY);
                const delay = 0.7 + i * 0.03;
                const wW = Math.max(1, 1.2 * zoom);
                const id = `c${i}`;
                const ctrY = bTY + bH / 2;
                const origin = `${cx.toFixed(1)}px ${ctrY.toFixed(1)}px`;
                const hlH = Math.max(1, bH * 0.08);
                const isH = hovered === i;

                return (
                  <g key={i}>
                    {/* Wick */}
                    <rect x={cx - wW / 2} y={wTY} width={wW} height={wH} fill={`url(#${id}-w)`} rx={0.6}
                      style={visible ? { transformOrigin: origin, animation: `fp-cGrow 0.45s cubic-bezier(.22,1,.36,1) ${(delay + 0.12).toFixed(2)}s both` } as React.CSSProperties : { transform: "scaleY(0)", transformOrigin: origin } as React.CSSProperties}
                    />
                    {/* Body */}
                    <rect x={cx - candleW / 2} y={bTY} width={candleW} height={bH} fill={`url(#${id}-b)`} rx={0.8}
                      style={visible ? { transformOrigin: origin, animation: `fp-cGrow 0.55s cubic-bezier(.22,1,.36,1) ${delay.toFixed(2)}s both` } as React.CSSProperties : { transform: "scaleY(0)", transformOrigin: origin } as React.CSSProperties}
                    />
                    {/* Glow */}
                    <rect x={cx - candleW / 2 - 1} y={bTY - 1} width={candleW + 2} height={bH + 2} fill={`url(#${id}-b)`} rx={1} opacity={0.25} filter="url(#cGlow)"
                      style={visible ? { animation: `fp-cGlow 0.7s ease ${(delay + 0.35).toFixed(2)}s both` } as React.CSSProperties : { opacity: 0 }}
                    />
                    {/* Highlight */}
                    <rect x={cx - candleW / 2} y={bTY} width={candleW} height={hlH} fill={`url(#${id}-h)`} rx={0.5}
                      style={visible ? { animation: `fp-cGlow 0.8s ease ${(delay + 0.4).toFixed(2)}s both` } as React.CSSProperties : { opacity: 0 }}
                    />
                    {/* Hover glow */}
                    {isH && <rect x={cx - candleW / 2 - 0.5} y={bTY - 0.5} width={candleW + 1} height={bH + 1} fill={`url(#${id}-b)`} rx={1} opacity={0.3} filter="url(#cGlow)" />}
                    {/* Hit area */}
                    <rect x={cx - candleSpacing / 2} y={PLOT_PAD.top} width={candleSpacing} height={plotH} fill="transparent" style={{ cursor: "crosshair" }}
                      onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                    />
                  </g>
                );
              })}
            </g>

            {/* Hover crosshair */}
            {hovered !== null && (() => {
              const cx = scaleX(hovered);
              const cY = scaleY(close[hovered]);
              const up = close[hovered] >= open[hovered];
              const col = up ? BULL.ohlcColor : BEAR.ohlcColor;
              const tipW = 92, tipH = 76;
              let tx = cx + 14, ty = scaleY(high[hovered]) - 10;
              if (tx + tipW > innerW - 10) tx = cx - tipW - 10;
              if (ty < PLOT_PAD.top) ty = PLOT_PAD.top + 4;
              if (ty + tipH > PLOT_PAD.top + plotH) ty = PLOT_PAD.top + plotH - tipH - 4;

              return (
                <g style={{ pointerEvents: "none" }}>
                  <line x1={cx} y1={PLOT_PAD.top} x2={cx} y2={PLOT_PAD.top + plotH} stroke={C.cross} strokeWidth={0.5} strokeDasharray="3 2" />
                  <line x1={0} y1={cY} x2={innerW} y2={cY} stroke={col} strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
                  <circle cx={cx} cy={cY} r={2.5} fill={col} opacity={0.8} />
                  <g transform={`translate(${tx},${ty})`}>
                    <rect width={tipW} height={tipH} rx={4} fill={C.tipBg} stroke={C.tipBrd} strokeWidth={0.5} />
                    <text x={8} y={14} fontSize={8} fill={C.tipHdr} fontWeight={600}>{labels?.[hovered] ?? `#${hovered}`}</text>
                    <line x1={8} y1={19} x2={tipW - 8} y2={19} stroke={C.tipBrd} strokeWidth={0.3} />
                    <text x={8} y={32} fontSize={8} fill={C.tipTxt}>O <tspan fill={col} fontWeight={600}>{fmt(open[hovered])}</tspan></text>
                    <text x={8} y={44} fontSize={8} fill={C.tipTxt}>H <tspan fill={col} fontWeight={600}>{fmt(high[hovered])}</tspan></text>
                    <text x={8} y={56} fontSize={8} fill={C.tipTxt}>L <tspan fill={col} fontWeight={600}>{fmt(low[hovered])}</tspan></text>
                    <text x={8} y={68} fontSize={8} fill={C.tipTxt}>C <tspan fill={col} fontWeight={600}>{fmt(close[hovered])}</tspan></text>
                  </g>
                </g>
              );
            })()}

            {/* Left fade */}
            {!isNaked && <rect x={0} y={PLOT_PAD.top} width={18} height={plotH} fill="url(#cFadeL)" style={{ pointerEvents: "none" }} />}
          </svg>
        </div>

        {/* Fixed right y-axis + price badges */}
        <div style={{
          width: Y_AXIS_W, flexShrink: 0, position: "relative", height: containerH,
        }}>
          <svg width={Y_AXIS_W} height={containerH} style={{ display: "block" }}>
            {/* Y-axis tick labels */}
            {axis.ticks.map((p, i) => {
              const y = scaleY(p);
              if (y < PLOT_PAD.top - 6 || y > PLOT_PAD.top + plotH + 6) return null;
              return (
                <text key={`yt${i}`} x={8} y={y + 4} fontSize={11}
                  fontFamily="var(--font-instrument-serif), 'Instrument Serif', serif"
                  fill={C.yLbl}
                  style={visible ? { animation: `fp-cLblY 0.35s ease ${(0.45 + i * 0.03).toFixed(2)}s both` } as React.CSSProperties : { opacity: 0 }}
                >{fmt(p)}</text>
              );
            })}

            {/* Price badges — last candle open + close */}
            {(() => {
              const badgeCol = lastUp ? BULL.ohlcColor : BEAR.ohlcColor;
              let cY = scaleY(lastClose);
              let oY = scaleY(lastOpen);
              // Nudge apart if too close
              if (Math.abs(cY - oY) < 20) {
                const mid = (cY + oY) / 2;
                cY = mid - 10; oY = mid + 10;
              }
              const badges = [
                { price: lastClose, y: cY },
                { price: lastOpen, y: oY },
              ];
              return badges.map((b, i) => {
                if (b.y < PLOT_PAD.top - 10 || b.y > PLOT_PAD.top + plotH + 10) return null;
                return (
                  <g key={i} style={visible ? { animation: "fp-cFade 0.5s ease 1.5s both" } as React.CSSProperties : { opacity: 0 }}>
                    <rect x={2} y={b.y - 9} width={60} height={18} fill={badgeCol} rx={1} />
                    <text x={6} y={b.y + 4} fontSize={11}
                      fontFamily="var(--font-instrument-serif), 'Instrument Serif', serif"
                      fill="#fff" fontWeight={400}
                    >{fmt(b.price)}</text>
                  </g>
                );
              });
            })()}

            {/* Dashed price lines at badge levels */}
            {(() => {
              const badgeCol = lastUp ? BULL.ohlcColor : BEAR.ohlcColor;
              let cY = scaleY(lastClose);
              let oY = scaleY(lastOpen);
              if (Math.abs(cY - oY) < 20) { const mid = (cY + oY) / 2; cY = mid - 10; oY = mid + 10; }
              return [cY, oY].map((y, i) => (
                <line key={`pl${i}`} x1={0} y1={y} x2={0} y2={y} stroke={badgeCol} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.35}
                  style={visible ? { animation: "fp-cFade 0.5s ease 1.5s both" } as React.CSSProperties : { opacity: 0 }}
                />
              ));
            })()}
          </svg>
        </div>
      </div>

      {/* ── Bottom bar: Timeframe (left) + UTC time (right) ────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px 8px",
        opacity: visible ? 1 : 0, transition: "opacity 0.5s ease 1.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {timeframes.map((t) => (
            <button key={t} onClick={() => onTimeframeChange ? onTimeframeChange(t) : setIntTf(t)}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 10, fontWeight: 500, fontFamily: "'Inter', sans-serif",
                color: t === tf ? C.tfAct : C.tfTxt, lineHeight: "20px",
                transition: "color 0.2s ease",
              }}
            >{t}</button>
          ))}
          <span style={{ opacity: 0.7 }}><CalIcon c={C.tfTxt} s={12} /></span>
          <span style={{ display: "inline-block", width: 1, height: 12, borderLeft: `1px solid ${C.div}`, marginLeft: 2 }} />
        </div>
        <span style={{ color: C.utcTxt, fontSize: 10, fontWeight: 500 }}>{utc}</span>
      </div>
    </div>
  );
}
