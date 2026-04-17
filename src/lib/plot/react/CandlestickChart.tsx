"use client";

/**
 * CandlestickChart — TradingView-inspired.
 * Features: gradient candles · volume histogram · SMA/EMA lines ·
 * crosshair w/ axis labels · chart-type toggle (candle/line/area) ·
 * current-price level line · live/forming-candle animation (border-first,
 * fill bottom→top) · zoom (ctrl+wheel) · smooth hidden-scrollbar scroll.
 */

import React, { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CandlestickData {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume?: number[];
  labels?: string[];
  ticker?: string;
  interval?: string;
}

export interface MALine { type: "SMA" | "EMA"; period: number; color?: string; }

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
  indicators?: MALine[];
  showVolume?: boolean;
  formingIndex?: number;
  defaultChartType?: "candle" | "line" | "area";
}

// ── Color constants ──────────────────────────────────────────────────────────

const BEAR = {
  wick:      [{ offset:"0%",color:"#D24445"},{offset:"36%",color:"#FFDCA3"},{offset:"77%",color:"#D96058"},{offset:"100%",color:"#E57B77"}],
  body:      [{ offset:"0%",color:"rgba(241,148,107,0.9)"},{offset:"100%",color:"#FF4948"}],
  highlight: [{ offset:"0%",color:"#FFF4B8"},{offset:"100%",color:"rgba(255,244,184,0)"}],
  ohlcColor: "#E0484C", solid: "#FF4948",
};

const BULL = {
  wick:      [{offset:"0%",color:"#ADE2B4"},{offset:"19%",color:"#A5D5A1"},{offset:"60%",color:"#88CB86"},{offset:"100%",color:"#A0B7AF"}],
  body:      [{offset:"0%",color:"#8CE97E"},{offset:"100%",color:"#317430"}],
  highlight: [{offset:"0%",color:"#B9F7B6"},{offset:"100%",color:"rgba(185,247,182,0)"}],
  ohlcColor: "#4ECDC4", solid: "#4ECDC4",
};

const DEFAULT_TIMEFRAMES = ["5y", "1y", "3m", "1m", "5d", "1d"];
const DEFAULT_INDICATORS: MALine[] = [
  { type: "EMA", period: 9,  color: "#6C9EFF" },
  { type: "SMA", period: 20, color: "#F9CA24" },
];

// ── CSS ──────────────────────────────────────────────────────────────────────

const CANDLE_CSS = `
@keyframes fp-cGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes fp-cFade{from{opacity:0}to{opacity:1}}
@keyframes fp-cGlow{0%{opacity:0;filter:brightness(1)}50%{opacity:1;filter:brightness(1.3)}100%{opacity:1;filter:brightness(1)}}
@keyframes fp-cGrid{from{stroke-dashoffset:var(--l)}to{stroke-dashoffset:0}}
@keyframes fp-cLblY{from{opacity:0;transform:translateX(4px)}to{opacity:1;transform:translateX(0)}}
@keyframes fp-cLblX{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes fp-cOutline{from{opacity:0}to{opacity:1}}
@keyframes fp-cFillUp{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes fp-cLivePulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:0;transform:scale(1.07)}}
@keyframes fp-cPriceDash{from{stroke-dashoffset:800}to{stroke-dashoffset:0}}
.fp-candle-scroll::-webkit-scrollbar{display:none}
.fp-candle-scroll{-ms-overflow-style:none;scrollbar-width:none}
.fp-candle-light text{fill:#333!important}
.fp-candle-light .cGrid{stroke:#e0e0e0!important}
.fp-candle-light .cSep{stroke:#ccc!important}
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function niceNum(v: number, round: boolean): number {
  if (v === 0) return 0;
  const e = Math.floor(Math.log10(Math.abs(v)));
  const f = v / 10 ** e;
  let n: number;
  if (round) { n = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; }
  else       { n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; }
  return n * 10 ** e;
}

function priceTicks(min: number, max: number, target = 8) {
  if (min === max) { min -= 1; max += 1; }
  const range = niceNum(max - min, false);
  const step  = niceNum(range / (target - 1), true);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, ticks };
}

function fmt(v: number): string {
  return Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4);
}

function utcStr(): string {
  const d = new Date(), off = -d.getTimezoneOffset(), s = off >= 0 ? "+" : "-";
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")} (UTC${s}${Math.floor(Math.abs(off)/60)})`;
}

function calcSMA(data: number[], period: number): (number | undefined)[] {
  return data.map((_, i) => {
    if (i < period - 1) return undefined;
    return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(data: number[], period: number): (number | undefined)[] {
  const k = 2 / (period + 1);
  const result: (number | undefined)[] = new Array(data.length).fill(undefined);
  if (data.length < period) return result;
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < data.length; i++) { ema = data[i] * k + ema * (1 - k); result[i] = ema; }
  return result;
}

// ── Calendar icon ────────────────────────────────────────────────────────────

function CalIcon({ c = "#707073", s = 11 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none" style={{ display:"inline-block", verticalAlign:"middle" }}>
      <rect x="1" y="3" width="12" height="10" rx="1.5" stroke={c} strokeWidth="1.2" fill="none" />
      <line x1="4"  y1="1"   x2="4"  y2="4.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="10" y1="1"   x2="10" y2="4.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="1"  y1="6.5" x2="13" y2="6.5" stroke={c} strokeWidth="1" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CandlestickChart({
  data,
  width: propW,
  height: containerH = 280,
  grid = true,
  theme = "dark",
  timeframes = DEFAULT_TIMEFRAMES,
  activeTimeframe: propTf,
  onTimeframeChange,
  indicators = DEFAULT_INDICATORS,
  showVolume = false,
  formingIndex,
  defaultChartType = "candle",
}: CandlestickChartProps) {
  const wrapRef      = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const touchDistRef = useRef<number>(0);
  const touchXRef    = useRef<number>(0);

  const [visible,    setVisible]    = useState(false);
  const [hovered,    setHovered]    = useState<number | null>(null);
  const [intTf,      setIntTf]      = useState("1m");
  const [utc,        setUtc]        = useState(utcStr);
  const [zoom,       setZoom]       = useState(1);
  const [measuredW,  setMeasuredW]  = useState(0);
  const [chartType,  setChartType]  = useState<"candle"|"line"|"area">(defaultChartType);
  const [crosshair,  setCrosshair]  = useState<{x:number; y:number; i:number} | null>(null);
  const [activeInds, setActiveInds] = useState<Set<string>>(
    () => new Set(indicators.map(m => `${m.type}${m.period}`))
  );

  // ── Measure width — sync on first paint, then track resizes ──────────────
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (el) setMeasuredW(el.getBoundingClientRect().width);
  }, []);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setMeasuredW(e.contentRect.width));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const containerW = propW ?? (measuredW > 0 ? measuredW : 0);
  const ready = containerW > 0;

  // ── Intersection observer ──────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 }
    );
    obs.observe(el); return () => obs.disconnect();
  }, []);

  // ── UTC clock ──────────────────────────────────────────────────────────────
  useEffect(() => { const id = setInterval(() => setUtc(utcStr()), 1000); return () => clearInterval(id); }, []);

  // ── Data ───────────────────────────────────────────────────────────────────
  const tf = propTf ?? intTf;
  const { open, high, low, close, volume, labels, ticker, interval } = data;
  const n = Math.min(open.length, high.length, low.length, close.length);
  const isLight = theme === "light";
  const isNaked = theme === "naked";

  // ── Layout — responsive to container width ────────────────────────────────
  const VOL_H    = 56;
  const Y_AXIS_W = containerW < 360 ? 58 : containerW < 520 ? 64 : 72;
  const yFontSz  = containerW < 360 ? 10 : containerW < 520 ? 11 : 12;
  const PAD      = { top: 8, bottom: containerW < 400 ? 18 : 22, left: 8 };
  const hasVol   = showVolume && !!volume && volume.length >= n;
  const mainH    = containerH - (hasVol ? VOL_H + 6 : 0);
  const plotH    = mainH - PAD.top - PAD.bottom;
  const chartW   = containerW - Y_AXIS_W;

  // ── Candle geometry ────────────────────────────────────────────────────────
  const BASE_SPACING = 42;
  const cSpacing = BASE_SPACING * zoom;
  const cW       = Math.max(3, Math.min(cSpacing * 0.45, 18 * zoom));
  const innerW   = Math.max(chartW, n * cSpacing + PAD.left * 2);

  // ── Price range ────────────────────────────────────────────────────────────
  const allHigh = useMemo(() => Math.max(...high.slice(0, n)), [high, n]);
  const allLow  = useMemo(() => Math.min(...low.slice(0, n)),  [low,  n]);
  const axis    = useMemo(() => priceTicks(allLow, allHigh, 8), [allLow, allHigh]);

  const scaleY = useCallback(
    (p: number) => PAD.top + plotH - ((p - axis.min) / (axis.max - axis.min || 1)) * plotH,
    [plotH, axis.min, axis.max]
  );
  const scaleX = useCallback((i: number) => PAD.left + cSpacing * (i + 0.5), [cSpacing]);

  // ── Volume scale ───────────────────────────────────────────────────────────
  const maxVol  = useMemo(() => volume ? Math.max(...volume.slice(0, n)) : 0, [volume, n]);
  const scaleVol = useCallback((v: number) => maxVol > 0 ? (v / maxVol) * (VOL_H - 10) : 0, [maxVol]);

  // ── MA lines ───────────────────────────────────────────────────────────────
  const maLines = useMemo(() => indicators.map(ind => ({
    ...ind,
    key: `${ind.type}${ind.period}`,
    values: ind.type === "EMA"
      ? calcEMA(close.slice(0, n), ind.period)
      : calcSMA(close.slice(0, n), ind.period),
  })), [indicators, close, n]);

  // ── Last candle ────────────────────────────────────────────────────────────
  const lastClose = close[n - 1];
  const lastOpen  = open[n - 1];
  const lastUp    = lastClose >= lastOpen;

  // ── OHLC display (hovered or crosshair or last) ────────────────────────────
  const idx  = hovered ?? crosshair?.i ?? n - 1;
  const hO = open[idx] ?? 0, hH = high[idx] ?? 0, hL = low[idx] ?? 0, hC = close[idx] ?? 0;
  const hUp = hC >= hO, hCol = hUp ? BULL.ohlcColor : BEAR.ohlcColor;

  // ── Theme ──────────────────────────────────────────────────────────────────
  const C = {
    bg:          isNaked ? "transparent" : isLight ? "#fafafa" : "#121318",
    grid:        isLight ? "#e8e8e8" : "#1e1e22",
    sep:         isLight ? "#d0d0d0" : "#2a2a2e",
    cross:       isLight ? "#aaa"    : "#484852",
    crossBg:     isLight ? "#333"    : "#e8e8e8",
    crossTxt:    isLight ? "#fff"    : "#111",
    yLbl:        isLight ? "#333"    : "#fff",
    xLbl:        isLight ? "#888"    : "#707073",
    ohlcBg:      isLight ? "#e8e8e8" : "#242424",
    ohlcLbl:     isLight ? "#333"    : "#fff",
    fade:        isLight ? "#fafafa" : "#121318",
    tfTxt:       isLight ? "#999"    : "#707073",
    tfAct:       isLight ? "#333"    : "#fff",
    utcTxt:      isLight ? "#999"    : "#707073",
    div:         isLight ? "#ccc"    : "#3a3a3e",
    btnActBg:    isLight ? "#d8d8d8" : "#2a2a36",
    btnActTxt:   isLight ? "#111"    : "#fff",
    volBull:     "rgba(76,205,196,0.28)",
    volBear:     "rgba(255,73,72,0.28)",
    tipBg:       isLight ? "#f5f5f5" : "#1a1a1e",
  };

  // ── Wheel ──────────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.min(4, Math.max(0.3, z - e.deltaY * 0.003)));
    } else if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
    }
  }, []);

  // ── Crosshair ──────────────────────────────────────────────────────────────
  const onMouseMoveSvg = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const rawI = Math.round((x - PAD.left - cSpacing * 0.5) / cSpacing);
    const i = Math.max(0, Math.min(n - 1, rawI));
    setCrosshair({ x, y, i });
    setHovered(i);
  }, [cSpacing, n]);

  const onMouseLeaveSvg = useCallback(() => { setCrosshair(null); setHovered(null); }, []);

  const toggleInd = useCallback((key: string) => {
    setActiveInds(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }, []);

  // ── Touch handlers (pinch-to-zoom + swipe-to-scroll) ──────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchDistRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else {
      touchXRef.current = e.touches[0].clientX;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchDistRef.current > 0) {
        const scale = dist / touchDistRef.current;
        setZoom(z => Math.min(4, Math.max(0.3, z * scale)));
      }
      touchDistRef.current = dist;
    } else if (e.touches.length === 1 && scrollRef.current) {
      const dx = touchXRef.current - e.touches[0].clientX;
      scrollRef.current.scrollLeft += dx;
      touchXRef.current = e.touches[0].clientX;
    }
  }, []);

  // ── Scroll to end ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el && innerW > chartW) el.scrollLeft = el.scrollWidth;
  }, [innerW, chartW, visible, formingIndex]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={isLight ? "fp-candle-light" : ""} style={{
      position:"relative", width:"100%", fontFamily:"'Inter',sans-serif",
      background: ready ? C.bg : "transparent", borderRadius: 4, overflow:"hidden",
      minHeight: ready ? undefined : containerH,
    }}>
      {!ready ? null : <><style>{CANDLE_CSS}</style>

      {/* OHLC pill — negative margin pulls it beside the external ChartHeader title */}
      <div style={{
        display:"inline-flex", alignItems:"center", gap:4,
        background: C.ohlcBg, borderRadius:3, padding:"3px 10px",
        fontSize:10, fontWeight:500, lineHeight:"18px",
        marginTop:-20, marginLeft:10,
        opacity: visible ? 1 : 0, transition:"opacity 0.5s ease 0.3s",
      }}>
        <span style={{color:C.ohlcLbl}}>O</span><span style={{color:hCol}}>{fmt(hO)}</span>
        <span style={{color:C.ohlcLbl,marginLeft:4}}>H</span><span style={{color:hCol}}>{fmt(hH)}</span>
        <span style={{color:C.ohlcLbl,marginLeft:4}}>L</span><span style={{color:hCol}}>{fmt(hL)}</span>
        <span style={{color:C.ohlcLbl,marginLeft:4}}>C</span><span style={{color:hCol}}>{fmt(hC)}</span>
      </div>

      {/* Chart area */}
      <div style={{ display:"flex", position:"relative", height:containerH }}>

        {/* Scrollable SVG */}
        <div ref={scrollRef} className="fp-candle-scroll" onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove}
          style={{ flex:1, overflowX:"auto", overflowY:"hidden", scrollBehavior:"smooth", position:"relative" }}
        >
          <svg width={innerW} height={containerH}
            style={{ display:"block", fontFamily:"'Inter',sans-serif" }}
            onMouseMove={onMouseMoveSvg} onMouseLeave={onMouseLeaveSvg}
          >
            <defs>
              {Array.from({ length: n }, (_, i) => {
                const s = close[i] >= open[i] ? BULL : BEAR, id = `c${i}`;
                return (
                  <React.Fragment key={id}>
                    <linearGradient id={`${id}-w`} x1="0" y1="0" x2="0" y2="1">{s.wick.map((g,j)=><stop key={j} offset={g.offset} stopColor={g.color}/>)}</linearGradient>
                    <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">{s.body.map((g,j)=><stop key={j} offset={g.offset} stopColor={g.color}/>)}</linearGradient>
                    <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">{s.highlight.map((g,j)=><stop key={j} offset={g.offset} stopColor={g.color}/>)}</linearGradient>
                  </React.Fragment>
                );
              })}
              <linearGradient id="cFadeL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={isNaked?"transparent":C.fade} stopOpacity={1}/>
                <stop offset="100%" stopColor={isNaked?"transparent":C.fade} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="cArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lastUp?BULL.solid:BEAR.solid} stopOpacity={0.35}/>
                <stop offset="100%" stopColor={lastUp?BULL.solid:BEAR.solid} stopOpacity={0}/>
              </linearGradient>
              <clipPath id="cClip"><rect x={0} y={PAD.top} width={innerW} height={plotH}/></clipPath>
              <filter id="cGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5"/>
              </filter>
            </defs>

            {/* Grid */}
            {grid && axis.ticks.map((p, i) => {
              const y = scaleY(p);
              if (y < PAD.top - 1 || y > PAD.top + plotH + 1) return null;
              return (
                <line key={`g${i}`} className="cGrid" x1={0} y1={y} x2={innerW} y2={y}
                  stroke={C.grid} strokeWidth={0.5}
                  style={visible ? {"--l":innerW,strokeDasharray:innerW,animation:`fp-cGrid 0.6s ease ${(i*0.04).toFixed(2)}s both`} as React.CSSProperties : {opacity:0}}
                />
              );
            })}

            {/* X-axis separator */}
            <line className="cSep" x1={0} y1={PAD.top+plotH} x2={innerW} y2={PAD.top+plotH}
              stroke={C.sep} strokeWidth={0.5}
              style={visible?{animation:"fp-cFade 0.5s ease 0.45s both"} as React.CSSProperties:{opacity:0}}
            />

            {/* X labels */}
            {labels && labels.slice(0, n).map((lbl, i) => {
              const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(innerW / (60 * zoom)))));
              if (i % step !== 0 && i !== n - 1) return null;
              return (
                <text key={`x${i}`} x={scaleX(i)} y={PAD.top+plotH+15} textAnchor="middle" fontSize={9} fontWeight={500} fill={C.xLbl}
                  style={visible?{animation:`fp-cLblX 0.35s ease ${(0.45+i*0.02).toFixed(2)}s both`} as React.CSSProperties:{opacity:0}}
                >{lbl}</text>
              );
            })}

            {/* MA lines */}
            <g clipPath="url(#cClip)">
              {maLines.filter(m => activeInds.has(m.key)).map(m => {
                const parts: string[] = []; let inLine = false;
                m.values.forEach((v, i) => {
                  if (v === undefined) { inLine = false; return; }
                  const x = scaleX(i).toFixed(1), y = scaleY(v).toFixed(1);
                  parts.push(inLine ? `L ${x} ${y}` : `M ${x} ${y}`); inLine = true;
                });
                return (
                  <path key={m.key} d={parts.join(" ")} stroke={m.color??"#F9CA24"} strokeWidth={1.2} fill="none" opacity={0.85}
                    style={visible?{animation:"fp-cFade 0.7s ease 1s both"} as React.CSSProperties:{opacity:0}}
                  />
                );
              })}
            </g>

            {/* Current price line */}
            <line x1={0} y1={scaleY(lastClose)} x2={innerW} y2={scaleY(lastClose)}
              stroke={lastUp?BULL.solid:BEAR.solid} strokeWidth={0.6} strokeDasharray="800"
              opacity={0.5}
              style={visible?{animation:"fp-cPriceDash 1.5s ease 1s both"} as React.CSSProperties:{opacity:0}}
            />

            {/* Candles / Line / Area */}
            <g clipPath="url(#cClip)">
              {/* Line + Area modes */}
              {chartType !== "candle" && (() => {
                const col = lastUp ? BULL.solid : BEAR.solid;
                const pts = close.slice(0,n).map((c,i) => `${scaleX(i).toFixed(1)} ${scaleY(c).toFixed(1)}`);
                const linePath = "M " + pts.join(" L ");
                const areaPath = linePath + ` L ${scaleX(n-1).toFixed(1)} ${(PAD.top+plotH).toFixed(1)} L ${scaleX(0).toFixed(1)} ${(PAD.top+plotH).toFixed(1)} Z`;
                return (
                  <>
                    {chartType === "area" && (
                      <path d={areaPath} fill="url(#cArea)"
                        style={visible?{animation:"fp-cFade 0.8s ease 0.5s both"} as React.CSSProperties:{opacity:0}}
                      />
                    )}
                    <path d={linePath} fill="none" stroke={col} strokeWidth={1.5}
                      style={visible?{animation:"fp-cFade 0.6s ease 0.3s both"} as React.CSSProperties:{opacity:0}}
                    />
                    {close.slice(0,n).map((c,i) => (
                      <circle key={i} cx={scaleX(i)} cy={scaleY(c)} r={2.5} fill={col} opacity={0.75}
                        onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
                      />
                    ))}
                  </>
                );
              })()}

              {/* Candle mode */}
              {chartType === "candle" && Array.from({length:n}, (_,i) => {
                const o=open[i], hi=high[i], lo=low[i], c=close[i];
                const up   = c >= o;
                const bTop = up ? c : o, bBot = up ? o : c;
                const cx   = scaleX(i);
                const wTY  = scaleY(hi), wBY = scaleY(lo);
                const bTY  = scaleY(bTop), bBY = scaleY(bBot);
                const bH   = Math.max(1, bBY - bTY);
                const wH   = Math.max(0.5, wBY - wTY);
                const wW   = Math.max(1, 1.2 * zoom);
                const id   = `c${i}`;
                const midY = bTY + bH / 2;
                const origin    = `${cx.toFixed(1)}px ${midY.toFixed(1)}px`;
                const botOrigin = `${cx.toFixed(1)}px ${(bTY+bH).toFixed(1)}px`;
                const isH       = hovered === i;
                const isForming = formingIndex !== undefined && i === formingIndex;
                const delay     = 0.7 + i * 0.03;
                const strokeCol = up ? BULL.solid : BEAR.solid;

                if (isForming) {
                  return (
                    <g key={`forming-${formingIndex}`}>
                      {/* Wick */}
                      <rect x={cx-wW/2} y={wTY} width={wW} height={wH} fill={`url(#${id}-w)`} rx={0.6}
                        style={{animation:"fp-cOutline 0.2s ease forwards"} as React.CSSProperties}
                      />
                      {/* Border outline — appears first */}
                      <rect x={cx-cW/2} y={bTY} width={cW} height={bH} fill="none" stroke={strokeCol} strokeWidth={1.2} rx={0.8}
                        style={{animation:"fp-cOutline 0.25s ease forwards"} as React.CSSProperties}
                      />
                      {/* Fill grows from bottom to top */}
                      <rect x={cx-cW/2} y={bTY} width={cW} height={bH} fill={`url(#${id}-b)`} rx={0.8}
                        style={{transformOrigin:botOrigin, animation:"fp-cFillUp 0.45s cubic-bezier(.22,1,.36,1) 0.2s forwards"} as React.CSSProperties}
                      />
                      {/* Highlight */}
                      <rect x={cx-cW/2} y={bTY} width={cW} height={Math.max(1,bH*0.08)} fill={`url(#${id}-h)`} rx={0.5}
                        style={{animation:"fp-cFade 0.2s ease 0.6s forwards"} as React.CSSProperties}
                      />
                      {/* Pulsing ring — live indicator */}
                      <rect x={cx-cW/2-2} y={bTY-2} width={cW+4} height={bH+4} fill="none" stroke={strokeCol} strokeWidth={0.8} rx={2}
                        style={{transformOrigin:`${cx}px ${midY}px`, animation:"fp-cLivePulse 1.6s ease-in-out infinite"} as React.CSSProperties}
                      />
                      {/* Hit area */}
                      <rect x={cx-cSpacing/2} y={PAD.top} width={cSpacing} height={plotH} fill="transparent" style={{cursor:"crosshair"}}
                        onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
                      />
                    </g>
                  );
                }

                const hlH = Math.max(1, bH * 0.08);
                return (
                  <g key={i}>
                    <rect x={cx-wW/2} y={wTY} width={wW} height={wH} fill={`url(#${id}-w)`} rx={0.6}
                      style={visible?{transformOrigin:origin,animation:`fp-cGrow 0.45s cubic-bezier(.22,1,.36,1) ${(delay+0.12).toFixed(2)}s both`} as React.CSSProperties:{transform:"scaleY(0)",transformOrigin:origin} as React.CSSProperties}
                    />
                    <rect x={cx-cW/2} y={bTY} width={cW} height={bH} fill={`url(#${id}-b)`} rx={0.8}
                      style={visible?{transformOrigin:origin,animation:`fp-cGrow 0.55s cubic-bezier(.22,1,.36,1) ${delay.toFixed(2)}s both`} as React.CSSProperties:{transform:"scaleY(0)",transformOrigin:origin} as React.CSSProperties}
                    />
                    <rect x={cx-cW/2-1} y={bTY-1} width={cW+2} height={bH+2} fill={`url(#${id}-b)`} rx={1} opacity={0.25} filter="url(#cGlow)"
                      style={visible?{animation:`fp-cGlow 0.7s ease ${(delay+0.35).toFixed(2)}s both`} as React.CSSProperties:{opacity:0}}
                    />
                    <rect x={cx-cW/2} y={bTY} width={cW} height={hlH} fill={`url(#${id}-h)`} rx={0.5}
                      style={visible?{animation:`fp-cGlow 0.8s ease ${(delay+0.4).toFixed(2)}s both`} as React.CSSProperties:{opacity:0}}
                    />
                    {isH && <rect x={cx-cW/2-.5} y={bTY-.5} width={cW+1} height={bH+1} fill={`url(#${id}-b)`} rx={1} opacity={0.3} filter="url(#cGlow)"/>}
                    <rect x={cx-cSpacing/2} y={PAD.top} width={cSpacing} height={plotH} fill="transparent" style={{cursor:"crosshair"}}
                      onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}
                    />
                  </g>
                );
              })}
            </g>

            {/* Volume bars */}
            {hasVol && (
              <g>
                <line x1={0} y1={mainH+3} x2={innerW} y2={mainH+3} stroke={C.sep} strokeWidth={0.5}/>
                {Array.from({length:n}, (_,i) => {
                  const v = volume![i] ?? 0;
                  const bH = scaleVol(v);
                  const up = close[i] >= open[i];
                  const cx = scaleX(i);
                  const bW = Math.max(2, cW * 0.8);
                  const top = mainH + 3 + (VOL_H - 10 - bH);
                  return (
                    <rect key={`v${i}`} x={cx-bW/2} y={top} width={bW} height={bH}
                      fill={up ? C.volBull : C.volBear} rx={0.8}
                      style={visible?{transformOrigin:`${cx.toFixed(1)}px ${(mainH+3+VOL_H-10).toFixed(1)}px`,animation:`fp-cGrow 0.4s ease ${(1.2+i*0.008).toFixed(3)}s both`} as React.CSSProperties:{transform:"scaleY(0)"}}
                    />
                  );
                })}
              </g>
            )}

            {/* Crosshair lines */}
            {crosshair && (
              <g style={{pointerEvents:"none"}}>
                <line x1={scaleX(crosshair.i)} y1={PAD.top} x2={scaleX(crosshair.i)} y2={PAD.top+plotH}
                  stroke={C.cross} strokeWidth={0.5} strokeDasharray="3 2"
                />
                <line x1={0} y1={crosshair.y} x2={innerW} y2={crosshair.y}
                  stroke={C.cross} strokeWidth={0.5} strokeDasharray="3 2"
                />
                {labels && (
                  <g>
                    <rect x={scaleX(crosshair.i)-22} y={PAD.top+plotH+1} width={44} height={15} fill={C.crossBg} rx={2}/>
                    <text x={scaleX(crosshair.i)} y={PAD.top+plotH+11.5} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={C.crossTxt}>
                      {labels[crosshair.i] ?? ""}
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* Hover tooltip */}
            {hovered !== null && (() => {
              const cx  = scaleX(hovered);
              const cY  = scaleY(close[hovered]);
              const up  = close[hovered] >= open[hovered];
              const col = up ? BULL.ohlcColor : BEAR.ohlcColor;
              const tipW = 92, tipH = 76;
              let tx = cx + 14, ty = scaleY(high[hovered]) - 10;
              if (tx + tipW > innerW - 10) tx = cx - tipW - 10;
              if (ty < PAD.top) ty = PAD.top + 4;
              if (ty + tipH > PAD.top + plotH) ty = PAD.top + plotH - tipH - 4;
              return (
                <g style={{pointerEvents:"none"}}>
                  <circle cx={cx} cy={cY} r={2.5} fill={col} opacity={0.85}/>
                  <g transform={`translate(${tx},${ty})`}>
                    <rect width={tipW} height={tipH} rx={4} fill={C.tipBg} stroke={C.sep} strokeWidth={0.5}/>
                    <text x={8} y={14} fontSize={8} fill={C.xLbl} fontWeight={600}>{labels?.[hovered] ?? `#${hovered}`}</text>
                    <line x1={8} y1={19} x2={tipW-8} y2={19} stroke={C.sep} strokeWidth={0.3}/>
                    <text x={8} y={32} fontSize={8} fill={C.xLbl}>O <tspan fill={col} fontWeight={600}>{fmt(open[hovered])}</tspan></text>
                    <text x={8} y={44} fontSize={8} fill={C.xLbl}>H <tspan fill={col} fontWeight={600}>{fmt(high[hovered])}</tspan></text>
                    <text x={8} y={56} fontSize={8} fill={C.xLbl}>L <tspan fill={col} fontWeight={600}>{fmt(low[hovered])}</tspan></text>
                    <text x={8} y={68} fontSize={8} fill={C.xLbl}>C <tspan fill={col} fontWeight={600}>{fmt(close[hovered])}</tspan></text>
                  </g>
                </g>
              );
            })()}

            {/* Left fade */}
            {!isNaked && <rect x={0} y={PAD.top} width={18} height={plotH} fill="url(#cFadeL)" style={{pointerEvents:"none"}}/>}
          </svg>
        </div>

        {/* Fixed y-axis */}
        <div style={{ width:Y_AXIS_W, flexShrink:0, position:"relative", height:containerH }}>
          <svg width={Y_AXIS_W} height={containerH} style={{display:"block"}}>

            {/* Crosshair horizontal continuation */}
            {crosshair && (
              <line x1={0} y1={crosshair.y} x2={Y_AXIS_W} y2={crosshair.y}
                stroke={C.cross} strokeWidth={0.5} strokeDasharray="3 2"
              />
            )}

            {/* Y tick labels */}
            {axis.ticks.map((p, i) => {
              const y = scaleY(p);
              if (y < PAD.top - 6 || y > PAD.top + plotH + 6) return null;
              return (
                <text key={`yt${i}`} x={6} y={y+4} fontSize={yFontSz}
                  fontFamily="var(--font-instrument-serif),'Instrument Serif',serif"
                  fill={C.yLbl}
                  style={visible?{animation:`fp-cLblY 0.35s ease ${(0.45+i*0.03).toFixed(2)}s both`} as React.CSSProperties:{opacity:0}}
                >{fmt(p)}</text>
              );
            })}

            {/* Crosshair price label */}
            {crosshair && crosshair.y >= PAD.top && crosshair.y <= PAD.top + plotH && (() => {
              const price = axis.min + ((PAD.top + plotH - crosshair.y) / plotH) * (axis.max - axis.min);
              return (
                <g>
                  <rect x={1} y={crosshair.y-9} width={Y_AXIS_W-2} height={18} fill={C.crossBg} rx={2}/>
                  <text x={Y_AXIS_W/2} y={crosshair.y+4.5} textAnchor="middle" fontSize={yFontSz - 1} fontWeight={600}
                    fontFamily="var(--font-instrument-serif),'Instrument Serif',serif" fill={C.crossTxt}
                  >{fmt(price)}</text>
                </g>
              );
            })()}

            {/* Price badges */}
            {(() => {
              const col = lastUp ? BULL.ohlcColor : BEAR.ohlcColor;
              let cY = scaleY(lastClose), oY = scaleY(lastOpen);
              if (Math.abs(cY - oY) < 20) { const m = (cY+oY)/2; cY = m-10; oY = m+10; }
              return [{price:lastClose,y:cY},{price:lastOpen,y:oY}].map((b,i) => {
                if (b.y < PAD.top-10 || b.y > PAD.top+plotH+10) return null;
                return (
                  <g key={i} style={visible?{animation:"fp-cFade 0.5s ease 1.5s both"} as React.CSSProperties:{opacity:0}}>
                    <rect x={2} y={b.y-10} width={Y_AXIS_W-4} height={20} fill={col} rx={2}/>
                    <text x={6} y={b.y+4} fontSize={yFontSz}
                      fontFamily="var(--font-instrument-serif),'Instrument Serif',serif"
                      fill="#fff" fontWeight={400}
                    >{fmt(b.price)}</text>
                  </g>
                );
              });
            })()}
          </svg>
        </div>
      </div>

      {/* Bottom bar — collapses gracefully on small screens */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding: containerW < 400 ? "4px 8px 6px" : "5px 10px 7px",
        opacity: visible ? 1 : 0, transition:"opacity 0.5s ease 1.2s",
        flexWrap: "wrap", gap: 4,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap: containerW < 400 ? 3 : 5, flexWrap:"wrap" }}>
          {/* Timeframes — hide on very small screens */}
          {containerW >= 320 && timeframes.map(t => (
            <button key={t} onClick={() => onTimeframeChange ? onTimeframeChange(t) : setIntTf(t)} style={{
              background:"none", border:"none", padding:"1px 2px", cursor:"pointer",
              fontSize: containerW < 400 ? 9 : 10, fontWeight:500, fontFamily:"'Inter',sans-serif",
              color: t===tf ? C.tfAct : C.tfTxt, transition:"color 0.2s ease",
            }}>{t}</button>
          ))}
          {containerW >= 360 && <CalIcon c={C.tfTxt} s={11}/>}
          <span style={{width:1,height:11,borderLeft:`1px solid ${C.div}`,display:"inline-block",margin:"0 2px"}}/>
          {/* Chart type */}
          {(["candle","line","area"] as const).map(ct => (
            <button key={ct} onClick={() => setChartType(ct)} style={{
              background: chartType===ct ? C.btnActBg : "none",
              border:"none", padding:"1px 5px", cursor:"pointer", borderRadius:3,
              fontSize: containerW < 400 ? 9 : 10, fontWeight:500, fontFamily:"'Inter',sans-serif",
              color: chartType===ct ? C.btnActTxt : C.tfTxt,
              transition:"background 0.15s ease, color 0.15s ease",
            }}>{ct[0].toUpperCase()+ct.slice(1)}</button>
          ))}
          {/* MA toggles — hide on very small screens */}
          {containerW >= 480 && <>
            <span style={{width:1,height:11,borderLeft:`1px solid ${C.div}`,display:"inline-block",margin:"0 2px"}}/>
            {maLines.map(m => (
              <button key={m.key} onClick={() => toggleInd(m.key)} style={{
                border:`1px solid ${activeInds.has(m.key) ? (m.color??C.div) : C.div}`,
                background: activeInds.has(m.key) ? `${m.color??"#888"}22` : "none",
                padding:"0 4px", borderRadius:3, cursor:"pointer",
                fontSize:9, fontWeight:500, fontFamily:"'Inter',sans-serif",
                color: activeInds.has(m.key) ? (m.color??C.tfTxt) : C.tfTxt,
                transition:"all 0.15s ease",
              }}>{m.type} {m.period}</button>
            ))}
          </>}
        </div>
        {containerW >= 280 && <span style={{color:C.utcTxt, fontSize: containerW < 400 ? 9 : 10, fontWeight:500}}>{utc}</span>}
      </div>
    </>}
    </div>
  );
}
