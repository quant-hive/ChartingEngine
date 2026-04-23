"use client";

import React, { useRef, useEffect, useState } from "react";

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export interface PieChartProps {
  data: PieSlice[];
  size?: number;
  donut?: boolean;
  donutRatio?: number;
  className?: string;
  showLegend?: boolean;
  lightTheme?: boolean;
  animate?: boolean;
}

const DEFAULT_SIZE = 240;
const ANIM_DURATION = 900;
const ANIM_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function pieSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export default function PieChart({
  data,
  size = DEFAULT_SIZE,
  donut = false,
  donutRatio = 0.55,
  className,
  showLegend = true,
  lightTheme = false,
  animate = true,
}: PieChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(!animate);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!animate) return;
    requestAnimationFrame(() => setVisible(true));
  }, [animate]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * donutRatio;
  const gap = 0.02; // radians gap between slices

  // Compute slices
  const slices: {
    startAngle: number;
    endAngle: number;
    midAngle: number;
    pct: number;
    slice: PieSlice;
    index: number;
  }[] = [];

  let angle = -Math.PI / 2; // start from top
  for (let i = 0; i < data.length; i++) {
    const pct = data[i].value / total;
    const sweep = pct * Math.PI * 2;
    const sliceGap = data.length > 1 ? gap / 2 : 0;
    const startAngle = angle + sliceGap;
    const endAngle = angle + sweep - sliceGap;
    const midAngle = angle + sweep / 2;
    slices.push({ startAngle, endAngle, midAngle, pct, slice: data[i], index: i });
    angle += sweep;
  }

  // Layout: pie on left, legend on right, spanning full width (595 to match FlashChart)
  const totalW = 595;
  const padV = 20; // vertical padding top & bottom
  const totalH = size + padV * 2;
  const piePadL = 16;
  const legendW = 150;
  const legendPadR = 16;
  const legendX = totalW - legendPadR - legendW;
  const legendStartY = (padV + cy) - (data.length * 22) / 2;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={`w-full h-auto block ${className ?? ""}`}
    >
      <defs>
        {slices.map((s, i) => (
          <radialGradient
            key={`grad-${i}`}
            id={`pieGrad-${i}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop offset="0%" stopColor={s.slice.color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={s.slice.color} stopOpacity={1} />
          </radialGradient>
        ))}
        <filter id="pieShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Slices — offset by left padding + vertical padding */}
      <g filter="url(#pieShadow)" transform={`translate(${piePadL}, ${padV})`}>
        {slices.map((s, i) => {
          const isHovered = hoverIdx === i;
          const path = donut
            ? donutSlicePath(cx, cy, outerR, innerR, s.startAngle, s.endAngle)
            : pieSlicePath(cx, cy, outerR, s.startAngle, s.endAngle);

          // Slight explode on hover
          const explodeR = isHovered ? 4 : 0;
          const tx = explodeR * Math.cos(s.midAngle);
          const ty = explodeR * Math.sin(s.midAngle);

          return (
            <path
              key={i}
              d={path}
              fill={`url(#pieGrad-${i})`}
              stroke={lightTheme ? "#fafafa" : "#121212"}
              strokeWidth={1.5}
              transform={`translate(${tx}, ${ty})`}
              opacity={visible ? (hoverIdx !== null && !isHovered ? 0.5 : 1) : 0}
              style={{
                transition: `opacity ${ANIM_DURATION}ms ${ANIM_EASING} ${i * 80}ms, transform 0.2s ease`,
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}
      </g>

      {/* Center label for donut */}
      {donut && (
        <text
          x={cx + piePadL}
          y={cy + padV}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={11}
          fontFamily="var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif"
          fontWeight={500}
          opacity={visible ? 1 : 0}
          style={{ transition: `opacity 0.6s ease 0.4s` }}
        >
          {hoverIdx !== null ? `${(slices[hoverIdx].pct * 100).toFixed(1)}%` : "Total"}
        </text>
      )}

      {/* Percentage labels on slices (non-donut only, for large enough slices) */}
      {!donut &&
        slices.map((s, i) => {
          if (s.pct < 0.06) return null;
          const labelR = outerR * 0.65;
          const pos = polarToCartesian(cx, cy, labelR, s.midAngle);
          return (
            <text
              key={`lbl-${i}`}
              x={pos.x + piePadL}
              y={pos.y + padV}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#121212"
              fontSize={10}
              fontFamily="var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif"
              fontWeight={600}
              opacity={visible ? 1 : 0}
              style={{
                transition: `opacity 0.5s ease ${300 + i * 80}ms`,
                pointerEvents: "none",
              }}
            >
              {(s.pct * 100).toFixed(0)}%
            </text>
          );
        })}

      {/* Legend */}
      {showLegend && data.map((d, i) => {
        const y = legendStartY + i * 22;
        const isHovered = hoverIdx === i;
        return (
          <g
            key={`leg-${i}`}
            opacity={visible ? (hoverIdx !== null && !isHovered ? 0.4 : 1) : 0}
            style={{
              transition: `opacity 0.4s ease ${200 + i * 60}ms`,
              cursor: "pointer",
            }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <rect
              x={legendX}
              y={y}
              width={10}
              height={10}
              rx={2}
              fill={d.color}
            />
            <text
              x={legendX + 16}
              y={y + 5}
              dominantBaseline="central"
              fill="#8f8f8f"
              fontSize={11}
              fontFamily="var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif"
              fontWeight={isHovered ? 500 : 400}
              style={{ transition: "font-weight 0.2s" }}
            >
              {d.label}
            </text>
            <text
              x={legendX + 130}
              y={y + 5}
              textAnchor="end"
              dominantBaseline="central"
              fill={isHovered ? "#ffffff" : "#555555"}
              fontSize={11}
              fontFamily="var(--font-eb-garamond), 'EB Garamond', 'Times New Roman', Georgia, serif"
              fontWeight={500}
              style={{ transition: "fill 0.2s" }}
            >
              {(d.value / total * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
