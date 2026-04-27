// ── Server-side SVG String Renderer ──────────────────────────────────────
// Converts a Scene graph to a static SVG string (no React, no DOM).
// Used by the /api/chart route for Colab / notebook consumption.

import type {
  Scene, SubplotScene, PlotElement,
  LinePlotElement, AreaPlotElement, BarPlotElement, ScatterPlotElement,
  HLinePlotElement, VLinePlotElement, TextPlotElement, AnnotationPlotElement,
  GridScene, LegendScene, Theme,
} from "../core/types";
import { getTheme } from "../core/theme";
import { dashArray } from "../core/paths";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderGrid(grid: GridScene): string {
  if (!grid.visible) return "";
  return grid.lines
    .map(
      (l) =>
        `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${l.color}" stroke-width="${l.width}"/>`
    )
    .join("\n");
}

function renderLine(el: LinePlotElement): string {
  const da = dashArray(el.lineStyle);
  return `<path d="${el.path}" fill="none" stroke="${el.color}" stroke-width="${el.lineWidth}" stroke-linejoin="round"${da ? ` stroke-dasharray="${da}"` : ""} opacity="${el.alpha}"/>`;
}

function renderArea(el: AreaPlotElement, gradientId: string): string {
  return `<path d="${el.path}" fill="url(#${gradientId})" opacity="${el.alpha}"/>`;
}

function renderBars(el: BarPlotElement, theme: Theme, plotId: string): string {
  const st = theme.bar.styles[el.seriesIndex % theme.bar.styles.length];
  const gradId = `sg-${plotId}-${el.seriesIndex}`;
  const lines: string[] = [];

  lines.push(`<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${st.gradTop}"/><stop offset="100%" stop-color="${st.gradBottom}"/></linearGradient></defs>`);

  for (const bar of el.bars) {
    // Base fill
    lines.push(`<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="${st.fill}"/>`);
    // Gradient overlay
    lines.push(`<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="url(#${gradId})" opacity="0.4"/>`);
  }
  return lines.join("\n");
}

function renderScatter(el: ScatterPlotElement): string {
  return el.points
    .map(
      (pt) =>
        `<circle cx="${pt.x}" cy="${pt.y}" r="${Math.sqrt(pt.size)}" fill="${pt.color ?? el.color}" opacity="${el.alpha}"/>`
    )
    .join("\n");
}

function renderHLine(el: HLinePlotElement): string {
  const da = dashArray(el.lineStyle);
  return `<line x1="${el.xMin}" y1="${el.y}" x2="${el.xMax}" y2="${el.y}" stroke="${el.color}" stroke-width="${el.lineWidth}"${da ? ` stroke-dasharray="${da}"` : ""}/>`;
}

function renderVLine(el: VLinePlotElement): string {
  const da = dashArray(el.lineStyle);
  return `<line x1="${el.x}" y1="${el.yMin}" x2="${el.x}" y2="${el.yMax}" stroke="${el.color}" stroke-width="${el.lineWidth}"${da ? ` stroke-dasharray="${da}"` : ""}/>`;
}

function renderText(el: TextPlotElement): string {
  return `<text x="${el.x}" y="${el.y}" text-anchor="${el.anchor}" font-size="${el.style.fontSize}" font-family="${esc(el.style.fontFamily)}" font-weight="${el.style.fontWeight}" fill="${el.style.color}"${el.rotation ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : ""}>${esc(el.content)}</text>`;
}

function renderAnnotation(el: AnnotationPlotElement): string {
  const parts: string[] = [];
  if (el.xytext) {
    parts.push(
      `<line x1="${el.xytext.x}" y1="${el.xytext.y}" x2="${el.xy.x}" y2="${el.xy.y}" stroke="${el.arrowColor ?? el.style.color}" stroke-width="${el.arrowWidth ?? 1}"/>`
    );
  }
  const tx = el.xytext?.x ?? el.xy.x;
  const ty = el.xytext?.y ?? el.xy.y;
  parts.push(
    `<text x="${tx}" y="${ty}" font-size="${el.style.fontSize}" font-family="${esc(el.style.fontFamily)}" fill="${el.style.color}">${esc(el.text)}</text>`
  );
  return `<g>${parts.join("")}</g>`;
}

function renderLegend(legend: LegendScene, plotArea: { x: number; y: number; w: number; h: number }): string {
  const gap = 16;
  // Estimate width per entry: swatch(14) + spacing(4) + ~5.5px per char
  const itemWidths = legend.entries.map(e => 14 + 4 + e.label.length * 5.5);
  const totalW = itemWidths.reduce((a, b) => a + b, 0) + gap * (legend.entries.length - 1);
  let curX = plotArea.x + (plotArea.w - totalW) / 2;
  const y = plotArea.y + plotArea.h + 58; // generous gap below x-axis labels

  return legend.entries
    .map((entry, i) => {
      const x = curX;
      curX += itemWidths[i] + gap;
      const swatch =
        entry.type === "bar"
          ? `<rect x="${x}" y="${y - 4}" width="10" height="10" rx="2" fill="${entry.color}"/>`
          : `<line x1="${x}" y1="${y}" x2="${x + 12}" y2="${y}" stroke="${entry.color}" stroke-width="1.5"/>`;
      return `${swatch}<text x="${x + 18}" y="${y + 4}" font-size="9" font-weight="500" font-family="'Inter', sans-serif" fill="#808080">${esc(entry.label)}</text>`;
    })
    .join("\n");
}

function renderEdgeDistribution(el: any): string {
  const parts: string[] = [];
  for (const bar of el.bars) {
    parts.push(`<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="${el.color}" opacity="${el.opacity}" rx="1"/>`);
  }
  for (const ann of el.annotations) {
    parts.push(`<line x1="${el.areaX - 4}" y1="${ann.y}" x2="${el.areaX + 16}" y2="${ann.y}" stroke="${ann.color}" stroke-width="0.8" stroke-dasharray="3 2"/>`);
    parts.push(`<text x="${el.areaX + el.areaWidth + 4}" y="${ann.y + 3}" font-size="8" font-weight="500" font-family="'Inter', sans-serif" fill="${ann.color}">${esc(ann.label)}</text>`);
  }
  return parts.join("\n");
}

function renderElement(el: PlotElement, theme: Theme, plotId: string, gradientId: string): string {
  switch (el.type) {
    case "line": return renderLine(el);
    case "area": return renderArea(el, gradientId);
    case "bar": return renderBars(el, theme, plotId);
    case "scatter": return renderScatter(el);
    case "hline": return renderHLine(el);
    case "vline": return renderVLine(el);
    case "text": return renderText(el);
    case "annotation": return renderAnnotation(el);
    case "edgeDistribution": return renderEdgeDistribution(el);
  }
}

function renderSubplot(subplot: SubplotScene, theme: Theme): string {
  const plotId = `sp-${subplot.row}-${subplot.col}`;
  const pa = subplot.plotArea;
  const gradientId = `areaGrad-${plotId}`;
  const parts: string[] = [];

  // Defs
  parts.push(`<defs>`);
  parts.push(`<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d4d4d4" stop-opacity="${theme.area.gradientOpacityTop}"/><stop offset="100%" stop-color="#1F1F1F" stop-opacity="${theme.area.gradientOpacityBottom}"/></linearGradient>`);
  parts.push(`</defs>`);

  // Title & Subtitle
  if (subplot.title && subplot.titleStyle) {
    const ts = subplot.titleStyle;
    parts.push(`<text x="${pa.x}" y="${ts.fontSize + 4}" font-size="${ts.fontSize}" font-weight="${ts.fontWeight}" font-family="${esc(ts.fontFamily)}" letter-spacing="${ts.letterSpacing ?? "0"}" fill="${ts.color}">${esc(subplot.title)}</text>`);
  }
  if (subplot.subtitle && subplot.subtitleStyle) {
    const ss = subplot.subtitleStyle;
    const yOff = (subplot.titleStyle ? subplot.titleStyle.fontSize + 4 : 0) + ss.fontSize + 6;
    parts.push(`<text x="${pa.x}" y="${yOff}" font-size="${ss.fontSize}" font-weight="${ss.fontWeight}" font-family="${esc(ss.fontFamily)}" letter-spacing="${ss.letterSpacing ?? "0"}" fill="${ss.color}">${esc(subplot.subtitle)}</text>`);
  }

  // Grid
  parts.push(renderGrid(subplot.grid));

  // Y-axis labels
  for (const tick of subplot.yAxis.ticks) {
    parts.push(`<text x="${pa.x - 4}" y="${tick.position + 3}" text-anchor="end" font-size="${subplot.yAxis.tickStyle.fontSize}" font-weight="${subplot.yAxis.tickStyle.fontWeight}" font-family="${esc(subplot.yAxis.tickStyle.fontFamily)}" fill="${subplot.yAxis.tickStyle.color}">${esc(tick.label)}</text>`);
  }

  // X-axis labels
  for (const tick of subplot.xAxis.ticks) {
    parts.push(`<text x="${tick.position}" y="${subplot.bounds.h - 4}" text-anchor="middle" font-size="${subplot.xAxis.tickStyle.fontSize}" font-weight="${subplot.xAxis.tickStyle.fontWeight}" font-family="${esc(subplot.xAxis.tickStyle.fontFamily)}" fill="${subplot.xAxis.tickStyle.color}">${esc(tick.label)}</text>`);
  }

  // Elements
  for (const el of subplot.elements) {
    parts.push(renderElement(el, theme, plotId, gradientId));
  }

  // Legend
  const hasLegend = !!subplot.legend;
  if (subplot.legend) {
    parts.push(renderLegend(subplot.legend, { x: pa.x, y: pa.y, w: pa.w, h: pa.h }));
  }

  const legendExtraH = hasLegend ? 50 : 0;
  const svgH = subplot.bounds.h + legendExtraH;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${subplot.bounds.w} ${svgH}" width="${subplot.bounds.w}" height="${svgH}" style="font-family:'Inter',sans-serif">\n${parts.join("\n")}\n</svg>`;
}

/** Render a full Scene to an SVG string (one SVG per subplot, wrapped in a container). */
export function renderSceneToSvg(scene: Scene): string {
  const theme = getTheme(scene.theme);

  if (scene.subplots.length === 1) {
    return renderSubplot(scene.subplots[0], theme);
  }

  // Multiple subplots — wrap in an outer SVG
  const parts = scene.subplots.map((sp) => {
    const inner = renderSubplot(sp, theme);
    return `<g transform="translate(${sp.bounds.x},${sp.bounds.y})">${inner}</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}">\n${parts.join("\n")}\n</svg>`;
}
