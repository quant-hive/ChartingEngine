import type { Padding, Rect } from "./types";

// ── Default Layout Constants ────────────────────────────────────────────

export const DEFAULT_WIDTH = 595;
export const DEFAULT_HEIGHT = 260;
export const DEFAULT_PADDING: Padding = { top: 4, right: 16, bottom: 28, left: 32 };
export const DEFAULT_INSET = 16;

// ── Layout Computation ──────────────────────────────────────────────────

export interface Layout {
  width: number;
  height: number;
  padding: Padding;
  inset: number;
  plotArea: Rect;
}

export function computeLayout(
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  padding = DEFAULT_PADDING,
  inset = DEFAULT_INSET
): Layout {
  const plotArea: Rect = {
    x: padding.left + inset,
    y: padding.top + inset,
    w: width - padding.left - padding.right - inset * 2,
    h: height - padding.top - padding.bottom - inset * 2,
  };
  return { width, height, padding, inset, plotArea };
}

// ── Subplot Grid Layout ─────────────────────────────────────────────────

export function computeSubplotBounds(
  nrows: number,
  ncols: number,
  figWidth: number,
  figHeight: number,
  hspace = 0.05,
  wspace = 0.05
): Rect[][] {
  const cellW = figWidth / ncols;
  const cellH = figHeight / nrows;
  const gapW = cellW * wspace;
  const gapH = cellH * hspace;

  const grid: Rect[][] = [];
  for (let r = 0; r < nrows; r++) {
    grid[r] = [];
    for (let c = 0; c < ncols; c++) {
      grid[r][c] = {
        x: c * cellW + gapW / 2,
        y: r * cellH + gapH / 2,
        w: cellW - gapW,
        h: cellH - gapH,
      };
    }
  }
  return grid;
}
