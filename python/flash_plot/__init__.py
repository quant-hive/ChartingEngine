"""Flash Plot — Pure Python charting engine for the Flash Charting Engine.

Two ways to use:

1. MCP ChartSpec JSON (recommended — same schema as chart_render MCP tool):

    from flash_plot import render_chart

    render_chart({
        "type": "bar",
        "title": "Revenue",
        "series": [{"data": [10, 20, 30], "label": "Q1"}],
        "xLabels": ["Jan", "Feb", "Mar"],
        "grid": True,
        "legend": {"show": True}
    })

2. Matplotlib-like API:

    from flash_plot import FlashPlot

    fig = FlashPlot()
    fig.plot([0, 5, 12, 8, 18], color="#d4d4d4", label="Strategy")
    fig.set_title("Returns")
    fig.grid(True)
    fig.legend()
    fig.show()
"""

from .engine import FlashPlot
from .spec_renderer import render_chart

__version__ = "0.2.0"
__all__ = ["FlashPlot", "render_chart"]
