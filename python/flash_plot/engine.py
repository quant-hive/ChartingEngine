"""Pure Python Flash Plot engine -- renders SVG charts matching the TypeScript FlashChart frontend.

Produces SVGs visually matching the NewFlash charting engine:
same fonts, colors, bar glow effects, and layout.
Colab-compatible: no <style> tags, no SVG filters -- uses inline styles
and gradient-based glow simulation that survive Colab's HTML sanitizer.
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
    """Format axis tick value -- matching FlashChart frontend formatting."""
    if v == 0:
        return "0"
    if abs(v) >= 1e6:
        return f"{v:.2e}"
    # Integer-like values: show without decimals
    if v == int(v):
        return f"{int(v):,}"
    if abs(v) >= 100:
        return f"{v:,.0f}"
    if abs(v) >= 1:
        return f"{v:.1f}" if v == round(v, 1) else f"{v:.2f}"
    return f"{v:.4g}"


def _dash_array(style: str) -> Optional[str]:
    if style == "dashed":
        return "8 4"
    if style == "dotted":
        return "2 3"
    if style == "dashdot":
        return "8 3 2 3"
    return None


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to (r, g, b)."""
    h = hex_color.lstrip('#')
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# ── Command types ──────────────────────────────────────────────────────────

class _PlotCmd:
    def __init__(self, kind: str, **kw):
        self.kind = kind
        self.__dict__.update(kw)


# ── FlashPlot ──────────────────────────────────────────────────────────────

class FlashPlot:
    """Matplotlib-like API that renders SVG matching the Flash frontend.
    Colab-compatible: uses only inline styles and gradients (no CSS <style> or SVG <filter>)."""

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
        self._chart_type = "line"

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
        real_bar_cmds = [c for c in bar_cmds if c.kind == "bar"]
        has_bars = bool(real_bar_cmds) or bool(hist_cmds)

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

        # For bar charts, always include 0 in the range (bars grow from baseline)
        if has_bars:
            y_vals.append(0)

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

        # ── SVG parts ─────────────────────────────────────────────────
        parts: List[str] = []
        defs_parts: List[str] = []

        # Legend collection
        legend_entries: List[Tuple[str, str, str]] = []  # (color, label, type)

        # Unique gradient counter
        grad_counter = [0]

        def next_grad_id(prefix: str = "g") -> str:
            grad_counter[0] += 1
            return f"{prefix}{grad_counter[0]}"

        # ── Title / Subtitle ──────────────────────────────────────────
        cur_y_top = 0.0
        if self._title:
            cur_y_top = TITLE_SIZE + 4
            parts.append(
                f'<text x="{pa_x}" y="{cur_y_top}" '
                f'font-size="{TITLE_SIZE}" font-weight="{TITLE_WEIGHT}" '
                f'font-family="{TITLE_FONT}" letter-spacing="{TITLE_SPACING}" '
                f'fill="{TITLE_COLOR}">{_esc(self._title)}</text>'
            )
        if self._subtitle:
            cur_y_top += SUBTITLE_SIZE + 6
            parts.append(
                f'<text x="{pa_x}" y="{cur_y_top}" '
                f'font-size="{SUBTITLE_SIZE}" font-weight="{SUBTITLE_WEIGHT}" '
                f'font-family="{SUBTITLE_FONT}" letter-spacing="{SUBTITLE_SPACING}" '
                f'fill="{SUBTITLE_COLOR}">{_esc(self._subtitle)}</text>'
            )

        # ── Grid ──────────────────────────────────────────────────────
        if self._grid:
            for yt in y_ticks:
                yp = y_px(yt)
                if pa_y <= yp <= pa_y + pa_h:
                    parts.append(
                        f'<line x1="{pa_x}" y1="{yp:.1f}" x2="{pa_x + pa_w}" y2="{yp:.1f}" '
                        f'stroke="{GRID_COLOR}" stroke-width="{GRID_WIDTH}"/>'
                    )

        # ── Y-axis labels ─────────────────────────────────────────────
        for yt in y_ticks:
            yp = y_px(yt)
            parts.append(
                f'<text x="{pa_x - 4}" y="{yp + 3:.1f}" text-anchor="end" '
                f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                f'fill="{TEXT_AXIS}">{_esc(_fmt_val(yt))}</text>'
            )

        # ── Area / fill_between ───────────────────────────────────────
        area_idx = 0
        for cmd in fill_cmds:
            y1 = cmd.y1 if isinstance(cmd.y1, list) else [cmd.y1] * len(cmd.x)
            y2 = cmd.y2 if isinstance(cmd.y2, list) else [cmd.y2] * len(cmd.x)
            n = len(cmd.x)

            grad_id = next_grad_id("ag")
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
            parts.append(f'<path d="{fwd} {bwd} Z" fill="url(#{grad_id})" opacity="{cmd.alpha}"/>')
            if cmd.label:
                legend_entries.append((cmd.color, cmd.label, "line"))
            area_idx += 1

        # ── Lines ─────────────────────────────────────────────────────
        for cmd in line_cmds:
            n = len(cmd.y)
            pts = []
            for i in range(n):
                if cmd.x:
                    xp = x_px(cmd.x[i])
                else:
                    xp = pa_x + (i / max(n - 1, 1)) * pa_w
                yp = y_px(cmd.y[i])
                pts.append(f"{'M' if i == 0 else 'L'}{xp:.1f},{yp:.1f}")

            path_d = " ".join(pts)
            da = _dash_array(cmd.line_style)
            da_attr = f' stroke-dasharray="{da}"' if da else ""
            parts.append(
                f'<path d="{path_d}" fill="none" stroke="{cmd.color}" '
                f'stroke-width="{cmd.line_width}" stroke-linejoin="round"{da_attr} '
                f'opacity="{cmd.alpha}"/>'
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

        # ── Bars (grouped) with Colab-compatible glow ─────────────────
        if real_bar_cmds and not hist_bars:
            num_series = len(real_bar_cmds)
            all_labels = real_bar_cmds[0].x_labels if real_bar_cmds else []
            n_bars = len(all_labels) if all_labels else (len(real_bar_cmds[0].y) if real_bar_cmds else 0)
            bar_w = 18
            pair_gap = 3
            group_w = pa_w / max(n_bars, 1)
            pair_w = bar_w * num_series + pair_gap * (num_series - 1) if num_series > 1 else bar_w

            si = 0
            for cmd in real_bar_cmds:
                style = BAR_STYLES[si % len(BAR_STYLES)]

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

                    glow_svg = self._render_bar_glow_colab(
                        bx, ay, bw, ah, si, style, defs_parts, next_grad_id
                    )
                    parts.append(glow_svg)

                if cmd.label:
                    legend_entries.append((style["fill"], cmd.label, "bar"))
                si += 1

            # X-axis labels for bars
            if all_labels:
                for i, lbl in enumerate(all_labels):
                    cx = pa_x + (i + 0.5) * group_w
                    parts.append(
                        f'<text x="{cx:.1f}" y="{h - 4}" text-anchor="middle" '
                        f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                        f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                        f'fill="{TEXT_AXIS}">{_esc(str(lbl))}</text>'
                    )

        # ── Histogram bars ────────────────────────────────────────────
        for hb in hist_bars:
            edges = hb["edges"]
            counts = hb["counts"]
            cmd = hb["cmd"]
            si = cmd.series_idx
            style = BAR_STYLES[si % len(BAR_STYLES)]

            for i in range(len(counts)):
                bx_l = x_px(edges[i])
                bx_r = x_px(edges[i + 1])
                bw = bx_r - bx_l
                by_top = y_px(counts[i])
                by_bot = y_px(0) if y_min <= 0 else pa_y + pa_h
                ay = min(by_top, by_bot)
                ah = max(0.5, abs(by_top - by_bot))

                glow_svg = self._render_bar_glow_colab(
                    bx_l, ay, bw, ah, si, style, defs_parts, next_grad_id
                )
                parts.append(glow_svg)

            if cmd.label:
                legend_entries.append((style["fill"], cmd.label, "bar"))

        # ── Scatter ───────────────────────────────────────────────────
        for cmd in scatter_cmds:
            for i in range(len(cmd.x)):
                xp = x_px(cmd.x[i])
                yp = y_px(cmd.y[i])
                r = math.sqrt(cmd.size) if isinstance(cmd.size, (int, float)) else 2
                parts.append(
                    f'<circle cx="{xp:.1f}" cy="{yp:.1f}" r="{r:.1f}" '
                    f'fill="{cmd.color}" opacity="{cmd.alpha}"/>'
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
                    f'stroke="{cmd.color}" stroke-width="{cmd.line_width}"{da_attr}/>'
                )
            elif cmd.kind == "vline":
                xp = x_px(cmd.x)
                da = _dash_array(cmd.line_style)
                da_attr = f' stroke-dasharray="{da}"' if da else ""
                parts.append(
                    f'<line x1="{xp:.1f}" y1="{pa_y}" x2="{xp:.1f}" y2="{pa_y + pa_h}" '
                    f'stroke="{cmd.color}" stroke-width="{cmd.line_width}"{da_attr}/>'
                )
            elif cmd.kind == "text":
                parts.append(
                    f'<text x="{cmd.x}" y="{cmd.y}" text-anchor="{cmd.anchor}" '
                    f'font-size="{cmd.font_size}" font-family="{AXIS_FONT}" '
                    f'fill="{cmd.color}">{_esc(cmd.content)}</text>'
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
                    f'font-family="{AXIS_FONT}" fill="{cmd.color}">{_esc(cmd.text)}</text>'
                )
                parts.append(f'<g>{"".join(ann_parts)}</g>')

        # ── X-axis labels (for non-bar charts) ───────────────────────
        if not real_bar_cmds or hist_bars:
            if self._xticks and isinstance(self._xticks[0], str):
                n = len(self._xticks)
                for i, lbl in enumerate(self._xticks):
                    xp = pa_x + (i / max(n - 1, 1)) * pa_w
                    parts.append(
                        f'<text x="{xp:.1f}" y="{h - 4}" text-anchor="middle" '
                        f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                        f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                        f'fill="{TEXT_AXIS}">{_esc(str(lbl))}</text>'
                    )
            elif has_numeric_x:
                if hist_bars:
                    edges = hist_bars[0]["edges"]
                    max_labels = 8
                    if len(edges) <= max_labels:
                        tick_vals = edges
                    else:
                        step_i = math.ceil(len(edges) / max_labels)
                        tick_vals = [e for i, e in enumerate(edges) if i % step_i == 0]
                        if tick_vals[-1] != edges[-1]:
                            tick_vals.append(edges[-1])
                else:
                    tick_vals = x_ticks_num

                for tv in tick_vals:
                    xp = x_px(tv)
                    if pa_x - 2 <= xp <= pa_x + pa_w + 2:
                        parts.append(
                            f'<text x="{xp:.1f}" y="{h - 4}" text-anchor="middle" '
                            f'font-size="{AXIS_SIZE}" font-weight="{AXIS_WEIGHT}" '
                            f'font-family="{AXIS_FONT}" letter-spacing="{AXIS_SPACING}" '
                            f'fill="{TEXT_AXIS}">{_esc(_fmt_val(tv))}</text>'
                        )

        # ── Legend ────────────────────────────────────────────────────
        legend_extra_h = 0
        if self._show_legend and legend_entries:
            font_size = LEGEND_SIZE
            gap_x = font_size * 2.5
            item_h = font_size + 4
            total_w = sum(font_size + 4 + len(e[1]) * font_size * 0.55 + gap_x for e in legend_entries) - gap_x
            lx = pa_x + (pa_w - total_w) / 2
            ly = pa_y + pa_h + 64
            legend_extra_h = font_size + 72
            cx = lx
            for color, label, typ in legend_entries:
                sw = font_size
                if typ == "bar":
                    parts.append(
                        f'<rect x="{cx:.1f}" y="{ly + 2:.1f}" width="{sw}" '
                        f'height="{item_h - 4}" rx="2" fill="{color}"/>'
                    )
                elif typ == "scatter":
                    parts.append(
                        f'<circle cx="{cx + sw / 2:.1f}" cy="{ly + item_h / 2:.1f}" '
                        f'r="{sw / 3:.1f}" fill="{color}"/>'
                    )
                else:
                    parts.append(
                        f'<line x1="{cx:.1f}" y1="{ly + item_h / 2:.1f}" '
                        f'x2="{cx + sw:.1f}" y2="{ly + item_h / 2:.1f}" '
                        f'stroke="{color}" stroke-width="2"/>'
                    )
                label_x = cx + sw + 4
                parts.append(
                    f'<text x="{label_x:.1f}" y="{ly + item_h / 2 + 1:.1f}" '
                    f'dominant-baseline="middle" font-size="{font_size}" '
                    f'font-family="{LEGEND_FONT}" fill="{LEGEND_TEXT_COLOR}">'
                    f'{_esc(label)}</text>'
                )
                cx += sw + 4 + len(label) * font_size * 0.55 + gap_x

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

    def _render_bar_glow_colab(self, bx: float, ay: float, bw: float, ah: float,
                                si: int, style: dict, defs_parts: List[str],
                                next_grad_id) -> str:
        """Render bar with glow effects using only gradients and opacity layers.
        Colab-compatible: no <filter>, no <style>, no CSS animations."""

        layers: List[str] = []

        # 1. Dark base rect
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" '
            f'fill="{BAR_DEFAULT_FILL}"/>'
        )

        # 2. Main gradient fill (gradTop -> gradBottom)
        grad_id = next_grad_id("bg")
        defs_parts.append(
            f'<linearGradient id="{grad_id}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0%" stop-color="{style["gradTop"]}"/>'
            f'<stop offset="100%" stop-color="{style["gradBottom"]}"/>'
            f'</linearGradient>'
        )
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" '
            f'fill="url(#{grad_id})"/>'
        )

        # 3. Side glow -- gradient from transparent to glow color along left edge
        side_grad_id = next_grad_id("sg")
        defs_parts.append(
            f'<linearGradient id="{side_grad_id}" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0%" stop-color="{style["sideGlow"]}" stop-opacity="0.6"/>'
            f'<stop offset="40%" stop-color="{style["sideGlow"]}" stop-opacity="0.2"/>'
            f'<stop offset="100%" stop-color="{style["fill"]}" stop-opacity="0"/>'
            f'</linearGradient>'
        )
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" '
            f'fill="url(#{side_grad_id})"/>'
        )

        # 4. Left edge highlight
        edge_w = max(1.5, bw * 0.06)
        left_grad_id = next_grad_id("le")
        defs_parts.append(
            f'<linearGradient id="{left_grad_id}" x1="0" y1="0" x2="1" y2="0">'
            f'<stop offset="0%" stop-color="{style["leftEdge"]}" stop-opacity="0.7"/>'
            f'<stop offset="100%" stop-color="{style["leftEdge"]}" stop-opacity="0"/>'
            f'</linearGradient>'
        )
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{edge_w:.1f}" height="{ah:.1f}" '
            f'fill="url(#{left_grad_id})"/>'
        )

        # 5. Top highlight (bright strip at top)
        top_h = max(2, ah * 0.08)
        top_grad_id = next_grad_id("th")
        defs_parts.append(
            f'<linearGradient id="{top_grad_id}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0%" stop-color="{style["topGlow"]}" stop-opacity="0.5"/>'
            f'<stop offset="100%" stop-color="{style["topGlow"]}" stop-opacity="0"/>'
            f'</linearGradient>'
        )
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{top_h:.1f}" '
            f'fill="url(#{top_grad_id})"/>'
        )

        # 6. Bottom glow (bright strip at bottom)
        bot_h = max(3, ah * 0.12)
        bot_grad_id = next_grad_id("bg")
        defs_parts.append(
            f'<linearGradient id="{bot_grad_id}" x1="0" y1="1" x2="0" y2="0">'
            f'<stop offset="0%" stop-color="{style["bottomGlow"]}" stop-opacity="0.5"/>'
            f'<stop offset="100%" stop-color="{style["bottomGlow"]}" stop-opacity="0"/>'
            f'</linearGradient>'
        )
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay + ah - bot_h:.1f}" width="{bw:.1f}" height="{bot_h:.1f}" '
            f'fill="url(#{bot_grad_id})"/>'
        )

        # 7. White top edge highlight
        top_white_h = max(1, ah * 0.04)
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{top_white_h:.1f}" '
            f'fill="white" opacity="0.15"/>'
        )

        # 8. White bottom edge highlight
        bot_white_h = max(1, ah * 0.03)
        layers.append(
            f'<rect x="{bx:.1f}" y="{ay + ah - bot_white_h:.1f}" width="{bw:.1f}" height="{bot_white_h:.1f}" '
            f'fill="white" opacity="0.12"/>'
        )

        # 9. Sparkle dots (static, but visible -- just circles with glow color)
        for dot in SPARKLE_DOTS:
            dcx = bx + dot["cx"] * bw
            dcy = ay + dot["cy"] * ah
            # Only render if inside bar bounds
            if bx <= dcx <= bx + bw and ay <= dcy <= ay + ah:
                layers.append(
                    f'<circle cx="{dcx:.1f}" cy="{dcy:.1f}" r="{dot["r"]}" '
                    f'fill="{style["sparkle"]}" opacity="0.85"/>'
                )

        # Wrap in a group clipped to bar bounds via nested svg
        return (
            f'<svg x="{bx:.1f}" y="{ay:.1f}" width="{bw:.1f}" height="{ah:.1f}" overflow="hidden">'
            f'<g transform="translate({-bx:.1f},{-ay:.1f})">'
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
