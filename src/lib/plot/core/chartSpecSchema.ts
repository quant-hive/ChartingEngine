// ── ChartSpec JSON Validator ─────────────────────────────────────────────
// Single source of truth for ChartSpec schema validation.
//
// Usage:
//   import { validateChartSpec } from "@/lib/plot";
//   const result = validateChartSpec(rawJson);
//   if (!result.ok) {
//     result.errors.forEach(e => console.error(`${e.path}: ${e.message}`));
//   } else {
//     renderChart(result.spec); // guaranteed valid
//   }

import { z } from "zod";
import type { ChartSpec } from "./renderChart";

// ── Shared constants ────────────────────────────────────────────────────

export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const CHART_TYPES = [
  "line", "bar", "stacked_bar", "scatter", "bubble", "area",
  "histogram", "pie", "donut", "surface", "surface_3d",
  "candlestick", "bokeh", "heatmap", "waterfall", "violin", "boxplot",
] as const;

// ── Public types ────────────────────────────────────────────────────────

export interface ValidationError {
  /** Dot/bracket path to the offending field, e.g. "series[0].data" */
  path: string;
  /** Human-readable description of the problem */
  message: string;
}

export type ValidationResult =
  | { ok: true;  spec: ChartSpec }
  | { ok: false; errors: ValidationError[] };

// ── Sub-schemas ─────────────────────────────────────────────────────────

const hexColor = z
  .string()
  .regex(HEX_COLOR_REGEX, "must be a hex color (#rgb or #rrggbb)");

const SeriesSpecSchema = z.object({
  // data is optional at the field level; presence/non-emptiness is enforced
  // in superRefine based on chart type (boxplot allows pre-computed stats instead)
  data:         z.array(z.number().nullable()).optional(),
  x:            z.array(z.number()).optional(),
  label:        z.string().optional(),
  color:        hexColor.optional(),
  lineWidth:    z.number().positive().optional(),
  lineStyle:    z.enum(["solid", "dashed", "dotted", "dashdot"]).optional(),
  fillOpacity:  z.number().min(0).max(1, "must be between 0 and 1").optional(),
  barWidth:     z.number().positive().optional(),
  stacked:      z.boolean().optional(),
  markerSize:   z.number().positive().optional(),
  sizes:        z.array(z.number()).optional(),
  // Candlestick OHLC
  open:         z.array(z.number()).optional(),
  high:         z.array(z.number()).optional(),
  low:          z.array(z.number()).optional(),
  close:        z.array(z.number()).optional(),
  // Boxplot pre-computed stats
  q1:           z.number().optional(),
  median:       z.number().optional(),
  q3:           z.number().optional(),
  whiskerLow:   z.number().optional(),
  whiskerHigh:  z.number().optional(),
  outliers:     z.array(z.number()).optional(),
});

const PieSliceSpecSchema = z.object({
  value: z.number(),
  label: z.string(),
  color: hexColor.optional(),
});

const SurfaceSpecSchema = z.object({
  z:         z.array(z.array(z.number())).min(1, "must be a non-empty 2D array"),
  x:         z.array(z.array(z.number())).optional(),
  y:         z.array(z.array(z.number())).optional(),
  color:     hexColor.optional(),
  wireframe: z.boolean().optional(),
  azimuth:   z.number().optional(),
  elevation: z.number().optional(),
});

const HeatmapSpecSchema = z.object({
  data:       z.array(z.array(z.number())).min(1, "must be a non-empty 2D array"),
  rowLabels:  z.array(z.string()).optional(),
  colLabels:  z.array(z.string()).optional(),
  colorRange: z.array(hexColor).min(2).max(3, "must have 2 or 3 colors").optional(),
});

const AxisSpecSchema = z.object({
  label:      z.string().optional(),
  min:        z.number().optional(),
  max:        z.number().optional(),
  scale:      z.enum(["linear", "log", "symlog"]).optional(),
  ticks:      z.array(z.number()).optional(),
  tickLabels: z.array(z.string()).optional(),
});

// ── Base schema (field-level checks only) ───────────────────────────────

const BaseChartSpecSchema = z.object({
  type:       z.enum(CHART_TYPES),
  title:      z.string().optional(),
  subtitle:   z.string().optional(),
  series:     z.array(SeriesSpecSchema).optional(),
  slices:     z.array(PieSliceSpecSchema).optional(),
  donutRatio: z.number().min(0).max(1, "must be between 0 and 1").optional(),
  surface:    SurfaceSpecSchema.optional(),
  heatmap:    HeatmapSpecSchema.optional(),
  bins:       z.number().int().positive("must be a positive integer").optional(),
  xLabels:    z.array(z.string()).optional(),
  xAxis:      AxisSpecSchema.optional(),
  yAxis:      AxisSpecSchema.optional(),
  legend:     z.object({
    show:     z.boolean().optional(),
    position: z.enum(["best", "upper-left", "upper-right", "lower-left", "lower-right"]).optional(),
  }).optional(),
  grid:   z.boolean().optional(),
  width:  z.number().positive("must be a positive number").optional(),
  height: z.number().positive("must be a positive number").optional(),
  hlines: z.array(z.object({
    y:         z.number(),
    color:     hexColor.optional(),
    label:     z.string().optional(),
    lineStyle: z.enum(["solid", "dashed", "dotted", "dashdot"]).optional(),
  })).optional(),
  vlines: z.array(z.object({
    x:         z.number(),
    color:     hexColor.optional(),
    label:     z.string().optional(),
    lineStyle: z.enum(["solid", "dashed", "dotted", "dashdot"]).optional(),
  })).optional(),
  annotations: z.array(z.object({
    text:  z.string(),
    x:     z.number(),
    y:     z.number(),
    color: hexColor.optional(),
  })).optional(),
  edgeDistribution: z.object({
    position:    z.enum(["right"]),
    values:      z.array(z.number()).min(1, "must have at least one bin value"),
    binEdges:    z.array(z.number()).min(2, "must have at least 2 bin edges"),
    color:       hexColor.optional(),
    opacity:     z.number().min(0).max(1).optional(),
    annotations: z.array(z.object({
      y:     z.number(),
      label: z.string(),
      color: hexColor.optional(),
    })).optional(),
  }).optional(),
});

// ── ChartSpec schema with cross-field refinements ────────────────────────

export const ChartSpecSchema = BaseChartSpecSchema.superRefine((spec, ctx) => {
  const addIssue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom" as const, path, message });

  switch (spec.type) {
    // ── Pie / Donut: require non-empty slices ──
    case "pie":
    case "donut":
      if (!spec.slices || spec.slices.length === 0)
        addIssue(["slices"], `required and must be non-empty for type "${spec.type}"`);
      break;

    // ── Surface / 3D: require surface.z ──
    case "surface":
    case "surface_3d":
      if (!spec.surface?.z || spec.surface.z.length === 0)
        addIssue(["surface", "z"], `required and must be a non-empty 2D array for type "${spec.type}"`);
      break;

    // ── Heatmap: require heatmap.data ──
    case "heatmap":
      if (!spec.heatmap?.data || spec.heatmap.data.length === 0)
        addIssue(["heatmap", "data"], `required and must be a non-empty 2D array for type "heatmap"`);
      break;

    // ── Candlestick / Bokeh: require OHLC arrays in series[0] ──
    case "candlestick":
    case "bokeh": {
      const s0 = spec.series?.[0];
      if (!s0) { addIssue(["series"], "must have at least one series for candlestick"); break; }
      if (!s0.open  || s0.open.length  === 0) addIssue(["series", 0, "open"],  "required and must be non-empty for candlestick");
      if (!s0.high  || s0.high.length  === 0) addIssue(["series", 0, "high"],  "required and must be non-empty for candlestick");
      if (!s0.low   || s0.low.length   === 0) addIssue(["series", 0, "low"],   "required and must be non-empty for candlestick");
      break;
    }

    // ── Boxplot: require series; data is optional when pre-computed stats are given ──
    case "boxplot": {
      if (!spec.series || spec.series.length === 0) {
        addIssue(["series"], `required and must be non-empty for type "boxplot"`);
        break;
      }
      spec.series.forEach((s, i) => {
        const hasPrecomputed = s.q1 != null && s.median != null && s.q3 != null;
        if (!hasPrecomputed && (!s.data || s.data.length === 0))
          addIssue(["series", i, "data"],
            "must be a non-empty number array, or provide pre-computed q1/median/q3 stats");
      });
      break;
    }

    // ── All other types: require non-empty series with non-empty data ──
    default: {
      if (!spec.series || spec.series.length === 0) {
        addIssue(["series"], `required and must be non-empty for type "${spec.type}"`);
        break;
      }
      spec.series.forEach((s, i) => {
        if (!s.data || s.data.length === 0)
          addIssue(["series", i, "data"], "must be a non-empty number array");
      });
      break;
    }
  }

  // ── Bubble: sizes array length must match data length ──
  if (spec.type === "bubble") {
    spec.series?.forEach((s, i) => {
      if (s.sizes && s.data && s.sizes.length !== s.data.length)
        addIssue(["series", i, "sizes"],
          `length (${s.sizes.length}) must match data.length (${s.data.length})`);
    });
  }
});

// ── validateChartSpec ────────────────────────────────────────────────────

/**
 * Validates raw (unknown) input against the ChartSpec schema.
 * Returns `{ ok: true, spec }` on success, or `{ ok: false, errors }` with
 * structured field-level error messages on failure.
 *
 * @example
 * const result = validateChartSpec(JSON.parse(userInput));
 * if (!result.ok) {
 *   result.errors.forEach(e => console.error(`${e.path}: ${e.message}`));
 * }
 */
export function validateChartSpec(raw: unknown): ValidationResult {
  const result = ChartSpecSchema.safeParse(raw);

  if (result.success) {
    return { ok: true, spec: result.data as ChartSpec };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path
      .map((p) => (typeof p === "number" ? `[${p}]` : p))
      .join(".")
      .replace(/\.\[/g, "["),  // "series.[0].data" → "series[0].data"
    message: issue.message,
  }));

  return { ok: false, errors };
}
