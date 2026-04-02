"""Pure Python Flash Plot engine — renders SVG charts matching the TypeScript FlashChart frontend.

Produces SVGs identical in style to the NewFlash charting engine:
same fonts, colors, bar glow effects, animations, and layout.
Works in Colab, Jupyter, or any Python environment.
"""

from __future__ import annotations

import math
import html as _html
from typing import List, Optional, Tuple, Union, Any

# ── Theme: FLASH_DARK (exact match of src/lib/plot/core/theme.ts) ─────────

BACKGROUND = "#121212"
SURFACE = "#0f0f0f"

TEXT_PRIMARY = "#ffffff"
TEXT_SECONDARY = "#8f8f8f"
TEXT_MUTED = "#494949"
TEXT_AXIS = "#494949"

GRID_COLOR = "#2a2a2a"
GRID_WIDTH = 0.3

TITLE_FONT = "'EB Garamond', 'Times New Roman', Georgia, serif"
TITLE_SIZE = 18
TITLE_WEIGHT = 400
TITLE_SPACING = "-0.2px"
TITLE_COLOR = TEXT_PRIMARY

SUBTITLE_FONT = "'Inter', sans-serif"
SUBTITLE_SIZE = 11
SUBTITLE_WEIGHT = 400
SUBTITLE_SPACING = "-0.1px"
SUBTITLE_COLOR = "#555555"

AXIS_FONT = "'Inter', sans-serif"
AXIS_SIZE = 10
AXIS_WEIGHT = 500
AXIS_SPACING = "-0.12px"

LEGEND_FONT = "'Inter', sans-serif"
LEGEND_SIZE = 11
LEGEND_TEXT_COLOR = TEXT_SECONDARY

TOOLTIP_BG = "#1a1a1a"
TOOLTIP_BORDER = "#2a2a2a"
TOOLTIP_TEXT = "#a0a0a0"
TOOLTIP_HEADER = "#808080"

# ── Bar theme styles (exact match of theme.ts bar.styles) ─────────────────

BAR_DEFAULT_FILL = "#1e1f24"

BAR_STYLES = [
    {
        "fill": "#EF8CFF",
        "sideGlow": "#624096",
        "topGlow": "#763AA4",
        "bottomGlow": "#7B42DD",
        "leftEdge": "#7432E6",
        "sparkle": "#E49BFF",
        "gradTop": "#e586fa",
        "gradBottom": "#884f94",
    },
    {
        "fill": "#8CA5FF",
        "sideGlow": "#405A96",
        "topGlow": "#3A5FA4",
        "bottomGlow": "#427BDD",
        "leftEdge": "#3268E6",
        "sparkle": "#9BB6FF",
        "gradTop": "#86bafa",
        "gradBottom": "#4f7194",
    },
]

# ── Per-chart-type color palettes (exact match of renderChart.ts) ─────────

COLOR_PALETTES = {
    "line": ["#d4d4d4", "#707070", "#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#FCA5A5"],
    "bar": ["#EF8CFF", "#8CA5FF", "#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC"],
    "scatter": ["#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#d4d4d4"],
    "area": ["#4ECDC4", "#C084FC", "#FFD93D", "#FF6B6B", "#67E8F9", "#d4d4d4"],
    "histogram": ["#C084FC", "#4ECDC4", "#FFD93D"],
    "pie": ["#4aaaba", "#d8b4fe", "#fbbf24", "#f9a8d4", "#6dd5c8", "#a5f3d8", "#C084FC", "#FF6B6B", "#67E8F9", "#FFD93D"],
}

# ── Layout constants (exact match of layout.ts) ──────────────────────────

DEFAULT_WIDTH = 595
DEFAULT_HEIGHT = 260
DEFAULT_PADDING = {"top": 4, "right": 16, "bottom": 28, "left": 32}
DEFAULT_INSET = 16

# ── Area gradient settings (exact match of theme.ts) ─────────────────────

AREA_GRAD_TOP = 0.15
AREA_GRAD_BOTTOM = 0.05

# ── Sparkle dot positions (from FlashChart.tsx) ──────────────────────────

SPARKLE_DOTS = [
    {"cx": 0.75, "cy": 0.761, "r": 1},
    {"cx": 0.315, "cy": 0.843, "r": 1},
    {"cx": 0.675, "cy": 0.780, "r": 0.5},
    {"cx": 0.459, "cy": 0.846, "r": 0.5},
    {"cx": 0.238, "cy": 0.685, "r": 0.75},
    {"cx": 0.45, "cy": 0.649, "r": 1},
    {"cx": 0.509, "cy": 0.870, "r": 1},
    {"cx": 0.558, "cy": 0.106, "r": 1},
    {"cx": 0.225, "cy": 0.623, "r": 0.5},
    {"cx": 0.331, "cy": 0.132, "r": 0.5},
    {"cx": 0.475, "cy": 0.668, "r": 0.5},
    {"cx": 0.626, "cy": 0.862, "r": 0.5},
    {"cx": 0.685, "cy": 0.107, "r": 0.5},
    {"cx": 0.138, "cy": 0.632, "r": 0.75},
    {"cx": 0.368, "cy": 0.147, "r": 0.75},
]

# ── CSS Animations (exact match of FlashChart.tsx FP_CSS) ────────────────

FP_CSS = """
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

/* Shimmer */
@keyframes fp-shimmer {
  0%, 100% { fill: var(--fp-base); }
  30% { fill: #787878; }
  50% { fill: #c4c4c4; }
  70% { fill: #787878; }
}

/* Glow drift animations */
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

/* Sparkle float animations */
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

/* Glow reveal */
@keyframes fp-glowReveal { from { opacity: 0; transform: scaleY(0); } to { opacity: 1; transform: scaleY(1); } }
@keyframes fp-glowFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Bar sweep */
@keyframes fp-barSweep {
  0% { opacity: 0; }
  30% { opacity: 1; }
  100% { opacity: 0; }
}
"""


# ── Helpers ────────────────────────────────────────────────────────────────

def _esc(s: str) -> str:
    return _html.escape(s, quote=True)


def _convert(obj: Any) -> Any:
    """Convert numpy arrays and scalars to plain Python types."""
    try:
        import numpy as np
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
    except ImportError:
        pass
    if isinstance(obj, (list, tuple)):
        return [_convert(x) for x in obj]
    return obj


def _nice_num(x: float, round_: bool) -> float:
    exp = math.floor(math.log10(abs(x))) if x != 0 else 0
    frac = x / (10 ** exp)
    if round_:
        if frac < 1.5:
            nice = 1
        elif frac < 3:
            nice = 2
        elif frac < 7:
            nice = 5
        else:
            nice = 10
    else:
        if frac <= 1:
            nice = 1
        elif frac <= 2:
            nice = 2
        elif frac <= 5:
            nice = 5
        else:
            nice = 10
    return nice * (10 ** exp)


def _compute_ticks(dmin: float, dmax: float, max_ticks: int = 6) -> List[float]:
    if dmin == dmax:
        return [dmin]
    range_ = _nice_num(dmax - dmin, False)
    step = _nice_num(range_ / max(max_ticks - 1, 1), True)
    lo = math.floor(dmin / step) * step
    hi = math.ceil(dmax / step) * step
    ticks = []
    t = lo
    while t <= hi + step * 0.5:
        ticks.append(round(t, 10))
        t += step
    return ticks


def _fmt_val(v: float) -> str:
    if abs(v) >= 1e6:
        return f"{v:.2e}"
    if abs(v) >= 100:
        return f"{v:,.0f}"
    if abs(v) >= 1:
        return f"{v:.2f}"
    if v == 0:
        return "0"
    return f"{v:.4g}"


def _dash_array(style: str) -> Optional[str]:
    if style == "dashed":
        return "8 4"
    if style == "dotted":
        return "2 3"
    if style == "dashdot":
        return "8 3 2 3"
    return None


# ── Command types ──────────────────────────────────────────────────────────

class _PlotCmd:
    def __init__(self, kind: str, **kw):
        self.kind = kind
        self.__dict__.update(kw)


# ── FlashPlot ──────────────────────────────────────────────────────────────

class FlashPlot:
    """Matplotlib-like API that renders SVG matching the Flash frontend. Works in Colab, Jupyter, or any Python env."""

    def __init__(self, width: int = DEFAULT_WIDTH, height: int = DEFAULT_HEIGHT):
        self.width = width
        self.height = height
        self._commands: List[_PlotCmd] = []
        self._title: Optional[str] = None
        self._subtitle: Optional[str] = None
        self._xticks: Optional[list] = None
        self._yticks: Optional[list] = None
        self._grid = False
        self._show_legend = False
        self._legend_kwargs: dict = {}
        self._series_idx = 0
        self._bar_series_idx = 0
        self._chart_type = "line"  # For palette selection

    # ── Plotting methods ───────────────────────────────────────────────

    def plot(self, y_data, *, x=None, color=None, label=None, line_width=1.5,
             line_style="solid", alpha=1.0, fill_opacity=None):
        y = _convert(y_data)
        xd = _convert(x) if x is not None else None
        palette = COLOR_PALETTES["line"]
        c = color or palette[self._series_idx % len(palette)]
        self._commands.append(_PlotCmd("line", y=y, x=xd, color=c, label=label,
                                        line_width=line_width, line_style=line_style,
                                        alpha=alpha, fill_opacity=fill_opacity))
        self._series_idx += 1
        return self

    def bar(self, x_labels, y_data, *, color=None, label=None, alpha=1.0):
        y = _convert(y_data)
        xl = _convert(x_labels)
        self._chart_type = "bar"
        palette = COLOR_PALETTES["bar"]
        c = color or palette[self._bar_series_idx % len(palette)]
        self._commands.append(_PlotCmd("bar", y=y, x_labels=xl, color=c, label=label,
                                        alpha=alpha, series_idx=self._bar_series_idx))
        self._bar_series_idx += 1
        self._series_idx += 1
        return self

    def scatter(self, x_data, y_data, *, color=None, label=None, size=4, alpha=1.0):
        xd = _convert(x_data)
        yd = _convert(y_data)
        palette = COLOR_PALETTES["scatter"]
        c = color or palette[self._series_idx % len(palette)]
        self._commands.append(_PlotCmd("scatter", x=xd, y=yd, color=c, label=label,
                                        size=size, alpha=alpha))
        self._series_idx += 1
        return self

    def hist(self, data, *, bins=10, color=None, label=None, alpha=1.0):
        d = _convert(data)
        palette = COLOR_PALETTES["histogram"]
        c = color or palette[self._bar_series_idx % len(palette)]
        self._commands.append(_PlotCmd("hist", data=d, bins=bins, color=c, label=label,
                                        alpha=alpha, series_idx=self._bar_series_idx))
        self._bar_series_idx += 1
        self._series_idx += 1
        return self

    def fill_between(self, x, y1, y2=0, *, color=None, alpha=0.15, label=None):
        xd = _convert(x)
        y1d = _convert(y1)
        y2d = _convert(y2)
        palette = COLOR_PALETTES["area"]
        c = color or palette[max(0, self._series_idx - 1) % len(palette)]
        self._commands.append(_PlotCmd("fill_between", x=xd, y1=y1d, y2=y2d, color=c,
                                        alpha=alpha, label=label))
        return self

    def axhline(self, y, *, color="#494949", line_width=1, line_style="dashed", alpha=1.0):
        self._commands.append(_PlotCmd("hline", y=y, color=color, line_width=line_width,
                                        line_style=line_style, alpha=alpha))
        return self

    def axvline(self, x, *, color="#494949", line_width=1, line_style="dashed", alpha=1.0):
        self._commands.append(_PlotCmd("vline", x=x, color=color, line_width=line_width,
                                        line_style=line_style, alpha=alpha))
        return self

    def text(self, x, y, content, *, color="#808080", font_size=10, anchor="start"):
        self._commands.append(_PlotCmd("text", x=x, y=y, content=content, color=color,
                                        font_size=font_size, anchor=anchor))
        return self

    def annotate(self, text, xy, *, xytext=None, color="#808080", font_size=9, arrow_color="#494949"):
        self._commands.append(_PlotCmd("annotate", text=text, xy=xy, xytext=xytext,
                                        color=color, font_size=font_size, arrow_color=arrow_color))
        return self

    # ── Config methods ─────────────────────────────────────────────────

    def set_title(self, title: str):
        self._title = title
        return self

    def set_subtitle(self, subtitle: str):
        self._subtitle = subtitle
        return self

    def set_xticks(self, ticks):
        self._xticks = _convert(ticks)
        return self

    def set_yticks(self, ticks):
        self._yticks = _convert(ticks)
        return self

    def grid(self, visible: bool = True):
        self._grid = visible
        return self

    def legend(self, **kwargs):
        self._show_legend = True
        self._legend_kwargs = kwargs
        return self

    # ── Rendering ──────────────────────────────────────────────────────

    def render(self) -> str:
        """Render to SVG string."""
        return self._build_svg()

    def show(self):
        """Display inline in Jupyter/Colab."""
        svg = self.render()
        dark_html = f'<div style="background:{BACKGROUND};padding:16px 8px;border-radius:8px">{svg}</div>'
        try:
            from IPython.display import HTML, display
            display(HTML(dark_html))
        except ImportError:
            print(svg)

    def _repr_html_(self):
        """Auto-display in Jupyter."""
        svg = self.render()
        return f'<div style="background:{BACKGROUND};padding:16px 8px;border-radius:8px">{svg}</div>'

    # ── SVG Builder ────────────────────────────────────────────────────

    def _build_svg(self) -> str:
        pad = DEFAULT_PADDING
        inset = DEFAULT_INSET
        w, h = self.width, self.height

        pa_x = pad["left"] + inset
        pa_y = pad["top"] + inset
        pa_w = w - pad["left"] - pad["right"] - inset * 2
        pa_h = h - pad["top"] - pad["bottom"] - inset * 2

        # ── Collect data ranges ────────────────────────────────────────
        y_vals: List[float] = []
        x_nums: List[float] = []
        bar_cmds = [c for c in self._commands if c.kind in ("bar", "hist")]
        line_cmds = [c for c in self._commands if c.kind == "line"]
        scatter_cmds = [c for c in self._commands if c.kind == "scatter"]
        fill_cmds = [c for c in self._commands if c.kind == "fill_between"]
        hist_cmds = [c for c in self._commands if c.kind == "hist"]

        # Histogram bin computation
        hist_bars: List[dict] = []
        for cmd in hist_cmds:
            edges, counts = self._compute_hist_bins(cmd.data, cmd.bins)
            hist_bars.append({"edges": edges, "counts": counts, "cmd": cmd})
            y_vals.extend(counts)

        for cmd in line_cmds:
            y_vals.extend(cmd.y)
            if cmd.x:
                x_nums.extend(cmd.x)
        for cmd in scatter_cmds:
            y_vals.extend(cmd.y)
            x_nums.extend(cmd.x)
        for cmd in fill_cmds:
            if isinstance(cmd.y1, list):
                y_vals.extend(cmd.y1)
            if isinstance(cmd.y2, list):
                y_vals.extend(cmd.y2)
            elif isinstance(cmd.y2, (int, float)):
                y_vals.append(cmd.y2)
        for cmd in bar_cmds:
            if cmd.kind == "bar":
                y_vals.extend(cmd.y)

        if not y_vals:
            y_vals = [0, 1]
        y_min_data, y_max_data = min(y_vals), max(y_vals)
        if y_min_data == y_max_data:
            y_min_data -= 1
            y_max_data += 1

        # Y ticks
        if self._yticks:
            y_ticks = [float(t) for t in self._yticks]
            y_min = min(y_min_data, min(y_ticks))
            y_max = max(y_max_data, max(y_ticks))
        else:
            y_ticks = _compute_ticks(y_min_data, y_max_data)
            y_min = y_ticks[0]
            y_max = y_ticks[-1]

        y_range = y_max - y_min if y_max != y_min else 1

        def y_px(v: float) -> float:
            return pa_y + pa_h - ((v - y_min) / y_range) * pa_h

        # X range for numeric axes
        has_numeric_x = bool(x_nums) or bool(hist_bars)
        if x_nums:
            x_min_data, x_max_data = min(x_nums), max(x_nums)
        elif hist_bars:
            x_min_data = min(hb["edges"][0] for hb in hist_bars)
            x_max_data = max(hb["edges"][-1] for hb in hist_bars)
        else:
            x_min_data, x_max_data = 0, 1

        if has_numeric_x:
            if self._xticks and all(isinstance(t, (int, float)) for t in self._xticks):
                x_ticks_num = [float(t) for t in self._xticks]
                x_min = min(x_min_data, min(x_ticks_num))
                x_max = max(x_max_data, max(x_ticks_num))
            else:
                x_ticks_num = _compute_ticks(x_min_data, x_max_data)
                x_min = x_min_data
                x_max = x_max_data
        else:
            x_min, x_max = 0, 1
            x_ticks_num = []

        x_range = x_max - x_min if x_max != x_min else 1

        def x_px(v: float) -> float:
            return pa_x + ((v - x_min) / x_range) * pa_w

        # ── Timing constants (matching FlashChart.tsx) ────────────────
        T_LABELS = 0.675
        T_DATA = 1.28
        T_SHIMMER = 2.5
        SHIMMER_STEP = 0.08
        SHIMMER_DUR = 0.24

        # ── SVG parts ─────────────────────────────────────────────────
        parts: List[str] = []
        defs_parts: List[str] = []

        # Legend collection
        legend_entries: List[Tuple[str, str, str]] = []  # (color, label, type)

        # Track bar series indices for filter defs
        bar_series_used: set = set()

        # ── CSS animations ────────────────────────────────────────────
        parts.append(f'<style>{FP_CSS}</style>')

        # ── Title / Subtitle ──────────────────────────────────────────
        cur_y_top = 0.0
        if self._title:
            cur_y_top = TITLE_SIZE + 4
            parts.append(
                f'<text x="{pa_x}" y="{cur_y_top}" font-size="{TITLE_SIZE}" '
                f'font-weight="{TITLE_WEIGHT}" font-family="{TITLE_FONT}" '
                f'letter-spacing="{TITLE_SPACING}" fill="{TITLE_COLOR}" '
                f'style="animation:fp-refFade 0.6s ease 0s both">'
                f'{_esc(self._title)}</text>'
            )
        if self._subtitle:
            cur_y_top += SUBTITLE_SIZE + 6
            parts.append(
                f'<text x="{pa_x}" y="{cur_y_top}" font-size="{SUBTITLE_SIZE}" '
                f'font-weight="{SUBTITLE_WEIGHT}" font-family="{SUBTITLE_FONT}" '
                f'letter-spacing="{SUBTITLE_SPACING}" fill="{SUBTITLE_COLOR}" '
                f'style="animation:fp-refFade 0.6s ease 0.1s both">'
                f'{_esc(self._subtitle)}</text>'
            )

        # ── Grid ──────────────────────────────────────────────────────
        if self._grid:
            for gi, yt in enumerate(y_ticks):
                yp = y_px(yt)
                if pa_y <= yp <= pa_y + pa_h:
                    line_len = pa_w
                    parts.append(
                        f'<line x1="{pa_x}" y1="{yp:.1f}" x2="{pa_x + pa_w}" y2="{yp:.1f}" '
                        f'stroke="{GRID_COLOR}" stroke-width="{GRID_WIDTH}" '
                        f'style="--fp-len:{line_len};stroke-dasharray:{line_len};'
                        f'animation:fp-gridDraw 0.675s cubic-bezier(0.22,1,0.36,1) {gi * 0.08:.2f}s both"/>'
                    )

        # ── Y-axis labels (with shimmer animation) ───────────────────
        for yi, yt in enumerate(y_ticks):
            yp = y_px(yt)
            fade_delay = T_LABELS + yi * 0.04
            shimmer_delay = T_SHIMMER + yi * SHIMMER_STEP
            parts.append(
                f'<text x="{pa_x - 4}" y="{yp + 3:.1f}" text-anchor="end" '
                f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                f'fill="{TEXT_AXIS}" '
                f'style="--fp-base:{TEXT_AXIS};'
                f'animation:fp-labelFadeY 0.35s ease {fade_delay:.2f}s both,'
                f'fp-shimmer {SHIMMER_DUR}s ease {shimmer_delay:.2f}s 1">'
                f'{_esc(_fmt_val(yt))}</text>'
            )

        # ── Area / fill_between ───────────────────────────────────────
        area_idx = 0
        for cmd in fill_cmds:
            y1 = cmd.y1 if isinstance(cmd.y1, list) else [cmd.y1] * len(cmd.x)
            y2 = cmd.y2 if isinstance(cmd.y2, list) else [cmd.y2] * len(cmd.x)
            n = len(cmd.x)

            # Per-area gradient (matching FlashChart.tsx)
            grad_id = f"areaGrad-{area_idx}"
            defs_parts.append(
                f'<linearGradient id="{grad_id}" x1="0" y1="0" x2="0" y2="1">'
                f'<stop offset="0%" stop-color="{cmd.color}" stop-opacity="{AREA_GRAD_TOP}"/>'
                f'<stop offset="100%" stop-color="{cmd.color}" stop-opacity="{AREA_GRAD_BOTTOM}"/>'
                f'</linearGradient>'
            )

            pts_top = []
            pts_bot = []
            for i in range(n):
                if has_numeric_x:
                    xp = x_px(cmd.x[i])
                else:
                    xp = pa_x + (i / max(n - 1, 1)) * pa_w
                pts_top.append(f"{xp:.1f},{y_px(y1[i]):.1f}")
                pts_bot.append(f"{xp:.1f},{y_px(y2[i]):.1f}")
            fwd = " ".join(f"{'M' if i == 0 else 'L'}{p}" for i, p in enumerate(pts_top))
            bwd = " ".join(f"L{p}" for p in reversed(pts_bot))
            delay = T_DATA + area_idx * 0.135
            parts.append(
                f'<path d="{fwd} {bwd} Z" fill="url(#{grad_id})" opacity="{cmd.alpha}" '
                f'style="animation:fp-areaFade 1.08s ease {delay:.2f}s both"/>'
            )
            if cmd.label:
                legend_entries.append((cmd.color, cmd.label, "line"))
            area_idx += 1

        # ── Lines ─────────────────────────────────────────────────────
        line_idx = 0
        for cmd in line_cmds:
            n = len(cmd.y)
            pts = []
            for i in range(n):
                if cmd.x:
                    xp = x_px(cmd.x[i])
                elif self._xticks and isinstance(self._xticks[0], str):
                    xp = pa_x + (i / max(n - 1, 1)) * pa_w
                else:
                    xp = pa_x + (i / max(n - 1, 1)) * pa_w
                yp = y_px(cmd.y[i])
                pts.append(f"{'M' if i == 0 else 'L'}{xp:.1f},{yp:.1f}")

            path_d = " ".join(pts)
            da = _dash_array(cmd.line_style)
            delay = T_DATA + line_idx * 0.2

            # Draw-in animation (solid first, then apply dash if needed)
            parts.append(
                f'<path d="{path_d}" fill="none" stroke="{cmd.color}" '
                f'stroke-width="{cmd.line_width}" stroke-linejoin="round" '
                f'stroke-dasharray="2000" opacity="{cmd.alpha}" '
                f'style="animation:fp-lineDraw 1.89s cubic-bezier(0.22,1,0.36,1) {delay:.2f}s both"/>'
            )

            # If dashed, overlay the dash pattern after draw-in completes
            if da and cmd.line_style != "solid":
                dash_delay = delay + 1.89
                parts.append(
                    f'<path d="{path_d}" fill="none" stroke="{cmd.color}" '
                    f'stroke-width="{cmd.line_width}" stroke-linejoin="round" '
                    f'stroke-dasharray="{da}" opacity="{cmd.alpha}" '
                    f'style="animation:fp-areaFade 0.3s ease {dash_delay:.2f}s both"/>'
                )

            # Optional area fill under line
            if cmd.fill_opacity and cmd.fill_opacity > 0:
                base_y = y_px(0) if y_min <= 0 <= y_max else pa_y + pa_h
                last_pt = pts[-1].split(",")
                first_pt = pts[0][1:].split(",")
                area_d = f"{path_d} L{last_pt[0][1:]},{base_y:.1f} L{first_pt[0]},{base_y:.1f} Z"
                parts.append(f'<path d="{area_d}" fill="{cmd.color}" opacity="{cmd.fill_opacity}"/>')

            if cmd.label:
                legend_entries.append((cmd.color, cmd.label, "line"))
            line_idx += 1

        # ── Bars (grouped) with glow effects ──────────────────────────
        real_bar_cmds = [c for c in bar_cmds if c.kind == "bar"]
        if real_bar_cmds and not hist_bars:
            num_series = len(real_bar_cmds)
            all_labels = real_bar_cmds[0].x_labels if real_bar_cmds else []
            n_bars = len(all_labels) if all_labels else (len(real_bar_cmds[0].y) if real_bar_cmds else 0)
            bar_w = 18  # Match TS default bar width
            pair_gap = 3
            group_w = pa_w / max(n_bars, 1)
            pair_w = bar_w * num_series + pair_gap * (num_series - 1) if num_series > 1 else bar_w

            # Bar timing
            bar_sweep_start = T_DATA + 0.81 + n_bars * 0.054
            bar_sweep_step = 0.12

            si = 0
            for cmd in real_bar_cmds:
                style = BAR_STYLES[si % len(BAR_STYLES)]
                bar_series_used.add(si)

                for i, val in enumerate(cmd.y):
                    group_pad = (group_w - pair_w) / 2
                    bx = pa_x + i * group_w + group_pad + si * (bar_w + pair_gap)
                    bot = max(y_min, 0)
                    top_val = val
                    by_top = y_px(top_val)
                    by_bot = y_px(bot)
                    ay = min(by_top, by_bot)
                    ah = max(1, abs(by_top - by_bot))
                    bw = bar_w

                    delay = T_DATA + i * 0.054
                    origin_x = bx + bw / 2
                    origin_y = pa_y + pa_h

                    # Scale helper for glow proportions
                    def sc(hv, _ah=ah):
                        return (hv / 134) * _ah

                    # Base rect (dark fill) with grow animation
                    parts.append(
                        f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw}" height="{ah:.1f}" '
                        f'fill="{BAR_DEFAULT_FILL}" shape-rendering="crispEdges" '
                        f'style="transform-origin:{origin_x:.1f}px {origin_y:.1f}px;'
                        f'animation:fp-barGrow 0.81s cubic-bezier(0.22,1,0.36,1) {delay:.2f}s both"/>'
                    )

                    # Glow layers (clipped via nested svg, matching FlashChart.tsx)
                    glow_delay = delay + 0.3
                    glow_svg = self._render_bar_glow(bx, ay, bw, ah, si, style, glow_delay)
                    parts.append(glow_svg)

                if cmd.label:
                    legend_entries.append((style["fill"], cmd.label, "bar"))
                si += 1

            # X-axis labels for bars (with animation)
            if all_labels:
                for i, lbl in enumerate(all_labels):
                    cx = pa_x + (i + 0.5) * group_w
                    fade_delay = T_LABELS + i * 0.03
                    shimmer_delay = T_SHIMMER + i * SHIMMER_STEP
                    parts.append(
                        f'<text x="{cx:.1f}" y="{h - 4}" text-anchor="middle" '
                        f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                        f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                        f'fill="{TEXT_AXIS}" '
                        f'style="--fp-base:{TEXT_AXIS};'
                        f'animation:fp-labelFadeX 0.35s ease {fade_delay:.2f}s both,'
                        f'fp-shimmer {SHIMMER_DUR}s ease {shimmer_delay:.2f}s 1">'
                        f'{_esc(str(lbl))}</text>'
                    )

        # ── Histogram bars (with glow effects) ────────────────────────
        for hb in hist_bars:
            edges = hb["edges"]
            counts = hb["counts"]
            cmd = hb["cmd"]
            si = cmd.series_idx
            style = BAR_STYLES[si % len(BAR_STYLES)]
            bar_series_used.add(si)

            for i in range(len(counts)):
                bx_l = x_px(edges[i])
                bx_r = x_px(edges[i + 1])
                bw = bx_r - bx_l
                by_top = y_px(counts[i])
                by_bot = y_px(0) if y_min <= 0 else pa_y + pa_h
                ay = min(by_top, by_bot)
                ah = max(0.5, abs(by_top - by_bot))

                delay = T_DATA + i * 0.054
                origin_x = bx_l + bw / 2
                origin_y = pa_y + pa_h

                # Base rect with grow animation
                parts.append(
                    f'<rect x="{bx_l:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" '
                    f'fill="{BAR_DEFAULT_FILL}" shape-rendering="crispEdges" '
                    f'style="transform-origin:{origin_x:.1f}px {origin_y:.1f}px;'
                    f'animation:fp-barGrow 0.81s cubic-bezier(0.22,1,0.36,1) {delay:.2f}s both"/>'
                )

                # Glow layers
                glow_delay = delay + 0.3
                glow_svg = self._render_bar_glow(bx_l, ay, bw, ah, si, style, glow_delay)
                parts.append(glow_svg)

            if cmd.label:
                legend_entries.append((style["fill"], cmd.label, "bar"))

        # ── Scatter ───────────────────────────────────────────────────
        for cmd in scatter_cmds:
            for i in range(len(cmd.x)):
                xp = x_px(cmd.x[i])
                yp = y_px(cmd.y[i])
                r = math.sqrt(cmd.size) if isinstance(cmd.size, (int, float)) else 2
                pop_delay = T_DATA + i * 0.02
                parts.append(
                    f'<circle cx="{xp:.1f}" cy="{yp:.1f}" r="{r:.1f}" '
                    f'fill="{cmd.color}" opacity="{cmd.alpha}" '
                    f'style="animation:fp-scatterPop 0.5s ease {pop_delay:.2f}s both"/>'
                )
            if cmd.label:
                legend_entries.append((cmd.color, cmd.label, "scatter"))

        # ── HLine / VLine / Text / Annotate ───────────────────────────
        for cmd in self._commands:
            if cmd.kind == "hline":
                yp = y_px(cmd.y)
                da = _dash_array(cmd.line_style)
                da_attr = f' stroke-dasharray="{da}"' if da else ""
                parts.append(
                    f'<line x1="{pa_x}" y1="{yp:.1f}" x2="{pa_x + pa_w}" y2="{yp:.1f}" '
                    f'stroke="{cmd.color}" stroke-width="{cmd.line_width}"{da_attr} '
                    f'style="animation:fp-refFade 0.5s ease {T_DATA}s both"/>'
                )
            elif cmd.kind == "vline":
                xp = x_px(cmd.x)
                da = _dash_array(cmd.line_style)
                da_attr = f' stroke-dasharray="{da}"' if da else ""
                parts.append(
                    f'<line x1="{xp:.1f}" y1="{pa_y}" x2="{xp:.1f}" y2="{pa_y + pa_h}" '
                    f'stroke="{cmd.color}" stroke-width="{cmd.line_width}"{da_attr} '
                    f'style="animation:fp-refFade 0.5s ease {T_DATA}s both"/>'
                )
            elif cmd.kind == "text":
                parts.append(
                    f'<text x="{cmd.x}" y="{cmd.y}" text-anchor="{cmd.anchor}" '
                    f'font-size="{cmd.font_size}" font-family="{AXIS_FONT}" '
                    f'fill="{cmd.color}" '
                    f'style="animation:fp-refFade 0.5s ease 1.5s both">'
                    f'{_esc(cmd.content)}</text>'
                )
            elif cmd.kind == "annotate":
                ann_parts = []
                if cmd.xytext:
                    ann_parts.append(
                        f'<line x1="{cmd.xytext[0]}" y1="{cmd.xytext[1]}" '
                        f'x2="{cmd.xy[0]}" y2="{cmd.xy[1]}" '
                        f'stroke="{cmd.arrow_color}" stroke-width="1"/>'
                    )
                tx = cmd.xytext[0] if cmd.xytext else cmd.xy[0]
                ty = cmd.xytext[1] if cmd.xytext else cmd.xy[1]
                ann_parts.append(
                    f'<text x="{tx}" y="{ty}" font-size="{cmd.font_size}" '
                    f'font-family="{AXIS_FONT}" fill="{cmd.color}">'
                    f'{_esc(cmd.text)}</text>'
                )
                parts.append(
                    f'<g style="animation:fp-refFade 0.5s ease 1.5s both">'
                    f'{"".join(ann_parts)}</g>'
                )

        # ── X-axis labels (for non-bar charts) ───────────────────────
        if not real_bar_cmds or hist_bars:
            if self._xticks and isinstance(self._xticks[0], str):
                n = len(self._xticks)
                for i, lbl in enumerate(self._xticks):
                    xp = pa_x + (i / max(n - 1, 1)) * pa_w
                    fade_delay = T_LABELS + i * 0.03
                    shimmer_delay = T_SHIMMER + i * SHIMMER_STEP
                    parts.append(
                        f'<text x="{xp:.1f}" y="{h - 4}" text-anchor="middle" '
                        f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                        f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                        f'fill="{TEXT_AXIS}" '
                        f'style="--fp-base:{TEXT_AXIS};'
                        f'animation:fp-labelFadeX 0.35s ease {fade_delay:.2f}s both,'
                        f'fp-shimmer {SHIMMER_DUR}s ease {shimmer_delay:.2f}s 1">'
                        f'{_esc(str(lbl))}</text>'
                    )
            elif has_numeric_x:
                if hist_bars:
                    edges = hist_bars[0]["edges"]
                    max_labels = 8
                    if len(edges) <= max_labels:
                        tick_vals = edges
                    else:
                        step = math.ceil(len(edges) / max_labels)
                        tick_vals = [e for i, e in enumerate(edges) if i % step == 0]
                        if tick_vals[-1] != edges[-1]:
                            tick_vals.append(edges[-1])
                else:
                    tick_vals = x_ticks_num

                for xi, tv in enumerate(tick_vals):
                    xp = x_px(tv)
                    if pa_x - 2 <= xp <= pa_x + pa_w + 2:
                        fade_delay = T_LABELS + xi * 0.03
                        shimmer_delay = T_SHIMMER + xi * SHIMMER_STEP
                        parts.append(
                            f'<text x="{xp:.1f}" y="{h - 4}" text-anchor="middle" '
                            f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                            f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                            f'fill="{TEXT_AXIS}" '
                            f'style="--fp-base:{TEXT_AXIS};'
                            f'animation:fp-labelFadeX 0.35s ease {fade_delay:.2f}s both,'
                            f'fp-shimmer {SHIMMER_DUR}s ease {shimmer_delay:.2f}s 1">'
                            f'{_esc(_fmt_val(tv))}</text>'
                        )

        # ── Legend (matching FlashChart.tsx positioning) ───────────────
        legend_extra_h = 0
        if self._show_legend and legend_entries:
            font_size = LEGEND_SIZE
            gap_x = font_size * 2.5
            item_h = font_size + 4
            total_w = sum(font_size + 4 + len(e[1]) * font_size * 0.55 + gap_x for e in legend_entries) - gap_x
            lx = pa_x + (pa_w - total_w) / 2
            ly = pa_y + pa_h + 64  # Match FlashChart.tsx legend position
            legend_extra_h = font_size + 72
            cx = lx
            legend_parts = []
            for color, label, typ in legend_entries:
                sw = font_size
                if typ == "bar":
                    legend_parts.append(
                        f'<rect x="{cx:.1f}" y="{ly + 2:.1f}" width="{sw}" '
                        f'height="{item_h - 4}" rx="2" fill="{color}"/>'
                    )
                elif typ == "scatter":
                    legend_parts.append(
                        f'<circle cx="{cx + sw / 2:.1f}" cy="{ly + item_h / 2:.1f}" '
                        f'r="{sw / 3:.1f}" fill="{color}"/>'
                    )
                else:
                    legend_parts.append(
                        f'<line x1="{cx:.1f}" y1="{ly + item_h / 2:.1f}" '
                        f'x2="{cx + sw:.1f}" y2="{ly + item_h / 2:.1f}" '
                        f'stroke="{color}" stroke-width="2"/>'
                    )
                label_x = cx + sw + 4
                legend_parts.append(
                    f'<text x="{label_x:.1f}" y="{ly + item_h / 2 + 1:.1f}" '
                    f'dominant-baseline="middle" font-size="{font_size}" '
                    f'font-family="{LEGEND_FONT}" fill="{LEGEND_TEXT_COLOR}">'
                    f'{_esc(label)}</text>'
                )
                cx += sw + 4 + len(label) * font_size * 0.55 + gap_x

            parts.append(
                f'<g style="animation:fp-refFade 0.5s ease 1.5s both">'
                f'{"".join(legend_parts)}</g>'
            )

        # ── Bar glow filter defs ──────────────────────────────────────
        for si in bar_series_used:
            filters = [
                ("SideGlow", 5), ("TopHL", 4), ("BotGlow", 5),
                ("LeftEdge", 5), ("BotWhite", 2.25), ("TopWhite", 2.25),
            ]
            for name, sigma in filters:
                defs_parts.append(
                    f'<filter id="bar{name}-{si}" x="-50%" y="-50%" width="200%" height="200%">'
                    f'<feGaussianBlur in="SourceGraphic" stdDeviation="{sigma}"/>'
                    f'</filter>'
                )

        # ── Assemble SVG ──────────────────────────────────────────────
        total_h = h + legend_extra_h
        defs_str = f'<defs>{"".join(defs_parts)}</defs>' if defs_parts else ""
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {total_h}" '
            f'width="{w}" height="{total_h}" '
            f'style="font-family:{AXIS_FONT}">\n'
            f'{defs_str}\n'
            + "\n".join(parts) + "\n</svg>"
        )
        return svg

    def _render_bar_glow(self, bx: float, ay: float, bw: float, ah: float,
                         si: int, style: dict, glow_delay: float) -> str:
        """Render the bar glow layers as a nested SVG (matching FlashChart.tsx)."""

        def sc(hv: float) -> float:
            return (hv / 134) * ah

        # Build glow layers
        layers: List[str] = []

        # Base fill
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" fill="{style["fill"]}"/>'
        )

        # Side glow (drifting)
        side_path = (
            f'M{bx} {ay + ah + sc(11)} V{ay + ah - sc(0.5)} '
            f'C{bx} {ay + ah - sc(0.5)} {bx + bw * 0.85} {ay + ah - sc(15)} '
            f'{bx + bw * 0.85} {ay + ah - sc(26)} V{ay + sc(21)} '
            f'C{bx + bw * 0.85} {ay + sc(14)} {bx + bw * 0.275} {ay + sc(7.69)} '
            f'{bx} {ay + sc(7.5)} V{ay - sc(4)} '
            f'C{bx} {ay - sc(4)} {bx + bw * 1.225} {ay + sc(4.5)} '
            f'{bx + bw * 1.225} {ay + sc(21)} V{ay + ah - sc(40.5)} '
            f'C{bx + bw * 1.225} {ay + ah - sc(8)} {bx + bw * 0.85} {ay + ah - sc(9.5)} '
            f'{bx} {ay + ah + sc(11)} Z'
        )
        layers.append(
            f'<g style="animation:fp-glowDrift1 4s ease-in-out infinite" '
            f'filter="url(#barSideGlow-{si})">'
            f'<path d="{side_path}" fill="{style["sideGlow"]}"/></g>'
        )

        # Top highlight
        layers.append(
            f'<g style="animation:fp-glowDrift2 3.5s ease-in-out 0.3s infinite" '
            f'filter="url(#barTopHL-{si})">'
            f'<rect x="{bx + bw * 0.05:.1f}" y="{ay + sc(1):.1f}" '
            f'width="{bw * 0.9:.1f}" height="{sc(8):.1f}" rx="2" fill="{style["topGlow"]}"/></g>'
        )

        # Bottom glow
        bot_path = (
            f'M{bx + bw * 0.05} {ay + ah - sc(8.2)} '
            f'C{bx + bw * 0.05} {ay + ah - sc(9.2)} {bx + bw * 0.05} {ay + ah - sc(4)} '
            f'{bx + bw * 0.17} {ay + ah - sc(1.5)} '
            f'C{bx + bw * 0.28} {ay + ah + sc(0.8)} {bx + bw * 0.72} {ay + ah + sc(0.8)} '
            f'{bx + bw * 0.83} {ay + ah - sc(1.5)} '
            f'C{bx + bw * 0.95} {ay + ah - sc(4)} {bx + bw * 0.95} {ay + ah - sc(9.2)} '
            f'{bx + bw * 0.95} {ay + ah - sc(8.2)} '
            f'V{ay + ah} H{bx + bw * 0.05} V{ay + ah - sc(8.2)}Z'
        )
        layers.append(
            f'<g style="animation:fp-glowDrift3 3.8s ease-in-out 0.2s infinite" '
            f'filter="url(#barBotGlow-{si})">'
            f'<path d="{bot_path}" fill="{style["bottomGlow"]}"/></g>'
        )

        # Left edge
        left_path = (
            f'M{bx - bw * 0.01} {ay + sc(4)} '
            f'C{bx + bw * 0.045} {ay + sc(4)} {bx + bw * 0.045} {ay + sc(4)} '
            f'{bx + bw * 0.045} {ay + sc(8)} V{ay + ah - sc(8)} '
            f'C{bx + bw * 0.045} {ay + ah - sc(4)} {bx - bw * 0.01} {ay + ah - sc(2)} '
            f'{bx - bw * 0.01} {ay + ah} V{ay + sc(4)}Z'
        )
        layers.append(
            f'<g style="animation:fp-glowDrift1 4.2s ease-in-out 0.5s infinite" '
            f'filter="url(#barLeftEdge-{si})">'
            f'<path d="{left_path}" fill="{style["leftEdge"]}"/></g>'
        )

        # Sparkle dots
        for dIdx, dot in enumerate(SPARKLE_DOTS):
            float_name = ["fp-sparkleFloat1", "fp-sparkleFloat2", "fp-sparkleFloat3"][dIdx % 3]
            dur = 2.5 + (dIdx % 5) * 0.5
            sp_delay = (dIdx * 0.2) % 1.5
            layers.append(
                f'<circle cx="{bx + dot["cx"] * bw:.1f}" cy="{ay + dot["cy"] * ah:.1f}" '
                f'r="{dot["r"]}" fill="{style["sparkle"]}" '
                f'style="animation:{float_name} {dur}s ease-in-out {sp_delay:.1f}s infinite"/>'
            )

        # Bottom white highlight
        bot_white_path = (
            f'M{bx} {ay + ah - sc(3.5)} L{bx + bw * 0.5} {ay + ah - sc(1.5)} '
            f'L{bx + bw} {ay + ah - sc(3.5)} V{ay + ah} H{bx} V{ay + ah - sc(3.5)}Z'
        )
        layers.append(
            f'<g filter="url(#barBotWhite-{si})">'
            f'<path d="{bot_white_path}" fill="white" fill-opacity="0.8"/></g>'
        )

        # Top white highlight
        top_white_path = (
            f'M{bx} {ay + sc(3.5)} L{bx + bw * 0.5} {ay + sc(1.5)} '
            f'L{bx + bw} {ay + sc(3.5)} V{ay} H{bx} V{ay + sc(3.5)}Z'
        )
        layers.append(
            f'<g filter="url(#barTopWhite-{si})">'
            f'<path d="{top_white_path}" fill="white" fill-opacity="0.8"/></g>'
        )

        # Wrap all in a nested svg for clipping, with fade-in animation
        return (
            f'<svg x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" overflow="hidden">'
            f'<g transform="translate({-bx:.1f},{-ay:.1f})" '
            f'style="animation:fp-glowFadeIn 0.5s ease {glow_delay:.2f}s both">'
            f'{"".join(layers)}'
            f'</g></svg>'
        )

    @staticmethod
    def _compute_hist_bins(data: list, bins: Union[int, list] = 10):
        sorted_data = sorted(data)
        d_min, d_max = sorted_data[0], sorted_data[-1]
        if isinstance(bins, list):
            edges = bins
        else:
            step = (d_max - d_min) / bins
            edges = [d_min + i * step for i in range(bins + 1)]
        counts = [0] * (len(edges) - 1)
        for v in data:
            for i in range(len(edges) - 1):
                if v >= edges[i] and (v < edges[i + 1] or (i == len(edges) - 2 and v == edges[i + 1])):
                    counts[i] += 1
                    break
        return edges, counts
