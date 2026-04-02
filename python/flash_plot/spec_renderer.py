"""Render charts from MCP ChartSpec JSON schema.

Accepts the same JSON format as the chart_render MCP tool and renders
SVG via the FlashPlot engine. This lets you test charts using the exact
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
from .engine import FlashPlot, COLOR_PALETTES, BAR_STYLES


def render_chart(spec: Dict[str, Any], *, display: bool = True) -> str:
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
    str
        The rendered SVG string.
    """
    chart_type = spec.get("type", "line")
    width = spec.get("width", 595)
    height = spec.get("height", 300)

    fig = FlashPlot(width=width, height=height)

    # Title / subtitle
    if spec.get("title"):
        fig.set_title(spec["title"])
    if spec.get("subtitle"):
        fig.set_subtitle(spec["subtitle"])

    # Grid
    if spec.get("grid"):
        fig.grid(True)

    # X-axis labels
    x_labels = spec.get("xLabels", [])

    # Series data
    series_list = spec.get("series", [])

    if chart_type == "line":
        _render_line(fig, series_list, x_labels)
    elif chart_type == "bar":
        _render_bar(fig, series_list, x_labels)
    elif chart_type == "stacked_bar":
        _render_bar(fig, series_list, x_labels)
    elif chart_type == "scatter":
        _render_scatter(fig, series_list)
    elif chart_type == "bubble":
        _render_scatter(fig, series_list, bubble=True)
    elif chart_type == "area":
        _render_area(fig, series_list, x_labels)
    elif chart_type == "histogram":
        _render_histogram(fig, series_list, spec.get("bins", 20))
    elif chart_type in ("pie", "donut"):
        _render_pie(fig, spec)
    elif chart_type == "candlestick":
        _render_candlestick(fig, series_list, x_labels)
    elif chart_type == "waterfall":
        _render_waterfall(fig, series_list, x_labels)
    elif chart_type in ("violin", "boxplot"):
        _render_distribution(fig, series_list, x_labels, chart_type)
    elif chart_type == "heatmap":
        _render_heatmap(fig, spec)
    else:
        # Fallback: treat as line
        _render_line(fig, series_list, x_labels)

    # Horizontal / vertical reference lines
    for hl in spec.get("hlines", []):
        fig.axhline(hl["y"], color=hl.get("color", "#494949"),
                    line_style=hl.get("lineStyle", "dashed"))
    for vl in spec.get("vlines", []):
        fig.axvline(vl["x"], color=vl.get("color", "#494949"),
                    line_style=vl.get("lineStyle", "dashed"))

    # Annotations
    for ann in spec.get("annotations", []):
        fig.text(ann["x"], ann["y"], ann["text"],
                 color=ann.get("color", "#808080"))

    # Legend
    legend_cfg = spec.get("legend", {})
    if legend_cfg.get("show", False):
        fig.legend()

    # X ticks override
    if x_labels and chart_type not in ("bar", "stacked_bar", "waterfall"):
        fig.set_xticks(x_labels)

    svg = fig.render()

    if display:
        fig.show()
        return None

    return svg


# ── Chart type renderers ──────────────────────────────────────────────────

def _render_line(fig: FlashPlot, series: list, x_labels: list):
    for s in series:
        data = s.get("data", [])
        x = s.get("x")
        fig.plot(
            data,
            x=x,
            color=s.get("color"),
            label=s.get("label"),
            line_width=s.get("lineWidth", 1.5),
            line_style=s.get("lineStyle", "solid"),
            fill_opacity=s.get("fillOpacity"),
        )


def _render_bar(fig: FlashPlot, series: list, x_labels: list):
    labels = x_labels or [str(i) for i in range(len(series[0].get("data", [])))]
    for s in series:
        fig.bar(
            labels,
            s.get("data", []),
            color=s.get("color"),
            label=s.get("label"),
        )


def _render_scatter(fig: FlashPlot, series: list, bubble: bool = False):
    for s in series:
        data_y = s.get("data", [])
        data_x = s.get("x", list(range(len(data_y))))
        sizes = s.get("sizes")
        size = s.get("markerSize", 4)
        if bubble and sizes:
            # Render each point with individual size
            for i in range(len(data_y)):
                fig.scatter(
                    [data_x[i]], [data_y[i]],
                    color=s.get("color"),
                    size=sizes[i] if i < len(sizes) else size,
                )
            if s.get("label"):
                # Add one more invisible point just for the legend
                fig.scatter([], [], color=s.get("color"), label=s.get("label"))
        else:
            fig.scatter(
                data_x, data_y,
                color=s.get("color"),
                label=s.get("label"),
                size=size,
            )


def _render_area(fig: FlashPlot, series: list, x_labels: list):
    for s in series:
        data = s.get("data", [])
        x = s.get("x", list(range(len(data))))
        color = s.get("color")
        fig.plot(data, x=x if not x_labels else None, color=color, label=s.get("label"))
        fig.fill_between(x, data, 0, color=color, alpha=s.get("fillOpacity", 0.12))


def _render_histogram(fig: FlashPlot, series: list, bins: int):
    for s in series:
        fig.hist(
            s.get("data", []),
            bins=bins,
            color=s.get("color"),
            label=s.get("label"),
        )


def _render_pie(fig: FlashPlot, spec: dict):
    """Render pie/donut as a horizontal bar chart (SVG pie arcs not yet supported)."""
    slices = spec.get("slices", [])
    if not slices:
        return
    palette = COLOR_PALETTES["pie"]
    labels = [s["label"] for s in slices]
    values = [s["value"] for s in slices]
    colors = [s.get("color", palette[i % len(palette)]) for i, s in enumerate(slices)]
    # Render as bar chart since pure SVG pie arcs are complex
    for i, (lbl, val, clr) in enumerate(zip(labels, values, colors)):
        fig.bar([lbl], [val], color=clr, label=lbl)


def _render_candlestick(fig: FlashPlot, series: list, x_labels: list):
    """Render candlestick as high-low lines + open-close bars."""
    if not series:
        return
    s = series[0]
    opens = s.get("open", [])
    highs = s.get("high", [])
    lows = s.get("low", [])
    closes = s.get("close", [])
    n = len(opens)
    for i in range(n):
        x_pos = [i]
        # High-low wick as thin line
        mid = (opens[i] + closes[i]) / 2
        fig.plot([lows[i], highs[i]], x=[i, i], color="#707070", line_width=0.8)
        # Body: green if close > open, red if close < open
        color = "#4ECDC4" if closes[i] >= opens[i] else "#FF6B6B"
        body_low = min(opens[i], closes[i])
        body_high = max(opens[i], closes[i])
        fig.bar([x_labels[i] if i < len(x_labels) else str(i)],
                [body_high - body_low], color=color)
    if x_labels:
        fig.set_xticks(x_labels)


def _render_waterfall(fig: FlashPlot, series: list, x_labels: list):
    """Render waterfall as sequential bars."""
    if not series:
        return
    data = series[0].get("data", [])
    labels = x_labels or [str(i) for i in range(len(data))]
    cumulative = 0
    pos_vals = []
    neg_vals = []
    for val in data:
        if val >= 0:
            pos_vals.append(val)
            neg_vals.append(0)
        else:
            pos_vals.append(0)
            neg_vals.append(abs(val))
        cumulative += val
    fig.bar(labels, pos_vals, label=series[0].get("label", "Positive"), color="#4ECDC4")
    if any(v > 0 for v in neg_vals):
        fig.bar(labels, neg_vals, label="Negative", color="#FF6B6B")


def _render_distribution(fig: FlashPlot, series: list, x_labels: list, chart_type: str):
    """Render violin/boxplot as histogram approximation."""
    for s in series:
        data = s.get("data", [])
        if data:
            fig.hist(data, bins=15, color=s.get("color"), label=s.get("label"))


def _render_heatmap(fig: FlashPlot, spec: dict):
    """Render heatmap as colored rectangles."""
    heatmap = spec.get("heatmap", {})
    data = heatmap.get("data", [])
    row_labels = heatmap.get("rowLabels", [])
    col_labels = heatmap.get("colLabels", [])
    if not data:
        return
    # Flatten to find range
    flat = [v for row in data for v in row]
    vmin, vmax = min(flat), max(flat)
    vrange = vmax - vmin if vmax != vmin else 1
    n_rows = len(data)
    n_cols = len(data[0]) if data else 0
    # Use scatter points to approximate heatmap cells
    for r in range(n_rows):
        for c in range(n_cols):
            norm = (data[r][c] - vmin) / vrange
            # Interpolate between blue and red
            red = int(norm * 255)
            blue = int((1 - norm) * 255)
            color = f"#{red:02x}40{blue:02x}"
            fig.scatter([c], [r], color=color, size=20)
    if col_labels:
        fig.set_xticks(col_labels)
