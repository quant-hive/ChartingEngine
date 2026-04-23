import type { TickMark, ScaleType } from "./types";

// ── Nice Number Algorithm ───────────────────────────────────────────────
// Produces "nice" round numbers for axis ticks (matches matplotlib behavior).

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

// ── Axis Tick Computation ───────────────────────────────────────────────

export interface AxisTicks {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

export function computeLinearTicks(
  dataMin: number,
  dataMax: number,
  targetTicks = 5
): AxisTicks {
  if (dataMin === dataMax) {
    dataMin -= 1;
    dataMax += 1;
  }
  const range = niceNum(dataMax - dataMin, false);
  const step = niceNum(range / (targetTicks - 1), true);
  const min = Math.floor(dataMin / step) * step;
  const max = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step * 0.001; v += step) {
    ticks.push(parseFloat(v.toFixed(10)));
  }
  return { min, max, step, ticks };
}

export function computeLogTicks(
  dataMin: number,
  dataMax: number,
  _targetTicks = 5
): AxisTicks {
  const logMin = Math.floor(Math.log10(Math.max(dataMin, 1e-10)));
  const logMax = Math.ceil(Math.log10(Math.max(dataMax, 1e-10)));
  const ticks: number[] = [];
  for (let e = logMin; e <= logMax; e++) {
    ticks.push(Math.pow(10, e));
  }
  return {
    min: Math.pow(10, logMin),
    max: Math.pow(10, logMax),
    step: 0,
    ticks,
  };
}

export function computeTicks(
  scaleType: ScaleType,
  dataMin: number,
  dataMax: number,
  targetTicks = 5
): AxisTicks {
  switch (scaleType) {
    case "log":
      return computeLogTicks(dataMin, dataMax, targetTicks);
    case "symlog":
      // Symmetric log: linear near zero, log away from zero
      return computeLinearTicks(dataMin, dataMax, targetTicks);
    default:
      return computeLinearTicks(dataMin, dataMax, targetTicks);
  }
}

// ── Scale Functions (data → pixel) ──────────────────────────────────────

export function linearScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): number {
  if (domainMax === domainMin) return rangeMin;
  return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

export function logScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): number {
  const logVal = Math.log10(Math.max(value, 1e-10));
  const logMin = Math.log10(Math.max(domainMin, 1e-10));
  const logMax = Math.log10(Math.max(domainMax, 1e-10));
  return linearScale(logVal, logMin, logMax, rangeMin, rangeMax);
}

export function scaleValue(
  scaleType: ScaleType,
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): number {
  switch (scaleType) {
    case "log":
      return logScale(value, domainMin, domainMax, rangeMin, rangeMax);
    default:
      return linearScale(value, domainMin, domainMax, rangeMin, rangeMax);
  }
}

// ── X Label Downsampling ────────────────────────────────────────────────

export function pickLabels(labels: string[], maxLabels = 8): string[] {
  if (labels.length <= maxLabels) return labels;
  const step = (labels.length - 1) / (maxLabels - 1);
  const picked: string[] = [];
  for (let i = 0; i < maxLabels; i++) {
    picked.push(labels[Math.round(i * step)]);
  }
  return picked;
}

// ── Generate tick marks with pixel positions ────────────────────────────

export function generateTickMarks(
  ticks: number[],
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
  scaleType: ScaleType = "linear",
  format?: (value: number) => string
): TickMark[] {
  const fmt = format ?? ((v: number) => String(v));
  return ticks.map((value) => ({
    value,
    label: fmt(value),
    position: scaleValue(scaleType, value, domainMin, domainMax, rangeMin, rangeMax),
  }));
}
