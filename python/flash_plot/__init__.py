"""
Flash Plot — Premium dark-themed charting for Jupyter & Colab.

Matplotlib-like API -> Scene graph -> Animated SVG.

    from flash_plot import figure, render_chart

    # Matplotlib-like API
    fig = figure()
    ax = fig.subplot(1, 1, 1)
    ax.plot([1, 4, 2, 8, 5, 7], color="#d4d4d4", label="Strategy")
    ax.grid(True)
    ax.legend()
    fig.show()

    # MCP ChartSpec API
    render_chart({"type": "bar", "series": [{"data": [10, 20, 30]}]})
"""

from ._core import (
    Point, Rect, Padding, TickMark, TextStyle,
    Theme, BarThemeStyle, FLASH_DARK,
    BoxStats, ViolinStats, SurfaceFace,
    register_theme, get_theme,
    compute_ticks, compute_linear_ticks, compute_log_ticks,
    linear_scale, log_scale, scale_value,
    compute_layout, compute_subplot_bounds,
    build_line_path, build_area_path, build_fill_between_path,
    build_bar_rects, build_scatter_points, compute_histogram_bins,
    compute_box_stats, compute_violin_kde, build_surface_faces,
    DEFAULT_WIDTH, DEFAULT_HEIGHT,
)

from ._figure import (
    Scene, SubplotScene, Figure, Axes, figure,
    PieSlice, PiePlotElement,
)

from ._render import render_svg, render_html

from .spec_renderer import render_chart

__version__ = "0.2.0"
__all__ = [
    "figure", "Figure", "Axes", "Scene", "SubplotScene",
    "render_svg", "render_html", "render_chart",
    "Point", "Rect", "Padding", "TickMark", "TextStyle",
    "Theme", "BarThemeStyle", "FLASH_DARK",
    "register_theme", "get_theme",
    "__version__",
]
