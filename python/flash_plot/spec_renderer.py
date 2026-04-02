"""Render charts from MCP ChartSpec JSON schema.

Accepts the same JSON format as the chart_render MCP tool and renders
SVG via the Flash Plot engine. This lets you test charts using the exact
MCP schema without needing the TypeScript server.

Usage:
    from flash_plot import render_chart

    render_chart({
        "type": "bar",
        "title": "Revenue",
        "series": [{"data": [10, 20, 30], "label": "Q1"}],
        "xLabels": ["Jan", "Feb", "Mar"],
        "grid": True,
        "legend": {"show": True}
    })
"""

from __future__ import annotations
from typing import Any, Dict, Optional


def render_chart(spec: Dict[str, Any], *, display: bool = True) -> Optional[str]:
    """Render a chart from a ChartSpec dict (MCP schema format).

    Parameters
    ----------
    spec : dict
        ChartSpec JSON matching the MCP chart_render tool schema.
        Required key: "type" (line, bar, scatter, histogram, area, pie, donut, etc.)
    display : bool
        If True (default), display inline in Jupyter/Colab.
        If False, return SVG string only.

    Returns
    -------
    str or None
        The rendered SVG string (when display=False), or None (when display=True).
    """
    from ._figure import figure
    from ._core import FLASH_DARK

    chart_type = spec.get("type", "line")
    width = spec.get("width", 620)
    height = spec.get("height", 300)

    fig = figure(width=width, height=height)
    ax = fig.subplot(1, 1, 1)

    # Title / subtitle
    if spec.get("title"):
        ax.set_title(spec["title"])
    if spec.get("subtitle"):
        ax.set_subtitle(spec["subtitle"])

    # Grid
    if spec.get("grid"):
        ax.grid(True)

    # X-axis labels
    x_labels = spec.get("xLabels", [])

    # Series data
    series_list = spec.get("series", [])

    if chart_type == "line":
        _render_line(ax, series_list, x_labels)
    elif chart_type in ("bar", "stacked_bar"):
        _render_bar(ax, series_list, x_labels)
    elif chart_type == "scatter":
        _render_scatter(ax, series_list)
    elif chart_type == "bubble":
        _render_scatter(ax, series_list, bubble=True)
    elif chart_type == "area":
        _render_area(ax, series_list, x_labels)
    elif chart_type == "histogram":
        _render_histogram(ax, series_list, spec.get("bins", 20))
    elif chart_type in ("pie", "donut"):
        _render_pie(ax, spec, chart_type)
    elif chart_type == "candlestick":
        _render_candlestick(ax, series_list, x_labels)
    elif chart_type == "waterfall":
        _render_waterfall(ax, series_list, x_labels)
    elif chart_type == "violin":
        _render_violin(ax, series_list)
    elif chart_type == "boxplot":
        _render_boxplot(ax, series_list)
    elif chart_type == "heatmap":
        _render_heatmap(ax, spec)
    else:
        _render_line(ax, series_list, x_labels)

    # Horizontal / vertical reference lines
    for hl in spec.get("hlines", []):
        ax.axhline(hl["y"], color=hl.get("color", "#494949"),
                   line_style=hl.get("lineStyle", "dashed"))
    for vl in spec.get("vlines", []):
        ax.axvline(vl["x"], color=vl.get("color", "#494949"),
                   line_style=vl.get("lineStyle", "dashed"))

    # Annotations
    for ann in spec.get("annotations", []):
        ax.text(ann["x"], ann["y"], ann["text"],
                color=ann.get("color", "#808080"))

    # Legend
    legend_cfg = spec.get("legend", {})
    if legend_cfg.get("show", False):
        ax.legend()

    # X ticks override
    if x_labels and chart_type not in ("bar", "stacked_bar", "waterfall"):
        ax.set_xticks(x_labels)

    if display:
        fig.show()
        return None

    from ._render import render_svg
    scene = fig.render()
    return render_svg(scene)


# ── Chart type renderers ──────────────────────────────────────────────────

def _render_line(ax, series: list, x_labels: list):
    for s in series:
        data = s.get("data", [])
        x = s.get("x")
        kwargs = {}
        if s.get("color"):
            kwargs["color"] = s["color"]
        if s.get("label"):
            kwargs["label"] = s["label"]
        if s.get("lineWidth"):
            kwargs["line_width"] = s["lineWidth"]
        if s.get("lineStyle"):
            kwargs["line_style"] = s["lineStyle"]
        if s.get("fillOpacity"):
            kwargs["fill_opacity"] = s["fillOpacity"]
        if x:
            ax.plot(x, data, **kwargs)
        else:
            ax.plot(data, **kwargs)


def _render_bar(ax, series: list, x_labels: list):
    labels = x_labels or [str(i) for i in range(len(series[0].get("data", [])))]
    for s in series:
        kwargs = {}
        if s.get("color"):
            kwargs["color"] = s["color"]
        if s.get("label"):
            kwargs["label"] = s["label"]
        ax.bar(labels, s.get("data", []), **kwargs)


def _render_scatter(ax, series: list, bubble: bool = False):
    for s in series:
        data_y = s.get("data", [])
        data_x = s.get("x", list(range(len(data_y))))
        kwargs = {}
        if s.get("color"):
            kwargs["color"] = s["color"]
        if s.get("label"):
            kwargs["label"] = s["label"]
        size = s.get("markerSize", 4)
        kwargs["size"] = size
        sizes = s.get("sizes")
        if bubble and sizes:
            for i in range(len(data_y)):
                ax.scatter(
                    [data_x[i]], [data_y[i]],
                    color=s.get("color"),
                    size=sizes[i] if i < len(sizes) else size,
                )
            if s.get("label"):
                ax.scatter([], [], color=s.get("color"), label=s["label"])
        else:
            ax.scatter(data_x, data_y, **kwargs)


def _render_area(ax, series: list, x_labels: list):
    for s in series:
        data = s.get("data", [])
        x = s.get("x", list(range(len(data))))
        color = s.get("color")
        kwargs = {}
        if color:
            kwargs["color"] = color
        if s.get("label"):
            kwargs["label"] = s["label"]
        if s.get("fillOpacity"):
            kwargs["fill_opacity"] = s["fillOpacity"]
        if x_labels:
            ax.plot(data, **kwargs)
        else:
            ax.plot(x, data, **kwargs)
        fill_kwargs = {}
        if color:
            fill_kwargs["color"] = color
        fill_kwargs["alpha"] = s.get("fillOpacity", 0.12)
        ax.fill_between(x, data, 0, **fill_kwargs)


def _render_histogram(ax, series: list, bins: int):
    for s in series:
        kwargs = {"bins": bins}
        if s.get("color"):
            kwargs["color"] = s["color"]
        if s.get("label"):
            kwargs["label"] = s["label"]
        ax.hist(s.get("data", []), **kwargs)


def _render_pie(ax, spec: dict, chart_type: str):
    """Render pie/donut chart."""
    slices = spec.get("slices", [])
    if not slices:
        return
    PIE_COLORS = ["#4aaaba", "#d8b4fe", "#fbbf24", "#f9a8d4", "#6dd5c8",
                  "#a5f3d8", "#C084FC", "#FF6B6B", "#67E8F9", "#FFD93D"]
    labels = [s["label"] for s in slices]
    values = [s["value"] for s in slices]
    colors = [s.get("color", PIE_COLORS[i % len(PIE_COLORS)]) for i, s in enumerate(slices)]
    kwargs = {"labels": labels, "colors": colors}
    if chart_type == "donut":
        kwargs["donut"] = True
        kwargs["donut_ratio"] = spec.get("donutRatio", 0.55)
    ax.pie(values, **kwargs)


def _render_candlestick(ax, series: list, x_labels: list):
    """Render candlestick as bars."""
    if not series:
        return
    s = series[0]
    opens = s.get("open", [])
    highs = s.get("high", [])
    lows = s.get("low", [])
    closes = s.get("close", [])
    n = len(opens)
    for i in range(n):
        ax.plot([lows[i], highs[i]], x=[i, i], color="#707070", line_width=0.8)
        color = "#4ECDC4" if closes[i] >= opens[i] else "#FF6B6B"
        body_low = min(opens[i], closes[i])
        body_high = max(opens[i], closes[i])
        lbl = x_labels[i] if i < len(x_labels) else str(i)
        ax.bar([lbl], [body_high - body_low], color=color)
    if x_labels:
        ax.set_xticks(x_labels)


def _render_waterfall(ax, series: list, x_labels: list):
    """Render waterfall as sequential bars."""
    if not series:
        return
    data = series[0].get("data", [])
    labels = x_labels or [str(i) for i in range(len(data))]
    pos_vals = []
    neg_vals = []
    for val in data:
        if val >= 0:
            pos_vals.append(val)
            neg_vals.append(0)
        else:
            pos_vals.append(0)
            neg_vals.append(abs(val))
    ax.bar(labels, pos_vals, label=series[0].get("label", "Positive"), color="#4ECDC4")
    if any(v > 0 for v in neg_vals):
        ax.bar(labels, neg_vals, label="Negative", color="#FF6B6B")


def _render_violin(ax, series: list):
    """Render violin chart."""
    datasets = []
    labels = []
    colors = []
    for s in series:
        data = s.get("data", [])
        if data:
            datasets.append(data)
            labels.append(s.get("label", ""))
            if s.get("color"):
                colors.append(s["color"])
    if datasets:
        kwargs = {}
        if labels:
            kwargs["labels"] = labels
        if colors:
            kwargs["color"] = colors[0] if len(colors) == 1 else colors[0]
        ax.violin(datasets, **kwargs)


def _render_boxplot(ax, series: list):
    """Render boxplot from pre-computed stats or raw data."""
    # Check if series has pre-computed stats (q1, median, q3, etc.)
    if series and "q1" in series[0]:
        # Pre-computed stats — render as raw data approximation
        datasets = []
        labels = []
        for s in series:
            # Generate approximate data from quartile stats
            import random
            q1 = s.get("q1", 0)
            median = s.get("median", 0)
            q3 = s.get("q3", 0)
            wl = s.get("whiskerLow", q1)
            wh = s.get("whiskerHigh", q3)
            # Create representative data
            data = [wl, q1, q1, median, median, median, q3, q3, wh]
            for o in s.get("outliers", []):
                data.append(o)
            datasets.append(data)
            labels.append(s.get("label", ""))
        kwargs = {}
        if labels:
            kwargs["labels"] = labels
        ax.boxplot(datasets, **kwargs)
    else:
        # Raw data
        datasets = [s.get("data", []) for s in series if s.get("data")]
        labels = [s.get("label", "") for s in series if s.get("data")]
        kwargs = {}
        if labels:
            kwargs["labels"] = labels
        if datasets:
            ax.boxplot(datasets, **kwargs)


def _render_heatmap(ax, spec: dict):
    """Render heatmap as colored scatter points."""
    heatmap = spec.get("heatmap", {})
    data = heatmap.get("data", [])
    col_labels = heatmap.get("colLabels", [])
    if not data:
        return
    flat = [v for row in data for v in row]
    vmin, vmax = min(flat), max(flat)
    vrange = vmax - vmin if vmax != vmin else 1
    for r in range(len(data)):
        for c in range(len(data[0])):
            norm = (data[r][c] - vmin) / vrange
            red = int(norm * 255)
            blue = int((1 - norm) * 255)
            color = f"#{red:02x}40{blue:02x}"
            ax.scatter([c], [r], color=color, size=20)
    if col_labels:
        ax.set_xticks(col_labels)
