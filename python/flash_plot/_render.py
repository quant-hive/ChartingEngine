"""
SVG and HTML renderers for Flash plot scenes.
Generates animated SVG with CSS keyframes for Jupyter/Colab display.
"""

from __future__ import annotations
import json
import math
from typing import List

from ._core import dash_array, get_theme
from ._figure import (
    Scene, SubplotScene, PlotElement,
    LinePlotElement, AreaPlotElement, BarPlotElement, ScatterPlotElement,
    HLinePlotElement, VLinePlotElement, TextPlotElement, AnnotationPlotElement,
    BoxPlotElement, ViolinPlotElement, SurfacePlotElement, PiePlotElement,
)


# ── Sparkle dot positions (from Figma) ─────────────────────────────────

SPARKLE_DOTS = [
    (0.75, 0.761, 1), (0.315, 0.843, 1), (0.675, 0.780, 0.5),
    (0.459, 0.846, 0.5), (0.238, 0.685, 0.75), (0.45, 0.649, 1),
    (0.509, 0.870, 1), (0.558, 0.106, 1), (0.225, 0.623, 0.5),
    (0.331, 0.132, 0.5), (0.475, 0.668, 0.5), (0.626, 0.862, 0.5),
    (0.685, 0.107, 0.5), (0.138, 0.632, 0.75), (0.368, 0.147, 0.75),
]


# ── CSS Animation Keyframes ─────────────────────────────────────────────

_CSS_ANIMATIONS = """
/* Phase 1: Grid draw-in */
@keyframes fp-gridDraw { from { stroke-dashoffset: var(--fp-len); } to { stroke-dashoffset: 0; } }

/* Phase 2: Label appear */
@keyframes fp-labelFadeY { from { opacity: 0; transform: translate(8px, 0); } to { opacity: 1; transform: translate(0, 0); } }
@keyframes fp-labelFadeX { from { opacity: 0; transform: translate(0, -6px); } to { opacity: 1; transform: translate(0, 0); } }

/* Phase 3: Data elements */
@keyframes fp-lineDraw { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }
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

/* ── Bar hover interactions ─────────────────────────────────────────── */
.fp-bar { cursor: pointer; }
.fp-bar-glow { opacity: 0; transition: opacity 0.35s ease-out; }
.fp-bar:hover .fp-bar-glow { opacity: 1; transition: opacity 0.15s ease-in; }
/* Base bars stay filled permanently */
.fp-bar-base-glow { opacity: 1 !important; transition: none; }
.fp-bar .fp-drift { animation: none !important; }
.fp-bar:hover .fp-drift1 { animation: fp-glowDrift1 4s ease-in-out infinite !important; }
.fp-bar:hover .fp-drift2 { animation: fp-glowDrift2 3.5s ease-in-out 0.3s infinite !important; }
.fp-bar:hover .fp-drift3 { animation: fp-glowDrift3 3.8s ease-in-out 0.2s infinite !important; }
.fp-bar:hover .fp-drift1b { animation: fp-glowDrift1 4.2s ease-in-out 0.5s infinite !important; }
.fp-bar .fp-sparkle { animation: none !important; }
.fp-bar:hover .fp-sparkle { animation: var(--fp-sparkle-anim) !important; }

/* ── Pie chart interactions ─────────────────────────────────────────── */
@keyframes fp-pieSliceIn {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes fp-pieLblIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.fp-pie-slice { cursor: pointer; transition: opacity 0.4s ease, transform 0.35s cubic-bezier(0.25,0.1,0.25,1); transform-origin: var(--fp-pie-cx) var(--fp-pie-cy); }
.fp-pie-group:hover .fp-pie-slice { opacity: 0.35; }
.fp-pie-group:hover .fp-pie-slice:hover { opacity: 1; transform: scale(1.02); }
.fp-pie-group:hover .fp-pie-slice:hover + .fp-pie-lbl { opacity: 1; }
.fp-pie-lbl { transition: opacity 0.4s ease; pointer-events: none; }
.fp-pie-group:hover .fp-pie-lbl { opacity: 0.35; }

/* ── Hover tooltips ─────────────────────────────────────────────────── */
.fp-tip { pointer-events: all; }
.fp-tip-content { opacity: 0; pointer-events: none; transition: opacity 0.12s ease; }
.fp-tip:hover .fp-tip-content { opacity: 1; }
.fp-bar:hover .fp-tip-content { opacity: 1; }

/* ── Theme: light mode overrides ──────────────────────────────────── */
.fp-light .fp-bg { fill: #f8f8f8; }
.fp-light .fp-grid-line { stroke: #e0e0e0 !important; }
.fp-light .fp-ax { fill: #888888 !important; }
.fp-light .fp-title-text { fill: #111111 !important; }
.fp-light .fp-subtitle-text { fill: #666666 !important; }
.fp-light .fp-cfg-chevron { stroke: #999999 !important; }
.fp-light .fp-panel-bg { fill: #ffffff !important; stroke: #e0e0e0 !important; }
.fp-light .fp-panel-text { fill: #555555 !important; }
.fp-light .fp-panel-check-box { stroke: #cccccc !important; }
.fp-light .fp-panel-check-mark { stroke: #555555 !important; }
.fp-light .fp-tip-bg { fill: #ffffff !important; stroke: #e0e0e0 !important; }
.fp-light .fp-tip-header { fill: #888888 !important; }
.fp-light .fp-tip-label { fill: #555555 !important; }
.fp-light .fp-tip-value { fill: #222222 !important; }
.fp-light .fp-legend-text { fill: #555555 !important; }
/* Light mode bars: light grey background bar, soften glow effects */
.fp-light .fp-bar-bg { fill: #e0e0e0 !important; }
.fp-light .fp-drift { opacity: 0.12 !important; }
.fp-light .fp-bar-base-glow .fp-drift { opacity: 0.12 !important; }
.fp-light .fp-surface-dark { display: none !important; }
.fp-light .fp-surface-light { display: block !important; }
/* When 3D mode is active, hide both static surfaces regardless of theme */
.fp-3d-active .fp-surface-dark { display: none !important; }
.fp-3d-active .fp-surface-light { display: none !important; }
"""


def _hex_lerp(c1: str, c2: str, t: float) -> str:
    """Linearly interpolate between two hex colors."""
    r1, g1, b1 = int(c1[1:3], 16), int(c1[3:5], 16), int(c1[5:7], 16)
    r2, g2, b2 = int(c2[1:3], 16), int(c2[3:5], 16), int(c2[5:7], 16)
    r = int(r1 + (r2 - r1) * t)
    g = int(g1 + (g2 - g1) * t)
    b = int(b1 + (b2 - b1) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def _surface_color(z_norm: float, shade: float, base_color: str,
                   colormap: list = None) -> str:
    """Compute face color from z-value and shading."""
    if colormap and len(colormap) >= 2:
        # Interpolate through colormap
        t = max(0, min(1, z_norm))
        n = len(colormap) - 1
        idx = t * n
        lo = int(idx)
        hi = min(lo + 1, n)
        frac = idx - lo
        color = _hex_lerp(colormap[lo], colormap[hi], frac)
    else:
        # Single color with brightness variation
        dark = _hex_lerp("#121212", base_color, 0.3 + z_norm * 0.4)
        color = dark
    # Apply shading
    shade_factor = 0.7 + 0.3 * max(0, min(1, shade))
    r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
    r = min(255, int(r * shade_factor))
    g = min(255, int(g * shade_factor))
    b = min(255, int(b * shade_factor))
    return f"#{r:02x}{g:02x}{b:02x}"


# Default colormaps — dark theme uses all mid-to-bright tones (no dark blues/reds)
DARK_COLORMAP = ["#4aaaba", "#6dd5c8", "#a5f3d8", "#d8b4fe", "#f9a8d4", "#fbbf24"]
# Light theme uses richer, deeper tones that pop on white
LIGHT_COLORMAP = ["#1e3a5f", "#2563eb", "#7c3aed", "#c026d3", "#e11d48", "#f97316"]


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _fmt_val(v: float) -> str:
    """Format a value for tooltip display."""
    if abs(v) >= 1e6:
        return f"{v:.2e}"
    if abs(v) >= 100:
        return f"{v:,.0f}"
    if abs(v) >= 1:
        return f"{v:,.2f}"
    if v == 0:
        return "0"
    return f"{v:.4g}"


# ── Tooltip Builder ────────────────────────────────────────────────────

def _build_tooltip_box(
    header: str, entries: list, tx: float, ty: float,
    w: float, bounds_w: float, pa_y: float,
) -> str:
    """Build a tooltip SVG group.
    entries: list of (color, label, value_str)
    """
    row_h = 18
    header_h = 22
    pad = 8
    total_h = pad + header_h + len(entries) * row_h + pad

    # Flip left if tooltip would overflow right
    if tx + w + 12 > bounds_w:
        tx = tx - w - 10
    else:
        tx = tx + 10

    # Keep tooltip in vertical bounds
    if ty + total_h > pa_y + 200:
        ty = max(pa_y, ty - total_h - 10)

    lines = []
    lines.append(f'<g transform="translate({tx:.1f},{ty:.1f})">')
    lines.append(f'  <rect class="fp-tip-bg" width="{w}" height="{total_h}" rx="5" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="0.5"/>')
    lines.append(f'  <text class="fp-tip-header" x="8" y="{pad + 11}" fill="#808080" font-size="9" font-weight="500" '
                 f'font-family="\'Inter\',sans-serif">{_esc(header)}</text>')
    lines.append(f'  <line class="fp-tip-bg" x1="8" y1="{pad + header_h - 4}" x2="{w - 8}" y2="{pad + header_h - 4}" '
                 f'stroke="#2a2a2a" stroke-width="0.5"/>')

    for idx, (color, label, val_str) in enumerate(entries):
        ry = pad + header_h + idx * row_h + 12
        lines.append(f'  <circle cx="14" cy="{ry - 3}" r="3" fill="{color}"/>')
        lines.append(f'  <text class="fp-tip-label" x="22" y="{ry}" fill="#a0a0a0" font-size="9" '
                     f'font-family="\'Inter\',sans-serif">{_esc(label)}</text>')
        lines.append(f'  <text class="fp-tip-value" x="{w - 8}" y="{ry}" text-anchor="end" fill="#e0e0e0" '
                     f'font-size="9" font-weight="600" font-family="\'Inter\',sans-serif">{_esc(val_str)}</text>')

    lines.append("</g>")
    return "\n".join(lines)


# ── Hover Overlay Builders ─────────────────────────────────────────────

def _build_line_hover_overlay(sp: SubplotScene, uid: str) -> str:
    """Build hover overlay for line charts — one tooltip per x-position showing all series."""
    pa = sp.plot_area
    w, h = sp.bounds.w, sp.bounds.h
    line_els = [el for el in sp.elements if isinstance(el, LinePlotElement) and el.points]
    if not line_els:
        return ""

    n_points = len(line_els[0].points)
    if n_points == 0:
        return ""

    # Build x labels from ticks
    tick_labels = {round(t.position, 1): t.label for t in sp.x_axis.ticks}

    lines = []
    for i in range(n_points):
        px = line_els[0].points[i].x

        # Compute strip boundaries (midpoint between adjacent points)
        if n_points == 1:
            strip_l, strip_r = pa.x, pa.x + pa.w
        else:
            strip_l = px - (px - line_els[0].points[i - 1].x) / 2 if i > 0 else pa.x
            strip_r = px + (line_els[0].points[i + 1].x - px) / 2 if i < n_points - 1 else pa.x + pa.w

        # Find closest x-tick label
        x_label = str(i)
        best_dist = float("inf")
        for tp, tl in tick_labels.items():
            d = abs(tp - px)
            if d < best_dist:
                best_dist = d
                x_label = tl

        # Build entries for all line series at this index
        entries = []
        for el in line_els:
            if i < len(el.data_values):
                label = el.label or el.color
                entries.append((el.color, label, _fmt_val(el.data_values[i])))

        tooltip_w = 120

        lines.append(f'<g class="fp-tip">')
        # Hit area strip
        lines.append(f'  <rect x="{strip_l:.1f}" y="{pa.y:.1f}" width="{strip_r - strip_l:.1f}" '
                     f'height="{pa.h:.1f}" fill="transparent"/>')

        lines.append(f'  <g class="fp-tip-content">')
        # Crosshair
        lines.append(f'    <line x1="{px:.1f}" y1="{pa.y:.1f}" x2="{px:.1f}" y2="{pa.y + pa.h:.1f}" '
                     f'stroke="#3a3a3a" stroke-width="0.5" stroke-dasharray="3 2"/>')
        # Dots on each line
        for el in line_els:
            if i < len(el.points):
                py = el.points[i].y
                lines.append(f'    <circle cx="{px:.1f}" cy="{py:.1f}" r="3.5" fill="#121212" '
                             f'stroke="{el.color}" stroke-width="1.2"/>')
                lines.append(f'    <circle cx="{px:.1f}" cy="{py:.1f}" r="1.5" fill="{el.color}"/>')
        # Tooltip
        lines.append(_build_tooltip_box(x_label, entries, px, pa.y + 4, tooltip_w, w, pa.y))
        lines.append("  </g>")
        lines.append("</g>")

    return "\n".join(lines)


def _build_bar_tooltip(bar, label, x_label, value, color, uid, pa, bounds_w) -> str:
    """Build a tooltip that appears on bar hover."""
    entries = [(color, label or "Value", _fmt_val(value))]
    tx = bar.x + bar.width / 2
    ty = bar.y - 8
    tooltip_w = 110

    lines = []
    lines.append(f'<g class="fp-tip-content">')
    lines.append(_build_tooltip_box(x_label, entries, tx, ty, tooltip_w, bounds_w, pa.y))
    lines.append("</g>")
    return "\n".join(lines)


def _build_scatter_hover_overlay(sp: SubplotScene, uid: str) -> str:
    """Build hover overlay for scatter plots — one tooltip per point."""
    pa = sp.plot_area
    w = sp.bounds.w
    scatter_els = [el for el in sp.elements if isinstance(el, ScatterPlotElement)]
    if not scatter_els:
        return ""

    lines = []
    for el in scatter_els:
        for i, (px, py, sz) in enumerate(el.points):
            r = max(math.sqrt(sz), 4)
            x_val, y_val = el.data_xy[i] if i < len(el.data_xy) else (0, 0)
            label = el.label or "Point"
            entries = [
                (el.color, "x", _fmt_val(x_val)),
                (el.color, "y", _fmt_val(y_val)),
            ]
            tooltip_w = 100

            lines.append(f'<g class="fp-tip">')
            lines.append(f'  <circle cx="{px:.1f}" cy="{py:.1f}" r="{r + 3:.1f}" fill="transparent"/>')
            lines.append(f'  <g class="fp-tip-content">')
            # Highlight ring
            lines.append(f'    <circle cx="{px:.1f}" cy="{py:.1f}" r="{r + 1:.1f}" '
                         f'fill="none" stroke="{el.color}" stroke-width="1.5" stroke-opacity="0.6"/>')
            lines.append(_build_tooltip_box(label, entries, px, py - 8, tooltip_w, w, pa.y))
            lines.append("  </g>")
            lines.append("</g>")

    return "\n".join(lines)


# ── Subplot Renderer ────────────────────────────────────────────────────

def _render_subplot(sp: SubplotScene, animate: bool, uid: str, hover: bool = True) -> str:
    pa = sp.plot_area
    lines: List[str] = []
    w, h = sp.bounds.w, sp.bounds.h
    theme = get_theme()

    # Timing constants
    T_LABELS = 0.675
    T_DATA = 1.28
    T_SHIMMER = 2.5
    SHIMMER_STEP = 0.08
    SHIMMER_DUR = 0.24

    bar_count = 0
    deferred_bar_tooltips: List[str] = []
    bar_tip_css_rules: List[str] = []
    for el in sp.elements:
        if isinstance(el, BarPlotElement):
            bar_count = max(bar_count, len(el.bars))
    bar_sweep_start = T_DATA + 0.81 + bar_count * 0.054
    bar_sweep_step = 0.12

    # Check if subplot contains only pie charts (skip grid/axes)
    is_pie_only = all(isinstance(el, PiePlotElement) for el in sp.elements) and len(sp.elements) > 0

    # Add extra height for legend below x-axis (pie charts use side legend, no extra height)
    if is_pie_only or not (sp.legend and sp.legend.entries):
        legend_extra_h = 0
    else:
        _max_w = w - 80
        _row_w = 0.0
        _n_rows = 1
        for _le in sp.legend.entries:
            _iw = 14 + 4 + len(_le.label) * 4.8 + 16
            if _row_w > 0 and _row_w + _iw > _max_w:
                _n_rows += 1
                _row_w = _iw
            else:
                _row_w += _iw
        legend_extra_h = 30 + _n_rows * 18
    if is_pie_only:
        # Crop SVG to actual pie content: find max bottom of pie elements
        _pie_bottom = 0
        for el in sp.elements:
            if isinstance(el, PiePlotElement):
                _pie_bottom = max(_pie_bottom, el.cy + el.radius)
        svg_h = _pie_bottom + 8 if _pie_bottom > 0 else pa.y + pa.h + 6
    else:
        svg_h = h + legend_extra_h
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {svg_h:.1f}" '
                 f'class="fp-dark" '
                 f'style="width:100%;height:auto;display:block;font-family:\'Inter\',sans-serif;">')

    # Background rect (themed)
    lines.append(f'<rect class="fp-bg" width="{w:.1f}" height="{svg_h:.1f}" fill="{theme.background}" rx="4"/>')

    # Inline styles placeholder — will be finalized after collecting bar tip CSS rules
    style_insert_idx = len(lines)
    if hover:
        lines.append("")  # placeholder, replaced later

    # Defs
    lines.append("<defs>")

    # Per-area gradients using each area's own color
    area_grad_ids = {}
    for a_idx, el in enumerate(e for e in sp.elements if isinstance(e, AreaPlotElement)):
        gid = f"areaGrad-{uid}-{a_idx}"
        area_grad_ids[id(el)] = gid
        lines.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">')
        lines.append(f'  <stop offset="0%" stop-color="{el.color}" stop-opacity="0.15"/>')
        lines.append(f'  <stop offset="100%" stop-color="{el.color}" stop-opacity="0.05"/>')
        lines.append("</linearGradient>")

    bar_el_count = sum(1 for el in sp.elements if isinstance(el, BarPlotElement))
    for bei in range(bar_el_count):
        for name, sigma in [("SideGlow", 5), ("TopHL", 4), ("BotGlow", 5), ("LeftEdge", 5), ("BotWhite", 2.25), ("TopWhite", 2.25)]:
            fid = f"bar{name}-{uid}-{bei}"
            lines.append(f'<filter id="{fid}" x="-50%" y="-50%" width="200%" height="200%">')
            lines.append(f'  <feGaussianBlur in="SourceGraphic" stdDeviation="{sigma}"/>')
            lines.append("</filter>")
    lines.append("</defs>")

    # ── Title & Subtitle (click-to-edit) ──────────────────────────────────
    _edit_js = (
        "(function(e){"
        "var g=e.currentTarget,s=g.ownerSVGElement,t=g.querySelector('text');"
        "if(!t)return;"
        "var x=+t.getAttribute('x'),y=+t.getAttribute('y'),fs=+t.getAttribute('font-size');"
        "var fo=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');"
        "fo.setAttribute('x',x);fo.setAttribute('y',y-fs);fo.setAttribute('width',%WIDTH%);fo.setAttribute('height',fs+12);"
        "var inp=document.createElement('input');inp.value=t.textContent;"
        "inp.style.cssText='background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.3);"
        "outline:none;color:'+t.getAttribute('fill')+';font-size:'+fs+'px;font-weight:'+t.getAttribute('font-weight')+"
        "';font-family:'+t.getAttribute('font-family')+';width:100%;padding:2px 0;';"
        "var done=function(){t.textContent=inp.value;g.removeChild(fo);t.style.display='';};"
        "inp.addEventListener('blur',done);inp.addEventListener('keydown',function(ev){if(ev.key==='Enter')done();});"
        "t.style.display='none';fo.appendChild(inp);g.appendChild(fo);inp.focus();"
        "})(event)"
    )
    if sp.title and sp.title_style:
        title_top = 14  # top margin
        ty = title_top + sp.title_style.font_size
        anim_style = ""
        if animate:
            anim_style = f' style="animation:fp-refFade 0.5s ease 0.2s both"'
        title_edit_js = _edit_js.replace('%WIDTH%', f'{pa.w:.0f}')
        lines.append(f'<g cursor="pointer" onclick="{_esc(title_edit_js)}">')
        lines.append(f'<text class="fp-title-text" x="{pa.x:.1f}" y="{ty:.1f}" '
                     f'font-size="{sp.title_style.font_size}" font-weight="{sp.title_style.font_weight}" '
                     f'font-family="{_esc(sp.title_style.font_family)}" '
                     f'fill="{sp.title_style.color}"{anim_style}>{_esc(sp.title)}</text>')
        lines.append('</g>')
    if sp.subtitle and sp.subtitle_style:
        _sub_top = 14
        sy = _sub_top + (sp.title_style.font_size + 4 if sp.title else 0) + sp.subtitle_style.font_size
        anim_style = ""
        if animate:
            anim_style = f' style="animation:fp-refFade 0.5s ease 0.35s both"'
        sub_edit_js = _edit_js.replace('%WIDTH%', f'{pa.w:.0f}')
        lines.append(f'<g cursor="pointer" onclick="{_esc(sub_edit_js)}">')
        lines.append(f'<text class="fp-subtitle-text" x="{pa.x:.1f}" y="{sy:.1f}" '
                     f'font-size="{sp.subtitle_style.font_size}" font-weight="{sp.subtitle_style.font_weight}" '
                     f'font-family="{_esc(sp.subtitle_style.font_family)}" '
                     f'fill="{sp.subtitle_style.color}"{anim_style}>{_esc(sp.subtitle)}</text>')
        lines.append('</g>')

    # ── Grid ────────────────────────────────────────────────────────────
    grid_display = ' display="none"' if is_pie_only else ''
    lines.append(f'<g id="fp-grid-{uid}"{grid_display}>')
    if not is_pie_only:
        for i, gl in enumerate(sp.grid.lines):
            ln = math.sqrt((gl.x2 - gl.x1) ** 2 + (gl.y2 - gl.y1) ** 2)
            anim = ""
            if animate:
                anim = (f' style="--fp-len:{ln:.1f};stroke-dasharray:{ln:.1f};'
                        f'animation:fp-gridDraw 0.675s cubic-bezier(0.22,1,0.36,1) {i*0.08:.2f}s both"')
            lines.append(f'<line class="fp-grid-line" x1="{gl.x1:.1f}" y1="{gl.y1:.1f}" x2="{gl.x2:.1f}" y2="{gl.y2:.1f}" '
                         f'stroke="{gl.color}" stroke-width="{gl.width}"{anim}/>')
    lines.append('</g>')

    # ── Axis labels (wrapped in parent group for toggle) ─────────────
    axis_display = ' display="none"' if is_pie_only else ''
    lines.append(f'<g id="fp-axis-{uid}"{axis_display}>')

    # ── Y labels (with shimmer) ────────────────────────────────────────
    lines.append(f'<g id="fp-ylbl-{uid}">')
    for i, t in enumerate(sp.y_axis.ticks):
        ts = sp.y_axis.tick_style
        anim_style = ""
        if animate:
            fade = f'fp-labelFadeY 0.35s ease {T_LABELS + i*0.04:.2f}s both'
            shimmer_delay = T_SHIMMER + i * SHIMMER_STEP
            shimmer = f'fp-shimmer {SHIMMER_DUR}s ease {shimmer_delay:.2f}s 1'
            anim_style = f'--fp-base:{ts.color};animation:{fade},{shimmer};'
        lines.append(f'<text class="fp-ax" x="{pa.x - 4:.1f}" y="{t.position + 3:.1f}" text-anchor="end" '
                     f'font-size="{ts.font_size}" font-weight="{ts.font_weight}" '
                     f'font-family="{_esc(ts.font_family)}" letter-spacing="{ts.letter_spacing}" '
                     f'fill="{ts.color}" style="{anim_style}">{_esc(t.label)}</text>')
    lines.append('</g>')

    # ── X labels (with shimmer) ────────────────────────────────────────
    lines.append(f'<g id="fp-xlbl-{uid}">')
    for i, t in enumerate(sp.x_axis.ticks):
        ts = sp.x_axis.tick_style
        anim_style = ""
        if animate:
            fade = f'fp-labelFadeX 0.35s ease {T_LABELS + i*0.03:.2f}s both'
            shimmer_delay = T_SHIMMER + i * SHIMMER_STEP
            shimmer = f'fp-shimmer {SHIMMER_DUR}s ease {shimmer_delay:.2f}s 1'
            anim_style = f'--fp-base:{ts.color};animation:{fade},{shimmer};'
        lines.append(f'<text class="fp-ax" x="{t.position:.1f}" y="{h - 4:.1f}" text-anchor="middle" '
                     f'font-size="{ts.font_size}" font-weight="{ts.font_weight}" '
                     f'font-family="{_esc(ts.font_family)}" letter-spacing="{ts.letter_spacing}" '
                     f'fill="{ts.color}" style="{anim_style}">{_esc(t.label)}</text>')
    lines.append('</g>')  # close x labels
    lines.append('</g>')  # close axis labels parent group

    # ── Plot elements ───────────────────────────────────────────────────
    line_idx = 0
    area_idx = 0
    bar_el_idx = 0
    for el in sp.elements:
        if isinstance(el, AreaPlotElement):
            anim_style = ""
            if animate:
                anim_style = f'animation:fp-areaFade 1.08s ease {T_DATA + area_idx*0.135:.2f}s both;'
            gid = area_grad_ids.get(id(el), f"areaGrad-{uid}-0")
            lines.append(f'<path d="{el.path}" fill="url(#{gid})" opacity="{el.alpha}" style="{anim_style}"/>')
            area_idx += 1

        elif isinstance(el, LinePlotElement):
            da = dash_array(el.line_style)
            if animate:
                lines.append(f'<path d="{el.path}" fill="none" stroke="{el.color}" '
                             f'stroke-width="{el.line_width}" stroke-linejoin="round" '
                             f'stroke-dasharray="2000" opacity="{el.alpha}" '
                             f'style="animation:fp-lineDraw 1.89s cubic-bezier(0.22,1,0.36,1) {T_DATA + line_idx*0.2:.2f}s both"/>')
                if da and el.line_style != "solid":
                    lines.append(f'<path d="{el.path}" fill="none" stroke="{el.color}" '
                                 f'stroke-width="{el.line_width}" stroke-linejoin="round" '
                                 f'stroke-dasharray="{da}" opacity="{el.alpha}" '
                                 f'style="animation:fp-areaFade 0.3s ease {T_DATA + line_idx*0.2 + 1.89:.2f}s both"/>')
            else:
                extra = f' stroke-dasharray="{da}"' if da else ""
                lines.append(f'<path d="{el.path}" fill="none" stroke="{el.color}" '
                             f'stroke-width="{el.line_width}" stroke-linejoin="round" '
                             f'opacity="{el.alpha}"{extra}/>')
            line_idx += 1

        elif isinstance(el, BarPlotElement):
            si = el.series_index
            st = theme.bar_styles[bar_el_idx % len(theme.bar_styles)]
            for bar in el.bars:
                delay = T_DATA + bar.index * 0.054
                grow_style = ""
                if animate:
                    grow_style = f'transform-origin:{bar.x + bar.width/2:.1f}px {pa.y + pa.h:.1f}px;animation:fp-barGrow 0.81s cubic-bezier(0.22,1,0.36,1) {delay:.2f}s both;'

                bar_id = f"fp-b-{uid}-{bar_el_idx}-{bar.index}"
                lines.append(f'<g id="{bar_id}" class="fp-bar">')
                lines.append(f'  <rect class="fp-bar-bg" x="{bar.x:.1f}" y="{bar.y:.1f}" width="{bar.width:.1f}" height="{bar.height:.1f}" '
                             f'fill="{theme.bar_default_fill}" style="{grow_style}"/>')

                clip_id = f"bc-{uid}-{bar_el_idx}-{bar.index}"
                lines.append(f'  <clipPath id="{clip_id}"><rect x="{bar.x:.1f}" y="{bar.y:.1f}" width="{bar.width:.1f}" height="{bar.height:.1f}" style="{grow_style}"/></clipPath>')

                if el.is_base:
                    # Base bars: reveal from bottom using SMIL-animated clip rect
                    if animate:
                        fillin_delay = bar_sweep_start + bar.index * bar_sweep_step
                        reveal_id = f"rv-{uid}-{bar_el_idx}-{bar.index}"
                        bar_bottom = bar.y + bar.height
                        lines.append(f'  <defs><clipPath id="{reveal_id}">')
                        lines.append(f'    <rect x="{bar.x:.1f}" y="{bar_bottom:.1f}" width="{bar.width:.1f}" height="0">')
                        lines.append(f'      <animate attributeName="y" from="{bar_bottom:.1f}" to="{bar.y:.1f}" '
                                     f'dur="0.5s" begin="{fillin_delay:.2f}s" fill="freeze" calcMode="spline" '
                                     f'keySplines="0.22 1 0.36 1"/>')
                        lines.append(f'      <animate attributeName="height" from="0" to="{bar.height:.1f}" '
                                     f'dur="0.5s" begin="{fillin_delay:.2f}s" fill="freeze" calcMode="spline" '
                                     f'keySplines="0.22 1 0.36 1"/>')
                        lines.append(f'    </rect>')
                        lines.append(f'  </clipPath></defs>')
                        lines.append(f'  <g class="fp-bar-glow fp-bar-base-glow" clip-path="url(#{clip_id})">')
                        lines.append(f'  <g clip-path="url(#{reveal_id})">')
                    else:
                        lines.append(f'  <g class="fp-bar-glow fp-bar-base-glow" clip-path="url(#{clip_id})">')
                        lines.append(f'  <g>')  # dummy wrapper for consistent closing
                else:
                    # Stacked bars: hidden by default, show only on hover
                    lines.append(f'  <g class="fp-bar-glow" clip-path="url(#{clip_id})">')

                lines.append(f'    <rect x="{bar.x:.1f}" y="{bar.y:.1f}" width="{bar.width:.1f}" height="{bar.height:.1f}" fill="{st.fill}" style="{grow_style}"/>')

                sc = lambda hv: (hv / 134) * bar.height
                bx, bw = bar.x, bar.width
                ay, ah = bar.y, bar.height

                lines.append(f'    <g class="fp-drift fp-drift1" filter="url(#barSideGlow-{uid}-{bar_el_idx})">')
                lines.append(f'      <ellipse cx="{bx + bw * 0.5:.1f}" cy="{ay + ah * 0.5:.1f}" rx="{bw * 0.55:.1f}" ry="{ah * 0.45:.1f}" fill="{st.side_glow}"/>')
                lines.append("    </g>")

                lines.append(f'    <g class="fp-drift fp-drift2" filter="url(#barTopHL-{uid}-{bar_el_idx})">')
                lines.append(f'      <rect x="{bx+bw*0.05:.1f}" y="{ay+sc(1):.1f}" width="{bw*0.9:.1f}" height="{sc(8):.1f}" rx="2" fill="{st.top_glow}"/>')
                lines.append("    </g>")

                lines.append(f'    <g class="fp-drift fp-drift3" filter="url(#barBotGlow-{uid}-{bar_el_idx})">')
                lines.append(f'      <path d="M{bx+bw*0.05} {ay+ah-sc(8.2)} C{bx+bw*0.05} {ay+ah-sc(9.2)} {bx+bw*0.05} {ay+ah-sc(4)} {bx+bw*0.17} {ay+ah-sc(1.5)} C{bx+bw*0.28} {ay+ah+sc(0.8)} {bx+bw*0.72} {ay+ah+sc(0.8)} {bx+bw*0.83} {ay+ah-sc(1.5)} C{bx+bw*0.95} {ay+ah-sc(4)} {bx+bw*0.95} {ay+ah-sc(9.2)} {bx+bw*0.95} {ay+ah-sc(8.2)} V{ay+ah} H{bx+bw*0.05} V{ay+ah-sc(8.2)}Z" fill="{st.bottom_glow}"/>')
                lines.append("    </g>")

                lines.append(f'    <g class="fp-drift fp-drift1b" filter="url(#barLeftEdge-{uid}-{bar_el_idx})">')
                lines.append(f'      <path d="M{bx-bw*0.01} {ay+sc(4)} C{bx+bw*0.045} {ay+sc(4)} {bx+bw*0.045} {ay+sc(4)} {bx+bw*0.045} {ay+sc(8)} V{ay+ah-sc(8)} C{bx+bw*0.045} {ay+ah-sc(4)} {bx-bw*0.01} {ay+ah-sc(2)} {bx-bw*0.01} {ay+ah} V{ay+sc(4)}Z" fill="{st.left_edge}"/>')
                lines.append("    </g>")

                for d_idx, (dcx, dcy, dr) in enumerate(SPARKLE_DOTS):
                    float_name = ["fp-sparkleFloat1", "fp-sparkleFloat2", "fp-sparkleFloat3"][d_idx % 3]
                    dur = 2.5 + (d_idx % 5) * 0.5
                    sp_delay = (d_idx * 0.2) % 1.5
                    sp_var = f'--fp-sparkle-anim:{float_name} {dur}s ease-in-out {sp_delay:.1f}s infinite;'
                    lines.append(f'    <circle class="fp-sparkle" cx="{bx + dcx * bw:.1f}" cy="{ay + dcy * ah:.1f}" r="{dr}" '
                                 f'fill="{st.sparkle}" style="{sp_var}"/>')

                lines.append(f'    <g filter="url(#barBotWhite-{uid}-{bar_el_idx})">')
                lines.append(f'      <path d="M{bx} {ay+ah-sc(3.5)} L{bx+bw*0.5} {ay+ah-sc(1.5)} L{bx+bw} {ay+ah-sc(3.5)} V{ay+ah} H{bx} V{ay+ah-sc(3.5)}Z" fill="white" fill-opacity="0.8"/>')
                lines.append("    </g>")
                lines.append(f'    <g filter="url(#barTopWhite-{uid}-{bar_el_idx})">')
                lines.append(f'      <path d="M{bx} {ay+sc(3.5)} L{bx+bw*0.5} {ay+sc(1.5)} L{bx+bw} {ay+sc(3.5)} V{ay} H{bx} V{ay+sc(3.5)}Z" fill="white" fill-opacity="0.8"/>')
                lines.append("    </g>")

                if el.is_base:
                    lines.append("  </g>")  # close reveal wrapper
                lines.append("  </g>")  # close fp-bar-glow

                # Hit area for hover
                lines.append(f'  <rect x="{bar.x - 2:.1f}" y="{bar.y - 2:.1f}" width="{bar.width + 4:.1f}" height="{bar.height + 4:.1f}" '
                             f'fill="transparent" opacity="0"/>')

                # Defer tooltip to top-layer overlay, triggered by bar hover via CSS sibling selector
                if hover:
                    x_label = el.x_labels[bar.index] if bar.index < len(el.x_labels) else str(bar.index)
                    tip_id = f"fp-bt-{uid}-{bar_el_idx}-{bar.index}"
                    tip_lines = []
                    tip_lines.append(f'<g id="{tip_id}" class="fp-bar-tip">')
                    tip_lines.append(_build_tooltip_box(
                        x_label, [(el.color, el.label or "Value", _fmt_val(bar.value))],
                        bar.x + bar.width / 2, bar.y - 8, 110, w, pa.y,
                    ))
                    tip_lines.append("</g>")
                    deferred_bar_tooltips.append("\n".join(tip_lines))
                    bar_tip_css_rules.append(
                        f"#{bar_id}:hover~#fp-bto-{uid} #{tip_id}{{opacity:1}}"
                    )

                lines.append("</g>")  # close fp-bar
            bar_el_idx += 1

        elif isinstance(el, ScatterPlotElement):
            for i, (px, py, sz) in enumerate(el.points):
                anim_style = ""
                if animate:
                    anim_style = f'animation:fp-scatterPop 0.5s ease {T_DATA + i*0.02:.2f}s both;'
                lines.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{math.sqrt(sz):.1f}" '
                             f'fill="{el.color}" opacity="{el.alpha}" style="{anim_style}"/>')

        elif isinstance(el, HLinePlotElement):
            da = dash_array(el.line_style)
            extra = f' stroke-dasharray="{da}"' if da else ""
            anim_style = ""
            if animate:
                anim_style = f' style="animation:fp-refFade 0.5s ease {T_DATA}s both"'
            lines.append(f'<line x1="{el.x_min:.1f}" y1="{el.y:.1f}" x2="{el.x_max:.1f}" y2="{el.y:.1f}" '
                         f'stroke="{el.color}" stroke-width="{el.line_width}"{extra}{anim_style}/>')

        elif isinstance(el, VLinePlotElement):
            da = dash_array(el.line_style)
            extra = f' stroke-dasharray="{da}"' if da else ""
            anim_style = ""
            if animate:
                anim_style = f' style="animation:fp-refFade 0.5s ease {T_DATA}s both"'
            lines.append(f'<line x1="{el.x:.1f}" y1="{el.y_min:.1f}" x2="{el.x:.1f}" y2="{el.y_max:.1f}" '
                         f'stroke="{el.color}" stroke-width="{el.line_width}"{extra}{anim_style}/>')

        elif isinstance(el, TextPlotElement):
            rot = f' transform="rotate({el.rotation} {el.x:.1f} {el.y:.1f})"' if el.rotation else ""
            anim_style = ""
            if animate:
                anim_style = f' style="animation:fp-refFade 0.5s ease 1.5s both"'
            lines.append(f'<text x="{el.x:.1f}" y="{el.y:.1f}" text-anchor="{el.anchor}" '
                         f'font-size="{el.style.font_size}" font-weight="{el.style.font_weight}" '
                         f'font-family="{_esc(el.style.font_family)}" fill="{el.style.color}"{rot}{anim_style}>'
                         f'{_esc(el.content)}</text>')

        elif isinstance(el, AnnotationPlotElement):
            anim_style = ""
            if animate:
                anim_style = f' style="animation:fp-refFade 0.5s ease 1.5s both"'
            g = f'<g{anim_style}>'
            if el.xy_text:
                ac = el.arrow_color or el.style.color
                aw = el.arrow_width or 1
                g += (f'<line x1="{el.xy_text.x:.1f}" y1="{el.xy_text.y:.1f}" '
                      f'x2="{el.xy.x:.1f}" y2="{el.xy.y:.1f}" stroke="{ac}" stroke-width="{aw}"/>')
            tx = el.xy_text.x if el.xy_text else el.xy.x
            ty = el.xy_text.y if el.xy_text else el.xy.y
            g += (f'<text x="{tx:.1f}" y="{ty:.1f}" font-size="{el.style.font_size}" '
                  f'font-family="{_esc(el.style.font_family)}" fill="{el.style.color}">'
                  f'{_esc(el.text)}</text>')
            g += "</g>"
            lines.append(g)

        elif isinstance(el, BoxPlotElement):
            for gi, grp in enumerate(el.groups):
                delay = T_DATA + gi * 0.12
                anim = ""
                if animate:
                    anim = f' style="animation:fp-refFade 0.5s ease {delay:.2f}s both"'
                lines.append(f'<g class="fp-boxplot"{anim}>')
                # Whisker lines
                lines.append(f'  <line x1="{grp.center_x:.1f}" y1="{grp.whisker_hi_y:.1f}" '
                             f'x2="{grp.center_x:.1f}" y2="{grp.box_y_top:.1f}" '
                             f'stroke="{el.color}" stroke-width="1" stroke-opacity="0.5"/>')
                lines.append(f'  <line x1="{grp.center_x:.1f}" y1="{grp.box_y_bot:.1f}" '
                             f'x2="{grp.center_x:.1f}" y2="{grp.whisker_lo_y:.1f}" '
                             f'stroke="{el.color}" stroke-width="1" stroke-opacity="0.5"/>')
                # Whisker caps
                cap_w = grp.box_w * 0.4
                lines.append(f'  <line x1="{grp.center_x - cap_w:.1f}" y1="{grp.whisker_hi_y:.1f}" '
                             f'x2="{grp.center_x + cap_w:.1f}" y2="{grp.whisker_hi_y:.1f}" '
                             f'stroke="{el.color}" stroke-width="1" stroke-opacity="0.6"/>')
                lines.append(f'  <line x1="{grp.center_x - cap_w:.1f}" y1="{grp.whisker_lo_y:.1f}" '
                             f'x2="{grp.center_x + cap_w:.1f}" y2="{grp.whisker_lo_y:.1f}" '
                             f'stroke="{el.color}" stroke-width="1" stroke-opacity="0.6"/>')
                # IQR box
                box_h = grp.box_y_bot - grp.box_y_top
                lines.append(f'  <rect x="{grp.box_x:.1f}" y="{grp.box_y_top:.1f}" '
                             f'width="{grp.box_w:.1f}" height="{box_h:.1f}" rx="2" '
                             f'fill="{el.color}" fill-opacity="0.12" '
                             f'stroke="{el.color}" stroke-width="1" stroke-opacity="0.4"/>')
                # Median line
                lines.append(f'  <line x1="{grp.box_x:.1f}" y1="{grp.median_y:.1f}" '
                             f'x2="{grp.box_x + grp.box_w:.1f}" y2="{grp.median_y:.1f}" '
                             f'stroke="{el.color}" stroke-width="2" stroke-opacity="0.9"/>')
                # Outliers
                for oy in grp.outlier_ys:
                    lines.append(f'  <circle cx="{grp.center_x:.1f}" cy="{oy:.1f}" r="2.5" '
                                 f'fill="none" stroke="{el.color}" stroke-width="1" stroke-opacity="0.5"/>')
                lines.append("</g>")

        elif isinstance(el, ViolinPlotElement):
            for gi, grp in enumerate(el.groups):
                delay = T_DATA + gi * 0.12
                anim = ""
                if animate:
                    anim = f' style="animation:fp-refFade 0.5s ease {delay:.2f}s both"'
                # Gradient def for this violin
                vgid = f"violinGrad-{uid}-{gi}"
                lines.append(f'<defs><linearGradient id="{vgid}" x1="0" y1="0" x2="1" y2="0">')
                lines.append(f'  <stop offset="0%" stop-color="{el.color}" stop-opacity="0.03"/>')
                lines.append(f'  <stop offset="40%" stop-color="{el.color}" stop-opacity="0.15"/>')
                lines.append(f'  <stop offset="50%" stop-color="{el.color}" stop-opacity="0.2"/>')
                lines.append(f'  <stop offset="60%" stop-color="{el.color}" stop-opacity="0.15"/>')
                lines.append(f'  <stop offset="100%" stop-color="{el.color}" stop-opacity="0.03"/>')
                lines.append("</linearGradient></defs>")
                lines.append(f'<g class="fp-violin"{anim}>')
                # Violin body (filled KDE shape)
                lines.append(f'  <path d="{grp.left_path}" fill="url(#{vgid})" '
                             f'stroke="{el.color}" stroke-width="0.8" stroke-opacity="0.35"/>')
                # Inner IQR box
                box_h = grp.box_y_bot - grp.box_y_top
                lines.append(f'  <rect x="{grp.box_x:.1f}" y="{grp.box_y_top:.1f}" '
                             f'width="{grp.box_w:.1f}" height="{box_h:.1f}" rx="1.5" '
                             f'fill="{el.color}" fill-opacity="0.25"/>')
                # Median dot
                lines.append(f'  <circle cx="{grp.center_x:.1f}" cy="{grp.median_y:.1f}" r="3" '
                             f'fill="{el.color}" fill-opacity="0.9"/>')
                lines.append(f'  <circle cx="{grp.center_x:.1f}" cy="{grp.median_y:.1f}" r="1.5" '
                             f'fill="#121212"/>')
                lines.append("</g>")

        elif isinstance(el, SurfacePlotElement):
            dark_cmap = el.colormap or DARK_COLORMAP
            light_cmap = LIGHT_COLORMAP
            # Clip surface — extend bottom by 10px so projection isn't cut at x-axis
            surf_clip_id = f"surfClip-{uid}"
            clip_pad = 10
            lines.append(f'<defs><clipPath id="{surf_clip_id}">'
                         f'<rect x="{pa.x:.1f}" y="{pa.y:.1f}" width="{pa.w:.1f}" height="{pa.h + clip_pad:.1f}"/>'
                         f'</clipPath></defs>')
            # Sort faces back-to-front (painter's algorithm)
            sorted_faces = sorted(el.faces, key=lambda f: f.z_avg)
            total = len(sorted_faces)
            face_data = []
            for fi, face in enumerate(sorted_faces):
                shade = 0.5 + 0.5 * (face.normal_z / (abs(face.normal_z) + 1e-6)) if face.normal_z != 0 else 0.5
                pts = face.pts_2d
                path = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
                for px, py in pts[1:]:
                    path += f" L{px:.1f},{py:.1f}"
                path += " Z"
                anim_style = ""
                if animate:
                    delay = T_DATA + (fi / max(total - 1, 1)) * 1.2
                    anim_style = f' style="animation:fp-areaFade 0.3s ease {delay:.2f}s both"'
                stroke_dark = ' stroke="#2a2a2a" stroke-width="0.3" stroke-opacity="0.5"' if el.wireframe else ""
                stroke_light = ' stroke="#d0d0d0" stroke-width="0.3" stroke-opacity="0.5"' if el.wireframe else ""
                face_data.append((face.z_norm, shade, path, anim_style, stroke_dark, stroke_light))
            # Static dark-theme surface (visible by default, replaced by JS when available)
            lines.append(f'<g class="fp-surface-dark" clip-path="url(#{surf_clip_id})">')
            for z_norm, shade, path, anim_style, stroke, _ in face_data:
                fill = _surface_color(z_norm, shade, el.color, dark_cmap)
                lines.append(f'<path d="{path}" fill="{fill}" fill-opacity="0.85"{stroke}{anim_style}/>')
            lines.append('</g>')
            # Static light-theme surface (hidden by default)
            lines.append(f'<g class="fp-surface-light" clip-path="url(#{surf_clip_id})" display="none">')
            for z_norm, shade, path, anim_style, _, stroke in face_data:
                fill = _surface_color(z_norm, shade, el.color, light_cmap)
                lines.append(f'<path d="{path}" fill="{fill}" fill-opacity="0.9"{stroke}{anim_style}/>')
            lines.append('</g>')
            # JS-rendered interactive surface group (empty, populated by script)
            lines.append(f'<g id="fp-surfjs-{uid}" clip-path="url(#{surf_clip_id})"></g>')
            # 3D axes group (empty, populated by script)
            lines.append(f'<g id="fp-axes3d-{uid}"></g>')
            # Embed raw data for interactive JS
            # Compute real x/y ranges from data grids or default 0..cols/rows
            rows = len(el.z_data)
            cols = len(el.z_data[0]) if rows else 0
            if el.x_data and len(el.x_data) > 0 and len(el.x_data[0]) > 0:
                x_min_r = min(min(row) for row in el.x_data)
                x_max_r = max(max(row) for row in el.x_data)
            else:
                x_min_r, x_max_r = 0, max(1, cols - 1)
            if el.y_data and len(el.y_data) > 0 and len(el.y_data[0]) > 0:
                y_min_r = min(min(row) for row in el.y_data)
                y_max_r = max(max(row) for row in el.y_data)
            else:
                y_min_r, y_max_r = 0, max(1, rows - 1)
            surf_data = {
                "z": el.z_data, "rows": rows, "cols": cols,
                "az": el.azimuth, "el": el.elevation, "wf": el.wireframe,
                "pa": {"x": round(pa.x, 1), "y": round(pa.y, 1),
                        "w": round(pa.w, 1), "h": round(pa.h, 1)},
                "zMn": round(el.z_min, 6), "zMx": round(el.z_max, 6),
                "xMn": round(x_min_r, 6), "xMx": round(x_max_r, 6),
                "yMn": round(y_min_r, 6), "yMx": round(y_max_r, 6),
                "dc": dark_cmap, "lc": light_cmap,
            }
            lines.append(f'<desc id="fp-sdata-{uid}" style="display:none">'
                         f'{_esc(json.dumps(surf_data, separators=(",",":")))}</desc>')

        elif isinstance(el, PiePlotElement):
            pcx, pcy, pr = el.cx, el.cy, el.radius
            inner_r = pr * el.donut_ratio if el.donut else 0

            # Radial gradients + subtle drop shadow
            lines.append('<defs>')
            for si, s in enumerate(el.slices):
                lines.append(f'<radialGradient id="fpPieGrad-{uid}-{si}" cx="50%" cy="50%" r="50%">'
                             f'<stop offset="0%" stop-color="{s.color}" stop-opacity="0.85"/>'
                             f'<stop offset="100%" stop-color="{s.color}" stop-opacity="1"/>'
                             f'</radialGradient>')
            lines.append(f'<filter id="fpPieShadow-{uid}" x="-20%" y="-20%" width="140%" height="140%">'
                         f'<feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>'
                         f'</filter>')
            lines.append('</defs>')

            # Pie group with hover dimming via CSS
            pie_cx_css = f"{pcx:.1f}px"
            pie_cy_css = f"{pcy:.1f}px"
            lines.append(f'<g class="fp-pie-group" filter="url(#fpPieShadow-{uid})">')
            for si, s in enumerate(el.slices):
                anim_style = ""
                if animate:
                    delay = T_DATA + si * 0.1
                    anim_style = (f'--fp-pie-cx:{pie_cx_css};--fp-pie-cy:{pie_cy_css};'
                                  f'animation:fp-pieSliceIn 0.5s cubic-bezier(0.25,0.1,0.25,1) {delay:.2f}s both;')

                cos_s, sin_s = math.cos(s.start_angle), math.sin(s.start_angle)
                cos_e, sin_e = math.cos(s.end_angle), math.sin(s.end_angle)
                large = 1 if (s.end_angle - s.start_angle) > math.pi else 0

                if el.donut:
                    ox1, oy1 = pcx + pr * cos_s, pcy + pr * sin_s
                    ox2, oy2 = pcx + pr * cos_e, pcy + pr * sin_e
                    ix1, iy1 = pcx + inner_r * cos_s, pcy + inner_r * sin_s
                    ix2, iy2 = pcx + inner_r * cos_e, pcy + inner_r * sin_e
                    path = (f"M{ox1:.1f},{oy1:.1f} A{pr:.1f},{pr:.1f} 0 {large} 1 {ox2:.1f},{oy2:.1f} "
                            f"L{ix2:.1f},{iy2:.1f} A{inner_r:.1f},{inner_r:.1f} 0 {large} 0 {ix1:.1f},{iy1:.1f} Z")
                else:
                    sx, sy = pcx + pr * cos_s, pcy + pr * sin_s
                    ex, ey = pcx + pr * cos_e, pcy + pr * sin_e
                    path = f"M{pcx:.1f},{pcy:.1f} L{sx:.1f},{sy:.1f} A{pr:.1f},{pr:.1f} 0 {large} 1 {ex:.1f},{ey:.1f} Z"

                style_attr = f' style="{anim_style}"' if anim_style else ''
                lines.append(f'<path class="fp-pie-slice" d="{path}" fill="url(#fpPieGrad-{uid}-{si})" '
                             f'stroke="{theme.background}" stroke-width="1"{style_attr}/>')
            lines.append('</g>')

            # Percentage labels (smaller font, matching axis style)
            for si, s in enumerate(el.slices):
                if s.pct < 0.06:
                    continue
                label_r = pr * 0.65 if not el.donut else (pr + inner_r) / 2
                lx = pcx + label_r * math.cos(s.mid_angle)
                ly = pcy + label_r * math.sin(s.mid_angle)
                lbl_anim = ""
                if animate:
                    delay = T_DATA + 0.25 + si * 0.1
                    lbl_anim = f'animation:fp-pieLblIn 0.4s ease {delay:.2f}s both;'
                fill = theme.background if not el.donut else "#e0e0e0"
                lines.append(f'<text class="fp-pie-lbl" x="{lx:.1f}" y="{ly:.1f}" text-anchor="middle" '
                             f'dominant-baseline="central" font-size="8" font-weight="600" '
                             f'font-family="\'Inter\',sans-serif" fill="{fill}" style="{lbl_anim}">'
                             f'{s.pct * 100:.0f}%</text>')

            # Donut center label
            if el.donut:
                lbl_anim = ""
                if animate:
                    lbl_anim = f' style="animation:fp-refFade 0.5s ease {T_DATA + 0.4:.2f}s both"'
                lines.append(f'<text class="fp-title-text" x="{pcx:.1f}" y="{pcy:.1f}" text-anchor="middle" '
                             f'dominant-baseline="central" font-size="9" font-weight="500" '
                             f'font-family="\'Inter\',sans-serif" fill="{theme.text_primary}"{lbl_anim}>Total</text>')

    # ── Legend ────────────────────────────────────────────────────────────
    has_legend = sp.legend and sp.legend.entries
    if has_legend:
        # For pie charts, fade legend in after pie animation completes
        if is_pie_only and animate:
            n_pie_slices = sum(len(el.slices) for el in sp.elements if isinstance(el, PiePlotElement))
            leg_delay = T_DATA + max(0, n_pie_slices - 1) * 0.1 + 0.45
            lines.append(f'<g id="fp-legend-{uid}" style="opacity:0;animation:fp-refFade 0.5s ease {leg_delay:.2f}s both">')
        else:
            lines.append(f'<g id="fp-legend-{uid}">')

        if is_pie_only:
            # Pie charts: stacked legend right-aligned
            swatch_sz = 6
            font_sz = 8
            row_h = 14
            n_entries = len(sp.legend.entries)
            total_h = n_entries * row_h
            # Right-align: estimate max label width
            max_lbl_w = max(len(le.label) for le in sp.legend.entries) * (font_sz * 0.55)
            leg_right = pa.x + pa.w
            leg_x = leg_right - max_lbl_w - swatch_sz - 6
            leg_start_y = pa.y + (pa.h - total_h) * 0.35
            for li, le in enumerate(sp.legend.entries):
                ly = leg_start_y + li * row_h
                lines.append(f'  <rect x="{leg_x:.1f}" y="{ly:.1f}" width="{swatch_sz}" height="{swatch_sz}" rx="1" '
                             f'fill="{le.color}"/>')
                lines.append(f'  <text class="fp-legend-text" x="{leg_x + swatch_sz + 5:.1f}" y="{ly + swatch_sz / 2:.1f}" '
                             f'font-size="{font_sz}" font-weight="500" dominant-baseline="central" '
                             f'font-family="\'Inter\',sans-serif" fill="#808080">{_esc(le.label)}</text>')
        else:
            # Other charts: horizontal legend centered below x-axis
            item_gap = 16
            item_widths = []
            for le in sp.legend.entries:
                text_w = len(le.label) * 4.8
                item_widths.append(14 + 4 + text_w)
            max_row_w = w - pa.x * 2
            rows: list = []
            row_start = 0
            row_w = 0.0
            for i, iw in enumerate(item_widths):
                needed = iw + (item_gap if row_w > 0 else 0)
                if row_w > 0 and row_w + needed > max_row_w:
                    rows.append((row_start, i))
                    row_start = i
                    row_w = iw
                else:
                    row_w += needed
            rows.append((row_start, len(item_widths)))

            base_leg_y = pa.y + pa.h + 58
            for row_idx, (rs, re) in enumerate(rows):
                row_items = list(range(rs, re))
                row_total = sum(item_widths[j] for j in row_items) + item_gap * (len(row_items) - 1)
                row_x = pa.x + (pa.w - row_total) / 2
                leg_y = base_leg_y + row_idx * 18
                cur_x = row_x
                for li in row_items:
                    le = sp.legend.entries[li]
                    if le.kind == "bar" and le.bar_gradient:
                        lines.append(f'  <rect x="{cur_x:.1f}" y="{leg_y:.1f}" width="10" height="10" rx="2" '
                                     f'fill="{le.color}"/>')
                    elif le.kind == "scatter":
                        lines.append(f'  <circle cx="{cur_x + 5:.1f}" cy="{leg_y + 5:.1f}" r="3.5" fill="{le.color}"/>')
                    else:
                        da = dash_array(le.line_style) if le.line_style else None
                        extra = f' stroke-dasharray="{da}"' if da else ""
                        lines.append(f'  <line x1="{cur_x:.1f}" y1="{leg_y + 5:.1f}" x2="{cur_x + 12:.1f}" y2="{leg_y + 5:.1f}" '
                                     f'stroke="{le.color}" stroke-width="{le.line_width or 1.5}"{extra}/>')
                    lines.append(f'  <text class="fp-legend-text" x="{cur_x + 18:.1f}" y="{leg_y + 9:.1f}" font-size="9" font-weight="500" '
                                 f'font-family="\'Inter\',sans-serif" fill="#808080">{_esc(le.label)}</text>')
                    cur_x += item_widths[li] + item_gap
        lines.append('</g>')

    # ── Hover overlay (rendered last so it's on top of all elements) ───
    if hover:
        # Bar tooltips in a named container, triggered via CSS sibling selectors
        if deferred_bar_tooltips:
            lines.append(f'<g id="fp-bto-{uid}" style="pointer-events:none">')
            for tip in deferred_bar_tooltips:
                lines.append(tip)
            lines.append("</g>")
        lines.append(_build_line_hover_overlay(sp, uid))
        lines.append(_build_scatter_hover_overlay(sp, uid))

    # Finalize inline styles
    if hover:
        style_parts = [
            "<style>",
            ".fp-tip-content{opacity:0;pointer-events:none;transition:opacity .12s ease}",
            ".fp-tip:hover .fp-tip-content{opacity:1}",
            ".fp-bar-tip{opacity:0;transition:opacity .12s ease}",
        ]
        style_parts.extend(bar_tip_css_rules)
        style_parts.append("</style>")
        lines[style_insert_idx] = "\n".join(style_parts)


    # ── Settings dropdown button (rendered last, on top of everything) ──
    btn_x = w - 22
    btn_y = 10
    panel_w = 130
    panel_h = 120
    chev_scale = 'l4 4 l4 -4'
    btn_sz = 16
    panel_x = w - panel_w - 6
    panel_y = btn_y + btn_sz + 2

    # Chevron button
    lines.append(f'<g id="fp-cfg-btn-{uid}" cursor="pointer" '
                 f'onclick="(function(e){{var s=e.currentTarget.ownerSVGElement;'
                 f'var p=s.getElementById(\'fp-cfg-panel-{uid}\');'
                 f'var v=p.getAttribute(\'display\')===\'none\';'
                 f'p.setAttribute(\'display\',v?\'block\':\'none\');'
                 f'}})(event)">')
    lines.append(f'  <rect x="{btn_x - 2:.1f}" y="{btn_y - 2:.1f}" width="{btn_sz}" height="{btn_sz}" rx="3" '
                 f'fill="transparent"/>')
    lines.append(f'  <path class="fp-cfg-chevron" d="M{btn_x:.1f} {btn_y + 2:.1f} {chev_scale}" fill="none" '
                 f'stroke="#606060" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>')
    lines.append('</g>')

    # Settings panel (hidden by default)
    lines.append(f'<g id="fp-cfg-panel-{uid}" display="none">')
    lines.append(f'  <rect class="fp-panel-bg" x="{panel_x:.1f}" y="{panel_y:.1f}" width="{panel_w}" height="{panel_h}" '
                 f'rx="4" fill="#1a1a1a" stroke="#2a2a2a" stroke-width="0.5"/>')

    toggle_items = [
        ("Grid Lines", f"fp-grid-{uid}", True),
        ("Axis Labels", f"fp-axis-{uid}", True),
        ("Legend", f"fp-legend-{uid}", bool(has_legend)),
    ]

    tog_row = 24
    tog_font = 9
    tog_ck = 12
    for ti, (label, target_id, enabled) in enumerate(toggle_items):
        ry = panel_y + 10 + ti * tog_row
        check_x = panel_x + 10
        check_y = ry
        text_x = check_x + tog_ck + 8
        text_y = ry + tog_ck * 0.7

        # Legend toggle also adjusts SVG viewBox height
        is_legend_toggle = target_id == f"fp-legend-{uid}"
        legend_vb_js = ""
        if is_legend_toggle:
            legend_vb_js = (
                f"var vb=s.getAttribute('viewBox').split(' ').map(Number);"
                f"vb[3]=vis?vb[3]-{legend_extra_h}:vb[3]+{legend_extra_h};"
                f"s.setAttribute('viewBox',vb.join(' '));"
                f"var bg=s.querySelector('.fp-bg');"
                f"if(bg)bg.setAttribute('height',vb[3]);"
            )

        lines.append(f'  <g id="fp-tog-{uid}-{ti}" cursor="pointer" '
                     f'onclick="(function(e){{var s=e.currentTarget.ownerSVGElement;'
                     f'var t=s.getElementById(\'{target_id}\');'
                     f'if(!t)return;'
                     f'var vis=t.getAttribute(\'display\')!==\'none\';'
                     f't.setAttribute(\'display\',vis?\'none\':\'block\');'
                     f'var ck=e.currentTarget.querySelector(\'.fp-ck\');'
                     f'ck.setAttribute(\'opacity\',vis?\'0\':\'1\');'
                     f'{legend_vb_js}'
                     f'}})(event)">')
        lines.append(f'    <rect class="fp-panel-check-box" x="{check_x:.1f}" y="{check_y:.1f}" width="{tog_ck}" height="{tog_ck}" rx="2" '
                     f'fill="none" stroke="#494949" stroke-width="0.8"/>')
        opacity = "1" if enabled else "0"
        ck_s = tog_ck / 14  # scale factor relative to default 14px
        lines.append(f'    <path class="fp-ck fp-panel-check-mark" d="M{check_x + 3 * ck_s:.1f} {check_y + 7 * ck_s:.1f} l{3 * ck_s:.1f} {3 * ck_s:.1f} l{5 * ck_s:.1f} {-6 * ck_s:.1f}" '
                     f'fill="none" stroke="#808080" stroke-width="1.2" stroke-linecap="round" '
                     f'stroke-linejoin="round" opacity="{opacity}"/>')
        lines.append(f'    <text class="fp-panel-text" x="{text_x:.1f}" y="{text_y:.1f}" font-size="{tog_font}" font-weight="500" '
                     f'font-family="\'Inter\',sans-serif" fill="#808080">{label}</text>')
        lines.append('  </g>')

    # ── Theme toggle (Dark / Light) ───────────────────────────────────
    # Separator line
    sep_y = panel_y + 10 + len(toggle_items) * tog_row
    lines.append(f'  <line x1="{panel_x + 10:.1f}" y1="{sep_y:.1f}" x2="{panel_x + panel_w - 10:.1f}" y2="{sep_y:.1f}" '
                 f'stroke="#2a2a2a" stroke-width="0.5" class="fp-panel-check-box"/>')

    theme_y = sep_y + 6
    # Dark label
    _pill_pad = 8
    dark_x = panel_x + _pill_pad
    light_x = panel_x + panel_w / 2 + 1
    pill_w = panel_w / 2 - _pill_pad - 1
    pill_h = 18
    theme_text_y = theme_y + pill_h / 2  # vertical center of pill

    # Theme toggle JS: swaps SVG class, updates parent div bg, toggles pill + surfaces
    theme_js = (
        f"(function(e){{"
        f"var s=e.currentTarget.ownerSVGElement;"
        f"var isDark=s.getAttribute('class').indexOf('fp-dark')>=0;"
        f"var mode=e.currentTarget.getAttribute('data-mode');"
        f"if((mode==='dark'&&isDark)||(mode==='light'&&!isDark))return;"
        # Preserve fp-3d-active class when switching themes
        f"var is3d=s.classList.contains('fp-3d-active');"
        f"s.setAttribute('class',(mode==='dark'?'fp-dark':'fp-light')+(is3d?' fp-3d-active':''));"
        f"var bg=s.querySelector('.fp-bg');"
        f"bg.setAttribute('fill',mode==='dark'?'{theme.background}':'#f8f8f8');"
        f"var div=s.parentElement;"
        f"if(div&&div.tagName==='DIV')div.style.background=mode==='dark'?'{theme.background}':'#f8f8f8';"
        f"var dp=s.getElementById('fp-theme-dark-{uid}');"
        f"var lp=s.getElementById('fp-theme-light-{uid}');"
        f"var pc=mode==='dark'?'#2a2a2a':'#e8e8e8';"
        f"dp.setAttribute('fill',mode==='dark'?pc:'none');"
        f"lp.setAttribute('fill',mode==='light'?pc:'none');"
        # Only swap surface groups if NOT in 3D mode
        f"if(!is3d){{"
        f"var sd=s.querySelectorAll('.fp-surface-dark');"
        f"var sl=s.querySelectorAll('.fp-surface-light');"
        f"for(var i=0;i<sd.length;i++)sd[i].setAttribute('display',mode==='dark'?'block':'none');"
        f"for(var i=0;i<sl.length;i++)sl[i].setAttribute('display',mode==='light'?'block':'none');"
        f"}}"
        f"}})(event)"
    )

    # Dark pill
    lines.append(f'  <g cursor="pointer" data-mode="dark" onclick="{theme_js}">')
    lines.append(f'    <rect id="fp-theme-dark-{uid}" x="{dark_x:.1f}" y="{theme_y:.1f}" '
                 f'width="{pill_w:.1f}" height="{pill_h}" rx="3" fill="#2a2a2a"/>')
    _pill_fs = 8
    lines.append(f'    <text class="fp-panel-text" x="{dark_x + pill_w / 2:.1f}" y="{theme_text_y:.1f}" '
                 f'text-anchor="middle" dominant-baseline="central" font-size="{_pill_fs}" font-weight="600" '
                 f'font-family="\'Inter\',sans-serif" fill="#808080">Dark</text>')
    lines.append('  </g>')

    # Light pill
    lines.append(f'  <g cursor="pointer" data-mode="light" onclick="{theme_js}">')
    lines.append(f'    <rect id="fp-theme-light-{uid}" x="{light_x:.1f}" y="{theme_y:.1f}" '
                 f'width="{pill_w:.1f}" height="{pill_h}" rx="3" fill="none"/>')
    lines.append(f'    <text class="fp-panel-text" x="{light_x + pill_w / 2:.1f}" y="{theme_text_y:.1f}" '
                 f'text-anchor="middle" dominant-baseline="central" font-size="{_pill_fs}" font-weight="600" '
                 f'font-family="\'Inter\',sans-serif" fill="#808080">Light</text>')
    lines.append('  </g>')

    lines.append('</g>')

    # ── 3D toggle button (only for charts with surface plots) ─────────
    has_surface = any(isinstance(el, SurfacePlotElement) for el in sp.elements)
    if has_surface:
        tb_w, tb_h = 32, 20
        tb_x = w - tb_w - 10
        tb_y = h - tb_h - 8
        lines.append(f'<g id="fp-3d-btn-{uid}" cursor="pointer" '
                     f'onclick="(function(e){{'
                     f'var s=e.currentTarget.ownerSVGElement;'
                     f'var ev=new CustomEvent(\'fp-toggle3d\',{{detail:{{uid:\'{uid}\'}}}});'
                     f's.dispatchEvent(ev);'
                     f'}})(event)">')
        lines.append(f'  <rect class="fp-panel-bg" x="{tb_x:.1f}" y="{tb_y:.1f}" '
                     f'width="{tb_w}" height="{tb_h}" rx="5" '
                     f'fill="#1e1e1e" stroke="#3a3a3a" stroke-width="0.5"/>')
        lines.append(f'  <text id="fp-3d-lbl-{uid}" class="fp-panel-text" '
                     f'x="{tb_x + tb_w / 2:.1f}" y="{tb_y + 14:.1f}" '
                     f'text-anchor="middle" font-size="10" font-weight="700" '
                     f'font-family="\'Inter\',sans-serif" fill="#707070">3D</text>')
        lines.append('</g>')

    lines.append("</svg>")
    return "\n".join(lines)


# ── Public API ──────────────────────────────────────────────────────────

def render_svg(scene: Scene, animate: bool = True, hover: bool = True) -> str:
    parts = []
    if animate or hover:
        parts.append(f'<style>{_CSS_ANIMATIONS}</style>')
    for i, sp in enumerate(scene.subplots):
        parts.append(_render_subplot(sp, animate, f"sp{i}", hover=hover))
    return "\n".join(parts)


_SURFACE_JS = r"""
(function(){
var svgs=document.querySelectorAll('svg');
for(var si=0;si<svgs.length;si++){(function(S){
  var descs=S.querySelectorAll('desc[id^="fp-sdata-"]');
  if(!descs.length)return;
  descs.forEach(function(desc){
    var uid=desc.id.replace('fp-sdata-','');
    var cfg=JSON.parse(desc.textContent);
    var Z=cfg.z,R=cfg.rows,C=cfg.cols;
    var az=cfg.az,el=cfg.el,wf=cfg.wf;
    var initAz=az,initEl=el;
    var pa=cfg.pa,zMn=cfg.zMn,zMx=cfg.zMx,zR=zMx-zMn||1;
    var dc=cfg.dc,lc=cfg.lc;
    var xMn=cfg.xMn,xMx=cfg.xMx,yMn=cfg.yMn,yMx=cfg.yMx;
    var baseSc=Math.min(pa.w,pa.h)*.38;
    var zoom=1.0,minZoom=0.4,maxZoom=3.0;
    var cx=pa.x+pa.w/2,cy=pa.y+pa.h/2;

    var gJ=S.querySelector('#fp-surfjs-'+uid);
    var gA3=S.querySelector('#fp-axes3d-'+uid);
    var gSD=S.querySelector('.fp-surface-dark');
    var gSL=S.querySelector('.fp-surface-light');
    var gA2=S.querySelector('[id="fp-axis-'+uid+'"]');
    var gG=S.querySelector('[id="fp-grid-'+uid+'"]');
    var btnLbl=S.querySelector('#fp-3d-lbl-'+uid);
    if(!gJ)return;

    var is3D=false;

    // Tooltip element (created once, reused)
    var tip=null;

    function proj(x,y,z){
      var sc=baseSc*zoom;
      var ca=Math.cos(az),sa=Math.sin(az),ce=Math.cos(el),se=Math.sin(el);
      var x1=x*ca-y*sa,y1=x*sa+y*ca;
      var y2=y1*ce-z*se,z2=y1*se+z*ce;
      return[cx+x1*sc,cy-z2*sc,y2];
    }

    function hL(a,b,t){
      var r1=parseInt(a.substr(1,2),16),g1=parseInt(a.substr(3,2),16),b1=parseInt(a.substr(5,2),16);
      var r2=parseInt(b.substr(1,2),16),g2=parseInt(b.substr(3,2),16),b2=parseInt(b.substr(5,2),16);
      var r=Math.round(r1+(r2-r1)*t),g=Math.round(g1+(g2-g1)*t),bl=Math.round(b1+(b2-b1)*t);
      return'#'+((1<<24)|(r<<16)|(g<<8)|bl).toString(16).substr(1);
    }

    function sC(zn,sh,cm){
      var t=Math.max(0,Math.min(1,zn)),n=cm.length-1,i=t*n,lo=Math.floor(i),hi=Math.min(lo+1,n);
      var c=hL(cm[lo],cm[hi],i-lo);
      var sf=.7+.3*Math.max(0,Math.min(1,sh));
      var r=parseInt(c.substr(1,2),16),g=parseInt(c.substr(3,2),16),b=parseInt(c.substr(5,2),16);
      return'#'+((1<<24)|(Math.min(255,Math.round(r*sf))<<16)|(Math.min(255,Math.round(g*sf))<<8)|Math.min(255,Math.round(b*sf))).toString(16).substr(1);
    }

    // Store face metadata for hover tooltips
    var faces=[];
    function render(){
      var P=[];
      for(var r=0;r<R;r++){P[r]=[];for(var c=0;c<C;c++){
        var nx=2*c/Math.max(C-1,1)-1,ny=2*r/Math.max(R-1,1)-1,nz=2*(Z[r][c]-zMn)/zR-1;
        P[r][c]=proj(nx,ny,nz);
      }}
      faces=[];
      for(var r=0;r<R-1;r++)for(var c=0;c<C-1;c++){
        var a=P[r][c],b=P[r][c+1],d=P[r+1][c],e=P[r+1][c+1];
        var za=(a[2]+b[2]+d[2]+e[2])/4;
        var zn=((Z[r][c]+Z[r][c+1]+Z[r+1][c]+Z[r+1][c+1])/4-zMn)/zR;
        var bx=b[0]-a[0],by=b[1]-a[1],dx=d[0]-a[0],dy=d[1]-a[1];
        // Store row/col for tooltip lookup
        faces.push({pts:[a,b,e,d],za:za,zn:zn,nm:bx*dy-by*dx,r:r,c:c});
      }
      faces.sort(function(a,b){return a.za-b.za});

      var dk=S.getAttribute('class').indexOf('fp-dark')>=0;
      var cm=dk?dc:lc,ws=dk?'#2a2a2a':'#d0d0d0';

      var h='';
      for(var i=0;i<faces.length;i++){
        var f=faces[i],sh=f.nm?0.5+0.5*(f.nm/(Math.abs(f.nm)+1e-6)):0.5;
        var fl=sC(f.zn,sh,cm);
        var d='M'+f.pts[0][0].toFixed(1)+','+f.pts[0][1].toFixed(1);
        for(var j=1;j<4;j++)d+=' L'+f.pts[j][0].toFixed(1)+','+f.pts[j][1].toFixed(1);
        h+='<path d="'+d+' Z" fill="'+fl+'" fill-opacity="0.85" data-fi="'+i+'"';
        if(wf)h+=' stroke="'+ws+'" stroke-width="0.3" stroke-opacity="0.5"';
        h+=' style="pointer-events:all"/>';
      }
      gJ.innerHTML=h;
      renderAxes(dk);
    }

    function fmtN(v){return Math.abs(v)<0.01?v.toExponential(2):v.toFixed(2);}

    function renderAxes(dk){
      var tc=dk?'#555':'#888',ac=dk?'#333':'#ccc',lc2=dk?'#666':'#999';
      var ff="font-size='8' font-weight='500' font-family=\"'Inter',sans-serif\"";
      var lf="font-size='9' font-weight='600' font-family=\"'Inter',sans-serif\"";
      // Axis endpoints
      var o=proj(-1,-1,-1),xE=proj(1,-1,-1),yE=proj(-1,1,-1),zE=proj(-1,-1,1);
      // Additional box edges
      var xyB=proj(1,1,-1),xzT=proj(1,-1,1),yzT=proj(-1,1,1);
      var h='';
      // Bottom face (ground plane)
      h+='<line x1="'+o[0].toFixed(1)+'" y1="'+o[1].toFixed(1)+'" x2="'+xE[0].toFixed(1)+'" y2="'+xE[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.5" stroke-opacity="0.6"/>';
      h+='<line x1="'+o[0].toFixed(1)+'" y1="'+o[1].toFixed(1)+'" x2="'+yE[0].toFixed(1)+'" y2="'+yE[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.5" stroke-opacity="0.6"/>';
      h+='<line x1="'+xE[0].toFixed(1)+'" y1="'+xE[1].toFixed(1)+'" x2="'+xyB[0].toFixed(1)+'" y2="'+xyB[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.3" stroke-opacity="0.3"/>';
      h+='<line x1="'+yE[0].toFixed(1)+'" y1="'+yE[1].toFixed(1)+'" x2="'+xyB[0].toFixed(1)+'" y2="'+xyB[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.3" stroke-opacity="0.3"/>';
      // Z axis (vertical)
      h+='<line x1="'+o[0].toFixed(1)+'" y1="'+o[1].toFixed(1)+'" x2="'+zE[0].toFixed(1)+'" y2="'+zE[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.5" stroke-opacity="0.6"/>';
      // Vertical edges
      h+='<line x1="'+xE[0].toFixed(1)+'" y1="'+xE[1].toFixed(1)+'" x2="'+xzT[0].toFixed(1)+'" y2="'+xzT[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.3" stroke-opacity="0.2"/>';
      h+='<line x1="'+yE[0].toFixed(1)+'" y1="'+yE[1].toFixed(1)+'" x2="'+yzT[0].toFixed(1)+'" y2="'+yzT[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.3" stroke-opacity="0.2"/>';

      // X ticks
      for(var i=0;i<=4;i++){
        var t=i/4,v=-1+2*t,p=proj(v,-1,-1);
        var lbl=fmtN(t*(xMx-xMn)+xMn);
        h+='<text x="'+p[0].toFixed(1)+'" y="'+(p[1]+14).toFixed(1)+'" text-anchor="middle" '+ff+' fill="'+tc+'">'+lbl+'</text>';
        h+='<line x1="'+p[0].toFixed(1)+'" y1="'+p[1].toFixed(1)+'" x2="'+p[0].toFixed(1)+'" y2="'+(p[1]+3).toFixed(1)+'" stroke="'+ac+'" stroke-width="0.5"/>';
      }
      // Y ticks
      for(var i=0;i<=4;i++){
        var t=i/4,v=-1+2*t,p=proj(-1,v,-1);
        var lbl=fmtN(t*(yMx-yMn)+yMn);
        h+='<text x="'+(p[0]-8).toFixed(1)+'" y="'+(p[1]+4).toFixed(1)+'" text-anchor="end" '+ff+' fill="'+tc+'">'+lbl+'</text>';
        h+='<line x1="'+p[0].toFixed(1)+'" y1="'+p[1].toFixed(1)+'" x2="'+(p[0]-3).toFixed(1)+'" y2="'+p[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.5"/>';
      }
      // Z ticks
      for(var i=0;i<=4;i++){
        var t=i/4,v=-1+2*t,p=proj(-1,-1,v);
        var lbl=fmtN(t*zR+zMn);
        h+='<text x="'+(p[0]-8).toFixed(1)+'" y="'+(p[1]+4).toFixed(1)+'" text-anchor="end" '+ff+' fill="'+tc+'">'+lbl+'</text>';
        h+='<line x1="'+p[0].toFixed(1)+'" y1="'+p[1].toFixed(1)+'" x2="'+(p[0]-3).toFixed(1)+'" y2="'+p[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.5"/>';
      }

      // Axis labels
      var xM=proj(0,-1,-1),yM=proj(-1,0,-1),zM=proj(-1,-1,0);
      h+='<text x="'+xM[0].toFixed(1)+'" y="'+(xM[1]+26).toFixed(1)+'" text-anchor="middle" '+lf+' fill="'+lc2+'">X</text>';
      h+='<text x="'+(yM[0]-18).toFixed(1)+'" y="'+(yM[1]+4).toFixed(1)+'" text-anchor="end" '+lf+' fill="'+lc2+'">Y</text>';
      h+='<text x="'+(zM[0]-18).toFixed(1)+'" y="'+(zM[1]+4).toFixed(1)+'" text-anchor="end" '+lf+' fill="'+lc2+'">Z</text>';

      // Ground plane grid lines (subtle)
      for(var i=1;i<4;i++){
        var t=i/4,v=-1+2*t;
        var a=proj(v,-1,-1),b2=proj(v,1,-1);
        h+='<line x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b2[0].toFixed(1)+'" y2="'+b2[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.3" stroke-opacity="0.2"/>';
        var c=proj(-1,v,-1),d2=proj(1,v,-1);
        h+='<line x1="'+c[0].toFixed(1)+'" y1="'+c[1].toFixed(1)+'" x2="'+d2[0].toFixed(1)+'" y2="'+d2[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.3" stroke-opacity="0.2"/>';
      }

      // Back wall grid (z-axis plane, subtle)
      for(var i=1;i<4;i++){
        var t=i/4,v=-1+2*t;
        var a=proj(-1,-1,v),b2=proj(1,-1,v);
        h+='<line x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b2[0].toFixed(1)+'" y2="'+b2[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.2" stroke-opacity="0.12"/>';
        var c=proj(-1,-1,v),d2=proj(-1,1,v);
        h+='<line x1="'+c[0].toFixed(1)+'" y1="'+c[1].toFixed(1)+'" x2="'+d2[0].toFixed(1)+'" y2="'+d2[1].toFixed(1)+'" stroke="'+ac+'" stroke-width="0.2" stroke-opacity="0.12"/>';
      }

      gA3.innerHTML=h;
    }

    // ── Tooltip ─────────────────────────────────────────────────────────
    function showTip(mx,my,fi){
      var f=faces[fi]; if(!f)return;
      var r=f.r,c=f.c;
      var xv=(c+0.5)/Math.max(C-1,1)*(xMx-xMn)+xMn;
      var yv=(r+0.5)/Math.max(R-1,1)*(yMx-yMn)+yMn;
      var zv=(Z[r][c]+Z[r][c+1]+Z[r+1][c]+Z[r+1][c+1])/4;
      var dk=S.getAttribute('class').indexOf('fp-dark')>=0;
      var bg=dk?'rgba(30,30,30,0.92)':'rgba(255,255,255,0.92)';
      var bd=dk?'#444':'#ccc';var tc2=dk?'#ccc':'#333';var tc3=dk?'#888':'#666';

      if(!tip){
        tip=document.createElementNS('http://www.w3.org/2000/svg','g');
        tip.setAttribute('pointer-events','none');
        tip.setAttribute('id','fp-tip3d-'+uid);
        S.appendChild(tip);
      }
      var tw=80,th=42,tx=mx+10,ty=my-th-6;
      // Keep tooltip in view
      var vb=S.getAttribute('viewBox').split(' ').map(Number);
      if(tx+tw>vb[2])tx=mx-tw-10;
      if(ty<0)ty=my+10;

      var h='<rect x="'+tx+'" y="'+ty+'" width="'+tw+'" height="'+th+'" rx="3" fill="'+bg+'" stroke="'+bd+'" stroke-width="0.5"/>';
      h+='<text x="'+(tx+6)+'" y="'+(ty+12)+'" font-size="7" font-weight="600" font-family="\'Inter\',sans-serif" fill="'+tc2+'">';
      h+='x: '+fmtN(xv)+'</text>';
      h+='<text x="'+(tx+6)+'" y="'+(ty+23)+'" font-size="7" font-weight="600" font-family="\'Inter\',sans-serif" fill="'+tc2+'">';
      h+='y: '+fmtN(yv)+'</text>';
      h+='<text x="'+(tx+6)+'" y="'+(ty+34)+'" font-size="7" font-weight="600" font-family="\'Inter\',sans-serif" fill="'+tc2+'">';
      h+='z: '+fmtN(zv)+'</text>';
      tip.innerHTML=h;
      tip.setAttribute('display','block');
    }
    function hideTip(){if(tip)tip.setAttribute('display','none');}

    // Toggle between 2D static and 3D interactive
    function enter3D(){
      is3D=true;
      S.classList.add('fp-3d-active');
      if(gA2)gA2.setAttribute('display','none');
      if(gG)gG.setAttribute('display','none');
      gJ.setAttribute('display','block');
      gA3.setAttribute('display','block');
      if(btnLbl)btnLbl.textContent='2D';
      S.style.cursor='grab';
      render();
    }
    function exit3D(){
      is3D=false;
      cancelAnimationFrame(aId);
      hideTip();
      S.classList.remove('fp-3d-active');
      gJ.innerHTML='';gJ.setAttribute('display','none');
      gA3.innerHTML='';gA3.setAttribute('display','none');
      var dk=S.getAttribute('class').indexOf('fp-dark')>=0;
      if(gSD)gSD.setAttribute('display',dk?'block':'none');
      if(gSL)gSL.setAttribute('display',dk?'none':'block');
      if(gA2)gA2.setAttribute('display','block');
      if(gG)gG.setAttribute('display','block');
      if(btnLbl)btnLbl.textContent='3D';
      S.style.cursor='';
    }
    S.addEventListener('fp-toggle3d',function(e){
      if(e.detail&&e.detail.uid===uid){is3D?exit3D():enter3D();}
    });

    // ── Drag rotation ───────────────────────────────────────────────────
    var drag=false,sX,sY,sAz,sEl,vAz=0,vEl=0,aId=0;
    var vb=S.getAttribute('viewBox').split(' ').map(Number);

    function svgXY(e){
      var r=S.getBoundingClientRect();
      return[(e.clientX-r.left)/r.width*vb[2],(e.clientY-r.top)/r.height*vb[3]];
    }
    function inPA(mx,my){return mx>=pa.x&&mx<=pa.x+pa.w&&my>=pa.y&&my<=pa.y+pa.h;}

    S.addEventListener('mousedown',function(e){
      if(!is3D)return;
      var m=svgXY(e);if(!inPA(m[0],m[1]))return;
      drag=true;sX=e.clientX;sY=e.clientY;sAz=az;sEl=el;
      vAz=0;vEl=0;cancelAnimationFrame(aId);
      hideTip();
      S.style.cursor='grabbing';e.preventDefault();
    });
    document.addEventListener('mousemove',function(e){
      if(!drag)return;
      var pAz=az,pEl=el;
      az=sAz+(e.clientX-sX)*.005;
      el=Math.max(-1.5,Math.min(1.5,sEl+(e.clientY-sY)*.005));
      vAz=az-pAz;vEl=el-pEl;render();
    });
    document.addEventListener('mouseup',function(){
      if(!drag)return;drag=false;S.style.cursor='grab';
      // Inertia
      (function m(){if(Math.abs(vAz)<.0002&&Math.abs(vEl)<.0002)return;
        az+=vAz;el=Math.max(-1.5,Math.min(1.5,el+vEl));
        vAz*=.92;vEl*=.92;render();aId=requestAnimationFrame(m);})();
    });

    // ── Hover tooltip on faces ──────────────────────────────────────────
    S.addEventListener('mousemove',function(e){
      if(!is3D||drag)return;
      var tgt=e.target;
      if(tgt&&tgt.hasAttribute&&tgt.hasAttribute('data-fi')){
        var m=svgXY(e);
        showTip(m[0],m[1],parseInt(tgt.getAttribute('data-fi')));
      }else{hideTip();}
    });
    S.addEventListener('mouseleave',function(){hideTip();});

    // ── Scroll to zoom ──────────────────────────────────────────────────
    S.addEventListener('wheel',function(e){
      if(!is3D)return;
      var m=svgXY(e);if(!inPA(m[0],m[1]))return;
      e.preventDefault();
      var d=e.deltaY>0?-0.08:0.08;
      zoom=Math.max(minZoom,Math.min(maxZoom,zoom+d));
      render();
    },{passive:false});

    // ── Double-click to reset view ──────────────────────────────────────
    S.addEventListener('dblclick',function(e){
      if(!is3D)return;
      var m=svgXY(e);if(!inPA(m[0],m[1]))return;
      e.preventDefault();cancelAnimationFrame(aId);
      // Animate back to initial view
      var startAz=az,startEl=el,startZoom=zoom;
      var tAz=initAz,tEl=initEl,tZoom=1.0;
      var t0=performance.now(),dur=400;
      (function anim(now){
        var p=Math.min(1,(now-t0)/dur);
        // ease-out cubic
        var ep=1-Math.pow(1-p,3);
        az=startAz+(tAz-startAz)*ep;
        el=startEl+(tEl-startEl)*ep;
        zoom=startZoom+(tZoom-startZoom)*ep;
        render();
        if(p<1)requestAnimationFrame(anim);
      })(performance.now());
    });

    // ── Touch: drag + pinch-to-zoom ─────────────────────────────────────
    var pinch=false,pinchD0=0;
    S.addEventListener('touchstart',function(e){
      if(!is3D)return;
      if(e.touches.length===2){
        // Pinch start
        pinch=true;drag=false;
        var dx=e.touches[0].clientX-e.touches[1].clientX;
        var dy=e.touches[0].clientY-e.touches[1].clientY;
        pinchD0=Math.sqrt(dx*dx+dy*dy);
        e.preventDefault();return;
      }
      if(e.touches.length!==1)return;var t=e.touches[0];
      var m=svgXY(t);if(!inPA(m[0],m[1]))return;
      drag=true;sX=t.clientX;sY=t.clientY;sAz=az;sEl=el;
      vAz=0;vEl=0;cancelAnimationFrame(aId);e.preventDefault();
    },{passive:false});
    document.addEventListener('touchmove',function(e){
      if(pinch&&e.touches.length===2){
        var dx=e.touches[0].clientX-e.touches[1].clientX;
        var dy=e.touches[0].clientY-e.touches[1].clientY;
        var d=Math.sqrt(dx*dx+dy*dy);
        var scale=d/pinchD0;
        zoom=Math.max(minZoom,Math.min(maxZoom,zoom*scale));
        pinchD0=d;render();e.preventDefault();return;
      }
      if(!drag||e.touches.length!==1)return;var t=e.touches[0];
      var pAz=az,pEl=el;
      az=sAz+(t.clientX-sX)*.005;
      el=Math.max(-1.5,Math.min(1.5,sEl+(t.clientY-sY)*.005));
      vAz=az-pAz;vEl=el-pEl;render();e.preventDefault();
    },{passive:false});
    document.addEventListener('touchend',function(e){
      if(pinch){pinch=false;return;}
      if(!drag)return;drag=false;
      (function m(){if(Math.abs(vAz)<.0002&&Math.abs(vEl)<.0002)return;
        az+=vAz;el=Math.max(-1.5,Math.min(1.5,el+vEl));
        vAz*=.92;vEl*=.92;render();aId=requestAnimationFrame(m);})();
    });
  });
})(svgs[si]);}
})();
"""


def render_html(scene: Scene, animate: bool = True, hover: bool = True) -> str:
    theme = get_theme(scene.theme_name)
    svg = render_svg(scene, animate, hover=hover)
    # Check if any subplot has surface elements
    has_surface = any(
        isinstance(el, SurfacePlotElement)
        for sp in scene.subplots for el in sp.elements
    )
    surface_script = f"\n<script>{_SURFACE_JS}</script>" if has_surface else ""
    return f"""<div style="background:{theme.background};padding:16px;border-radius:8px;max-width:660px;">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif&display=swap');
{_CSS_ANIMATIONS}
</style>
{svg}
</div>{surface_script}"""
