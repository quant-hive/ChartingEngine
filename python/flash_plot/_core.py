"""
Core math and types for the Flash plot engine.
Framework-agnostic: types, theme, scales, layout, SVG path builders.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Union, Callable
import math

# ── Geometry ────────────────────────────────────────────────────────────

@dataclass
class Point:
    x: float
    y: float

@dataclass
class Rect:
    x: float
    y: float
    w: float
    h: float

@dataclass
class Padding:
    top: float
    right: float
    bottom: float
    left: float

# ── Tick Mark ───────────────────────────────────────────────────────────

@dataclass
class TickMark:
    value: float
    label: str
    position: float  # pixel position along the axis

# ── Text Style ──────────────────────────────────────────────────────────

@dataclass
class TextStyle:
    font_family: str = "'Inter', sans-serif"
    font_size: float = 11
    font_weight: Union[int, str] = 500
    letter_spacing: str = "-0.12px"
    color: str = "#494949"

# ── Theme ───────────────────────────────────────────────────────────────

@dataclass
class BarThemeStyle:
    fill: str
    side_glow: str
    top_glow: str
    bottom_glow: str
    left_edge: str
    sparkle: str
    grad_top: str
    grad_bottom: str

@dataclass
class Theme:
    name: str
    background: str
    surface: str
    text_primary: str
    text_secondary: str
    text_muted: str
    text_axis: str
    grid_color: str
    grid_width: float
    axis_font_family: str
    axis_font_size: float
    axis_font_weight: int
    axis_letter_spacing: str
    title_font_family: str
    title_font_size: float
    title_color: str
    tooltip_bg: str
    tooltip_border: str
    tooltip_text: str
    tooltip_header: str
    tooltip_font_family: str
    default_colors: List[str]
    bar_default_fill: str
    bar_styles: List[BarThemeStyle]
    area_gradient_top: float
    area_gradient_bottom: float


FLASH_DARK = Theme(
    name="flash-dark",
    background="#121212",
    surface="#0f0f0f",
    text_primary="#e0e0e0",
    text_secondary="#707070",
    text_muted="#494949",
    text_axis="#494949",
    grid_color="#2a2a2a",
    grid_width=0.3,
    axis_font_family="'Inter', sans-serif",
    axis_font_size=11,
    axis_font_weight=500,
    axis_letter_spacing="-0.12px",
    title_font_family="'Instrument Serif', 'EB Garamond', 'Times New Roman', serif",
    title_font_size=18,
    title_color="#ffffff",
    tooltip_bg="#1a1a1a",
    tooltip_border="#2a2a2a",
    tooltip_text="#a0a0a0",
    tooltip_header="#808080",
    tooltip_font_family="'Inter', sans-serif",
    default_colors=[
        "#d4d4d4", "#707070", "#4ECDC4", "#FFD93D",
        "#FF6B6B", "#C084FC", "#67E8F9", "#FCA5A5",
    ],
    bar_default_fill="#1e1f24",
    bar_styles=[
        BarThemeStyle(
            fill="#EF8CFF", side_glow="#624096", top_glow="#763AA4",
            bottom_glow="#7B42DD", left_edge="#7432E6", sparkle="#E49BFF",
            grad_top="#e586fa", grad_bottom="#884f94",
        ),
        BarThemeStyle(
            fill="#8CA5FF", side_glow="#405A96", top_glow="#3A5FA4",
            bottom_glow="#427BDD", left_edge="#3268E6", sparkle="#9BB6FF",
            grad_top="#86bafa", grad_bottom="#4f7194",
        ),
    ],
    area_gradient_top=0.15,
    area_gradient_bottom=0.05,
)

_THEME_REGISTRY: Dict[str, Theme] = {"flash-dark": FLASH_DARK}


def register_theme(theme: Theme) -> None:
    _THEME_REGISTRY[theme.name] = theme


def get_theme(name: str = "flash-dark") -> Theme:
    return _THEME_REGISTRY.get(name, FLASH_DARK)


# ── Scales ──────────────────────────────────────────────────────────────

def _nice_num(value: float, do_round: bool) -> float:
    if value == 0:
        return 0
    exp = math.floor(math.log10(abs(value)))
    frac = value / (10 ** exp)
    if do_round:
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


def compute_linear_ticks(
    data_min: float, data_max: float, target_ticks: int = 5
) -> Tuple[float, float, float, List[float]]:
    """Returns (nice_min, nice_max, step, ticks)."""
    if data_min == data_max:
        data_min -= 1
        data_max += 1
    rng = _nice_num(data_max - data_min, False)
    step = _nice_num(rng / (target_ticks - 1), True)
    lo = math.floor(data_min / step) * step
    hi = math.ceil(data_max / step) * step
    ticks: List[float] = []
    v = lo
    while v <= hi + step * 0.001:
        ticks.append(round(v, 10))
        v += step
    return lo, hi, step, ticks


def compute_log_ticks(
    data_min: float, data_max: float, _target: int = 5
) -> Tuple[float, float, float, List[float]]:
    log_min = math.floor(math.log10(max(data_min, 1e-10)))
    log_max = math.ceil(math.log10(max(data_max, 1e-10)))
    ticks = [10 ** e for e in range(log_min, log_max + 1)]
    return 10 ** log_min, 10 ** log_max, 0, ticks


def compute_ticks(
    scale: str, data_min: float, data_max: float, target: int = 5
) -> Tuple[float, float, float, List[float]]:
    if scale == "log":
        return compute_log_ticks(data_min, data_max, target)
    return compute_linear_ticks(data_min, data_max, target)


def linear_scale(
    value: float, d_min: float, d_max: float, r_min: float, r_max: float
) -> float:
    if d_max == d_min:
        return r_min
    return r_min + ((value - d_min) / (d_max - d_min)) * (r_max - r_min)


def log_scale(
    value: float, d_min: float, d_max: float, r_min: float, r_max: float
) -> float:
    lv = math.log10(max(value, 1e-10))
    lmin = math.log10(max(d_min, 1e-10))
    lmax = math.log10(max(d_max, 1e-10))
    return linear_scale(lv, lmin, lmax, r_min, r_max)


def scale_value(
    scale: str, value: float, d_min: float, d_max: float, r_min: float, r_max: float
) -> float:
    if scale == "log":
        return log_scale(value, d_min, d_max, r_min, r_max)
    return linear_scale(value, d_min, d_max, r_min, r_max)


def pick_labels(labels: List[str], max_labels: int = 8) -> List[str]:
    if len(labels) <= max_labels:
        return labels
    step = (len(labels) - 1) / (max_labels - 1)
    return [labels[round(i * step)] for i in range(max_labels)]


def generate_tick_marks(
    ticks: List[float],
    d_min: float,
    d_max: float,
    r_min: float,
    r_max: float,
    scale: str = "linear",
    fmt: Optional[Callable[[float], str]] = None,
) -> List[TickMark]:
    _fmt = fmt or (lambda v: f"{v:g}")
    return [
        TickMark(
            value=v,
            label=_fmt(v),
            position=scale_value(scale, v, d_min, d_max, r_min, r_max),
        )
        for v in ticks
    ]


# ── Layout ──────────────────────────────────────────────────────────────

DEFAULT_WIDTH = 595
DEFAULT_HEIGHT = 260
DEFAULT_PADDING = Padding(top=4, right=2, bottom=20, left=26)
DEFAULT_INSET = 16


def compute_layout(
    width: float = DEFAULT_WIDTH,
    height: float = DEFAULT_HEIGHT,
    padding: Padding = DEFAULT_PADDING,
    inset: float = DEFAULT_INSET,
) -> Rect:
    """Returns the plot area rect."""
    return Rect(
        x=padding.left + inset,
        y=padding.top + inset,
        w=width - padding.left - padding.right - inset * 2,
        h=height - padding.top - padding.bottom - inset * 2,
    )


def compute_subplot_bounds(
    nrows: int, ncols: int, fig_w: float, fig_h: float,
    hspace: float = 0.05, wspace: float = 0.05,
) -> List[List[Rect]]:
    cell_w = fig_w / ncols
    cell_h = fig_h / nrows
    gap_w = cell_w * wspace
    gap_h = cell_h * hspace
    grid: List[List[Rect]] = []
    for r in range(nrows):
        row: List[Rect] = []
        for c in range(ncols):
            row.append(Rect(
                x=c * cell_w + gap_w / 2,
                y=r * cell_h + gap_h / 2,
                w=cell_w - gap_w,
                h=cell_h - gap_h,
            ))
        grid.append(row)
    return grid


# ── SVG Path Builders ───────────────────────────────────────────────────

def map_point(
    index: int, value: float, data_len: int,
    plot_area: Rect, y_min: float, y_max: float, y_scale: str = "linear",
) -> Point:
    if data_len <= 1:
        x = plot_area.x + plot_area.w / 2
    else:
        x = plot_area.x + (index / (data_len - 1)) * plot_area.w
    y = plot_area.y + plot_area.h - scale_value(y_scale, value, y_min, y_max, 0, plot_area.h)
    return Point(x, y)


def build_line_path(
    data: List[float], plot_area: Rect, y_min: float, y_max: float,
    y_scale: str = "linear",
) -> Tuple[str, List[Point]]:
    pts = [map_point(i, v, len(data), plot_area, y_min, y_max, y_scale) for i, v in enumerate(data)]
    path = " ".join(
        f"{'M' if i == 0 else 'L'}{p.x:.1f},{p.y:.1f}" for i, p in enumerate(pts)
    )
    return path, pts


def build_area_path(
    data: List[float], plot_area: Rect, y_min: float, y_max: float,
    baseline: float = 0, y_scale: str = "linear",
) -> Tuple[str, List[Point]]:
    base_y = plot_area.y + plot_area.h - scale_value(y_scale, baseline, y_min, y_max, 0, plot_area.h)
    pts = [map_point(i, v, len(data), plot_area, y_min, y_max, y_scale) for i, v in enumerate(data)]
    line = " ".join(f"{'M' if i == 0 else 'L'}{p.x:.1f},{p.y:.1f}" for i, p in enumerate(pts))
    path = f"{line} L{pts[-1].x:.1f},{base_y:.1f} L{pts[0].x:.1f},{base_y:.1f} Z"
    return path, pts


def build_fill_between_path(
    y1: List[float], y2: List[float], plot_area: Rect,
    y_min: float, y_max: float, y_scale: str = "linear",
) -> Tuple[str, List[Point]]:
    n = len(y1)
    top = [map_point(i, v, n, plot_area, y_min, y_max, y_scale) for i, v in enumerate(y1)]
    bot = [map_point(i, v, n, plot_area, y_min, y_max, y_scale) for i, v in enumerate(y2)]
    fwd = " ".join(f"{'M' if i == 0 else 'L'}{p.x:.1f},{p.y:.1f}" for i, p in enumerate(top))
    bwd = " ".join(f"L{p.x:.1f},{p.y:.1f}" for p in reversed(bot))
    return f"{fwd} {bwd} Z", top


@dataclass
class BarGeometry:
    x: float
    y: float
    width: float
    height: float
    value: float
    index: int


def build_bar_rects(
    data: List[float], series_idx: int, num_series: int,
    plot_area: Rect, y_min: float, y_max: float,
    bar_width: float = 20, pair_gap: float = 3,
    bottom: Optional[List[float]] = None,
) -> List[BarGeometry]:
    n = len(data)
    group_w = plot_area.w / n
    pair_w = bar_width * num_series + pair_gap * (num_series - 1) if num_series > 1 else bar_width
    pad_l = (group_w - pair_w) / 2
    base_y = plot_area.y + plot_area.h
    y_range = y_max - y_min or 1
    bars: List[BarGeometry] = []
    for i, val in enumerate(data):
        bot = bottom[i] if bottom else 0
        top = bot + val  # actual top of bar segment
        top_px = base_y - ((top - y_min) / y_range) * plot_area.h
        bot_px = base_y - ((bot - y_min) / y_range) * plot_area.h
        by = min(top_px, bot_px)
        h = max(1, abs(top_px - bot_px))
        bx = plot_area.x + i * group_w + pad_l + series_idx * (bar_width + pair_gap)
        bars.append(BarGeometry(x=bx, y=by, width=bar_width, height=h, value=val, index=i))
    return bars


def build_scatter_points(
    x_data: List[float], y_data: List[float], plot_area: Rect,
    x_min: float, x_max: float, y_min: float, y_max: float,
    sizes: Optional[Union[float, List[float]]] = None,
    x_scale: str = "linear", y_scale: str = "linear",
) -> List[Tuple[float, float, float]]:
    result = []
    for i, xv in enumerate(x_data):
        px = plot_area.x + scale_value(x_scale, xv, x_min, x_max, 0, plot_area.w)
        py = plot_area.y + plot_area.h - scale_value(y_scale, y_data[i], y_min, y_max, 0, plot_area.h)
        s = sizes if isinstance(sizes, (int, float)) else (sizes[i] if sizes else 4)
        result.append((px, py, s))
    return result


def compute_histogram_bins(
    data: List[float], bins: Union[int, List[float]] = 10
) -> Tuple[List[float], List[int]]:
    sorted_d = sorted(data)
    lo, hi = sorted_d[0], sorted_d[-1]
    if isinstance(bins, list):
        edges = bins
    else:
        step = (hi - lo) / bins
        edges = [lo + i * step for i in range(bins + 1)]
    n_bins = len(edges) - 1
    counts = [0] * n_bins
    for v in data:
        for i in range(n_bins):
            if v >= edges[i] and (v < edges[i + 1] or (i == n_bins - 1 and v == edges[i + 1])):
                counts[i] += 1
                break
    return edges, counts


def dash_array(style: str) -> Optional[str]:
    return {"dashed": "8 4", "dotted": "2 3", "dashdot": "8 3 2 3"}.get(style)


# ── Box Plot & Violin Plot Stats ─────────────────────────────────────

@dataclass
class BoxStats:
    min: float
    q1: float
    median: float
    q3: float
    max: float
    outliers: List[float]
    whisker_lo: float
    whisker_hi: float


def _percentile(sorted_data: List[float], p: float) -> float:
    """Simple linear interpolation percentile."""
    n = len(sorted_data)
    k = (n - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)


def compute_box_stats(data: List[float], whis: float = 1.5) -> BoxStats:
    """Compute box plot statistics: Q1, median, Q3, whiskers, outliers."""
    s = sorted(data)
    q1 = _percentile(s, 0.25)
    med = _percentile(s, 0.5)
    q3 = _percentile(s, 0.75)
    iqr = q3 - q1
    wlo = max(s[0], q1 - whis * iqr)
    whi = min(s[-1], q3 + whis * iqr)
    # Snap whiskers to actual data points
    wlo = min(v for v in s if v >= wlo)
    whi = max(v for v in s if v <= whi)
    outliers = [v for v in s if v < wlo or v > whi]
    return BoxStats(
        min=s[0], q1=q1, median=med, q3=q3, max=s[-1],
        outliers=outliers, whisker_lo=wlo, whisker_hi=whi,
    )


@dataclass
class ViolinStats:
    kde_points: List[Tuple[float, float]]  # (value, density)
    max_density: float
    min_val: float
    max_val: float
    q1: float
    median: float
    q3: float


def compute_violin_kde(
    data: List[float], n_points: int = 50
) -> ViolinStats:
    """Compute KDE for violin plot using Gaussian kernel."""
    s = sorted(data)
    n = len(s)
    lo, hi = s[0], s[-1]
    rng = hi - lo or 1
    # Silverman's rule of thumb for bandwidth
    std = math.sqrt(sum((v - sum(s) / n) ** 2 for v in s) / n) or 1
    bw = 0.9 * std * n ** (-0.2)

    # Extend range slightly
    pad = rng * 0.05
    grid_lo, grid_hi = lo - pad, hi + pad
    step = (grid_hi - grid_lo) / (n_points - 1)

    kde: List[Tuple[float, float]] = []
    max_d = 0
    for i in range(n_points):
        x = grid_lo + i * step
        density = 0
        for v in s:
            z = (x - v) / bw
            density += math.exp(-0.5 * z * z) / (bw * 2.5066282746)  # sqrt(2*pi)
        density /= n
        if density > max_d:
            max_d = density
        kde.append((x, density))

    q1 = _percentile(s, 0.25)
    med = _percentile(s, 0.5)
    q3 = _percentile(s, 0.75)

    return ViolinStats(
        kde_points=kde, max_density=max_d,
        min_val=lo, max_val=hi,
        q1=q1, median=med, q3=q3,
    )


# ── 3D Surface Plot ──────────────────────────────────────────────────

@dataclass
class SurfaceFace:
    """One quad face of a 3D surface, projected to 2D."""
    pts_2d: List[Tuple[float, float]]  # 4 corners in screen coords
    z_avg: float   # average depth for painter's sort
    z_norm: float  # normalized z value 0..1 for coloring
    normal_z: float  # surface normal z-component for shading


def project_point(
    x: float, y: float, z: float,
    az: float, el: float,
    cx: float, cy: float, scale: float,
) -> Tuple[float, float, float]:
    """Project a 3D point to 2D using rotation + orthographic projection.
    Returns (screen_x, screen_y, depth)."""
    # Rotate around Z axis (azimuth)
    cos_a, sin_a = math.cos(az), math.sin(az)
    x1 = x * cos_a - y * sin_a
    y1 = x * sin_a + y * cos_a
    z1 = z
    # Rotate around X axis (elevation)
    cos_e, sin_e = math.cos(el), math.sin(el)
    y2 = y1 * cos_e - z1 * sin_e
    z2 = y1 * sin_e + z1 * cos_e
    # Orthographic projection
    sx = cx + x1 * scale
    sy = cy - z2 * scale
    depth = y2
    return sx, sy, depth


def build_surface_faces(
    z_data: List[List[float]],
    x_data: Optional[List[List[float]]],
    y_data: Optional[List[List[float]]],
    plot_area: Rect,
    azimuth: float = -0.6,
    elevation: float = 0.5,
) -> Tuple[List[SurfaceFace], float, float]:
    """Build projected surface faces from a 2D z-grid.
    Returns (faces, z_min, z_max)."""
    rows = len(z_data)
    cols = len(z_data[0]) if rows > 0 else 0

    # Build coordinate grids
    if x_data is None:
        x_data = [[c / max(cols - 1, 1) for c in range(cols)] for _ in range(rows)]
    if y_data is None:
        y_data = [[r / max(rows - 1, 1) for _ in range(cols)] for r in range(rows)]

    # Find data ranges
    z_min = min(z_data[r][c] for r in range(rows) for c in range(cols))
    z_max = max(z_data[r][c] for r in range(rows) for c in range(cols))
    x_min = min(x_data[r][c] for r in range(rows) for c in range(cols))
    x_max = max(x_data[r][c] for r in range(rows) for c in range(cols))
    y_min = min(y_data[r][c] for r in range(rows) for c in range(cols))
    y_max = max(y_data[r][c] for r in range(rows) for c in range(cols))
    z_range = z_max - z_min or 1
    x_range = x_max - x_min or 1
    y_range = y_max - y_min or 1

    # Normalize to [-1, 1] cube
    def norm(r: int, c: int) -> Tuple[float, float, float]:
        nx = 2 * (x_data[r][c] - x_min) / x_range - 1
        ny = 2 * (y_data[r][c] - y_min) / y_range - 1
        nz = 2 * (z_data[r][c] - z_min) / z_range - 1
        return nx, ny, nz

    # Project all points
    cx = plot_area.x + plot_area.w / 2
    cy = plot_area.y + plot_area.h / 2
    scale = min(plot_area.w, plot_area.h) * 0.38

    projected: List[List[Tuple[float, float, float]]] = []
    for r in range(rows):
        row = []
        for c in range(cols):
            nx, ny, nz = norm(r, c)
            row.append(project_point(nx, ny, nz, azimuth, elevation, cx, cy, scale))
        projected.append(row)

    # Build quad faces
    faces: List[SurfaceFace] = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            p00 = projected[r][c]
            p01 = projected[r][c + 1]
            p10 = projected[r + 1][c]
            p11 = projected[r + 1][c + 1]

            pts_2d = [(p00[0], p00[1]), (p01[0], p01[1]),
                      (p11[0], p11[1]), (p10[0], p10[1])]
            z_avg = (p00[2] + p01[2] + p10[2] + p11[2]) / 4

            # Average normalized z for color
            z_vals = [z_data[r][c], z_data[r][c + 1],
                      z_data[r + 1][c], z_data[r + 1][c + 1]]
            z_norm = (sum(z_vals) / 4 - z_min) / z_range

            # Surface normal z-component for shading
            ax_ = p01[0] - p00[0]
            ay_ = p01[1] - p00[1]
            bx_ = p10[0] - p00[0]
            by_ = p10[1] - p00[1]
            normal_z = ax_ * by_ - ay_ * bx_

            faces.append(SurfaceFace(
                pts_2d=pts_2d, z_avg=z_avg,
                z_norm=z_norm, normal_z=normal_z,
            ))

    return faces, z_min, z_max
