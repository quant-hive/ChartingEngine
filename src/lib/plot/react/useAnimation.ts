"use client";

import { useEffect, useRef, useState } from "react";

// ── Animation Phase System ──────────────────────────────────────────────
// Phase 0: hidden
// Phase 1: grid lines draw in
// Phase 2: axis labels appear
// Phase 3: data elements (lines/bars) animate in

export type AnimPhase = 0 | 1 | 2 | 3;

export function useChartAnimation(xLabelCount: number, yTickCount: number, barCount?: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState<AnimPhase>(0);
  const [shimmerStep, setShimmerStep] = useState<number>(-1);
  const [sweepIndex, setSweepIndex] = useState<number>(-1);
  const shimmerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sweepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    requestAnimationFrame(() => {
      setPhase(1);
      timers.push(setTimeout(() => setPhase(2), 675));
      timers.push(setTimeout(() => setPhase(3), 1280));

      if (barCount && barCount > 0) {
        const sweepDelay = 1280 + 810 + barCount * 54;
        timers.push(setTimeout(() => {
          let step = 0;
          setSweepIndex(0);
          sweepTimerRef.current = setInterval(() => {
            step += 1;
            if (step >= barCount) {
              setSweepIndex(-1);
              if (sweepTimerRef.current) {
                clearInterval(sweepTimerRef.current);
                sweepTimerRef.current = null;
              }
            } else {
              setSweepIndex(step);
            }
          }, 120);
        }, sweepDelay));
      }

      timers.push(setTimeout(() => {
        const totalSteps = Math.max(xLabelCount, yTickCount) + 2;
        let step = 0;
        setShimmerStep(0);
        shimmerTimerRef.current = setInterval(() => {
          step += 1;
          if (step > totalSteps) {
            setShimmerStep(-1);
            if (shimmerTimerRef.current) {
              clearInterval(shimmerTimerRef.current);
              shimmerTimerRef.current = null;
            }
          } else {
            setShimmerStep(step);
          }
        }, 80);
      }, 2500));
    });
    return () => {
      timers.forEach(clearTimeout);
      if (shimmerTimerRef.current) clearInterval(shimmerTimerRef.current);
      if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ref, phase, shimmerStep, sweepIndex };
}

// ── Shimmer color helper ────────────────────────────────────────────────

export function shimmerFill(idx: number, step: number, baseColor = "#494949"): string {
  if (step < 0) return baseColor;
  const dist = Math.abs(idx - step);
  if (dist === 0) return "#c4c4c4";
  if (dist === 1) return "#787878";
  return baseColor;
}
