# Flash Plot — Charting Engine

Interactive charting engine with animated bar glow effects, 15+ chart types, MCP integration, and a Python package for Colab/Jupyter.

## Quick Start

```bash
git clone https://github.com/quant-hive/ChartingEngine.git
cd ChartingEngine
npm install
npm run dev
```

Open **http://localhost:3000** — the playground lets you paste ChartSpec JSON and render charts with full animations.

### Routes

| Route | Description |
|-------|-------------|
| `/` | Interactive playground — JSON editor + live chart preview |
| `/test` | Chart gallery — 14 demo charts using the matplotlib-like API |
| `/playground` | Alias of the playground page |
| `/api/chart/render` | POST endpoint — accepts ChartSpec JSON, returns Scene JSON |

---

## Architecture

```
ChartSpec JSON ──> renderChart() ──> Scene JSON ──> <FlashChart /> (React)
       │                                    │
       │                                    └──> renderSceneToSvg() (static SVG)
       │
       └──> MCP Server (stdio) ──> AI Agent
       └──> POST /api/chart/render ──> HTTP Client
       └──> render_chart(spec) ──> Python/Colab
```

### File Structure

```
src/
├── lib/
│   ├── plot/
│   │   ├── core/           # Framework-agnostic engine
│   │   │   ├── renderChart.ts   # ChartSpec → Scene renderer
│   │   │   ├── figure.ts        # Matplotlib-like API (figure, axes)
│   │   │   ├── theme.ts         # FLASH_DARK theme definition
│   │   │   ├── layout.ts        # Subplot layout & positioning
│   │   │   ├── scales.ts        # Axis computation (linear, log, categorical)
│   │   │   ├── paths.ts         # SVG path generation
│   │   │   └── types.ts         # Core data structures (Scene, PlotElement, etc.)
│   │   ├── react/           # React renderers
│   │   │   ├── FlashChart.tsx   # Main SVG renderer with animations & glow
│   │   │   ├── PieChart.tsx     # Pie/donut charts
│   │   │   ├── Surface3D.tsx    # Interactive 3D surface
│   │   │   └── useAnimation.ts  # Animation phases & shimmer
│   │   └── server/
│   │       └── renderSvg.ts     # Server-side SVG rendering
│   └── chartEngine.tsx      # Chart wrapper components (settings dropdown, header)
├── mcp/
│   ├── server.ts            # MCP server entry point (stdio transport)
│   └── tools/
│       ├── chartRender.ts   # chart_render tool implementation
│       ├── chartResolve.ts  # chart_resolve_type tool
│       └── chartStyles.ts   # chart_get_styles tool
├── app/
│   ├── page.tsx             # Playground (ChartSpec JSON editor + preview)
│   ├── test/page.tsx        # Chart gallery (14 demo charts)
│   └── api/chart/
│       ├── route.ts         # Chart data API
│       └── render/route.ts  # ChartSpec → Scene/SVG endpoint
python/
├── flash_plot/
│   ├── engine.py            # SVG renderer matching frontend visuals
│   ├── spec_renderer.py     # render_chart(spec) — MCP schema interface
│   └── __init__.py
└── setup.py
notebooks/
└── flash_plot_demo.ipynb    # Colab notebook with MCP schema examples
```

---

## Chart Types

| Type | Component | Description |
|------|-----------|-------------|
| `line` | FlashChart | Time series, multi-series comparison |
| `bar` | FlashChart | Grouped bars with animated glow |
| `stacked_bar` | FlashChart | Stacked bar chart |
| `scatter` | FlashChart | Correlation, risk-return plots |
| `bubble` | FlashChart | Scatter with variable marker sizes |
| `area` | FlashChart | Filled area with gradient |
| `histogram` | FlashChart | Frequency distribution (auto-binned) |
| `candlestick` | FlashChart | OHLC financial data |
| `waterfall` | FlashChart | Sequential +/- contributions |
| `heatmap` | FlashChart | 2D color-mapped grid |
| `violin` | FlashChart | Distribution shape comparison |
| `boxplot` | FlashChart | Statistical box-and-whisker |
| `pie` | PieChart | Proportional breakdown |
| `donut` | PieChart | Pie with hollow center |
| `surface_3d` | Surface3D | Interactive 3D surface with rotation/zoom |

---

## ChartSpec JSON Schema

This is the input format for `renderChart()`, the MCP `chart_render` tool, and `POST /api/chart/render`.

```json
{
  "type": "line",
  "title": "Strategy vs Benchmark",
  "subtitle": "Cumulative returns (%)",
  "width": 595,
  "height": 260,
  "grid": true,

  "series": [
    {
      "data": [0, 5, 12, 8, 18],
      "x": [0, 1, 2, 3, 4],
      "label": "Strategy",
      "color": "#d4d4d4",
      "lineWidth": 1.5,
      "lineStyle": "solid | dashed | dotted | dashdot",
      "fillOpacity": 0.15,
      "markerSize": 4,
      "sizes": [5, 10, 15],
      "open": [], "high": [], "low": [], "close": [],
      "stacked": false,
      "barWidth": 18,
      "q1": 0, "median": 0, "q3": 0,
      "whiskerLow": 0, "whiskerHigh": 0,
      "outliers": []
    }
  ],

  "slices": [
    { "label": "Equities", "value": 45, "color": "#4aaaba" }
  ],
  "donutRatio": 0.55,

  "surface": {
    "z": [[0.3, 0.25], [0.25, 0.2]],
    "x": null, "y": null,
    "wireframe": true
  },

  "heatmap": {
    "data": [[1.0, 0.5], [0.5, 1.0]],
    "rowLabels": ["A", "B"],
    "colLabels": ["A", "B"],
    "colorRange": ["#0000ff", "#ff0000"]
  },

  "bins": 20,
  "xLabels": ["Jan", "Feb", "Mar", "Apr", "May"],

  "xAxis": { "label": "Date", "min": 0, "max": 100, "scale": "linear | log | symlog" },
  "yAxis": { "label": "Return (%)", "min": -10, "max": 50, "scale": "linear" },

  "legend": { "show": true, "position": "best | upper-left | upper-right | lower-left | lower-right" },

  "hlines": [{ "y": 0, "color": "#707070", "label": "Zero", "lineStyle": "dashed" }],
  "vlines": [{ "x": 5, "color": "#FF6B6B", "lineStyle": "dashed" }],
  "annotations": [{ "text": "Peak", "x": 3, "y": 18, "color": "#808080" }]
}
```

---

## FLASH_DARK Theme

| Token | Value |
|-------|-------|
| Background | `#121212` |
| Surface | `#0f0f0f` |
| Text Primary | `#ffffff` |
| Text Secondary | `#8f8f8f` |
| Text Axis | `#494949` |
| Grid Color | `#2a2a2a` |
| Grid Width | `0.3` |
| Title Font | EB Garamond 18px, weight 400, spacing -0.2px |
| Subtitle Font | Inter 11px, weight 400, color #555555 |
| Axis Font | Inter 10px, weight 500, spacing -0.12px |

### Bar Glow Styles

| Property | Series 1 (Pink) | Series 2 (Blue) |
|----------|-----------------|-----------------|
| fill | `#EF8CFF` | `#8CA5FF` |
| sideGlow | `#624096` | `#405A96` |
| topGlow | `#763AA4` | `#3A5FA4` |
| bottomGlow | `#7B42DD` | `#427BDD` |
| leftEdge | `#7432E6` | `#3268E6` |
| sparkle | `#E49BFF` | `#9BB6FF` |
| gradTop | `#e586fa` | `#86bafa` |
| gradBottom | `#884f94` | `#4f7194` |

### Color Palettes

```json
{
  "line": ["#d4d4d4", "#707070", "#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#FCA5A5"],
  "bar":  ["#EF8CFF", "#8CA5FF", "#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC"],
  "scatter": ["#4ECDC4", "#FFD93D", "#FF6B6B", "#C084FC", "#67E8F9", "#d4d4d4"],
  "area": ["#4ECDC4", "#C084FC", "#FFD93D", "#FF6B6B", "#67E8F9", "#d4d4d4"],
  "histogram": ["#C084FC", "#4ECDC4", "#FFD93D"],
  "pie": ["#4aaaba", "#d8b4fe", "#fbbf24", "#f9a8d4", "#6dd5c8", "#a5f3d8", "#C084FC", "#FF6B6B", "#67E8F9", "#FFD93D"]
}
```

---

## Bar Glow Effect

Each bar renders 8 layered elements inside a clipped `<svg>` viewport:

1. **Fill rect** — base color (`st.fill`)
2. **Side glow** — curved Bezier path with `st.sideGlow`, Gaussian blur (stdDeviation=5)
3. **Top highlight** — rect at top edge with `st.topGlow`, blur (stdDeviation=4)
4. **Bottom glow** — curved path at bottom with `st.bottomGlow`, blur (stdDeviation=5)
5. **Left edge** — curved path on left with `st.leftEdge`, blur (stdDeviation=5)
6. **Sparkle dots** — 15 circles with `st.sparkle`, animated float
7. **Bottom white** — triangular path, white at 80% opacity, blur (stdDeviation=2.25)
8. **Top white** — triangular path, white at 80% opacity, blur (stdDeviation=2.25)

### Animations (FlashChart.tsx)

| Phase | Animation | Duration | Start |
|-------|-----------|----------|-------|
| Grid | `fp-gridDraw` stroke-dashoffset | 0.675s | 0s + i*0.08s |
| Labels | `fp-labelFadeY/X` opacity + translate | 0.35s | 0.675s + i*0.04s |
| Bars | `fp-barGrow` scaleY(0→1) | 0.81s | 1.28s + i*0.054s |
| Lines | `fp-lineDraw` stroke-dashoffset | 1.89s | 1.28s + i*0.2s |
| Areas | `fp-areaFade` opacity | 1.08s | 1.28s + i*0.135s |
| Scatter | `fp-scatterPop` opacity + radius | 0.5s | 1.28s + i*0.02s |
| Shimmer | `fp-shimmer` fill color cycle | 0.24s | 2.5s + i*0.08s |
| Glow | `fp-glowFadeIn` opacity | 0.5s | after shimmer |
| Sparkle | `fp-sparkleFloat1/2/3` translate + opacity | 2.5-5s | continuous |
| Drift | `fp-glowDrift1/2/3` micro translate | 3.5-4.2s | continuous |

---

## MCP Server

Three tools available via stdio transport. Register in `.mcp.json`:

```json
{
  "mcpServers": {
    "flash-plot": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"]
    }
  }
}
```

Or run directly: `npx tsx src/mcp/server.ts`

### Tool: `chart_render`

Render a chart from ChartSpec JSON.

**Input:**
```json
{
  "spec": { "type": "bar", "series": [...], ... },
  "format": "scene | svg"
}
```

**Output:**
```json
{
  "componentHint": "FlashChart | PieChart | Surface3D",
  "chartType": "bar",
  "scene": { ... },
  "svg": "<svg>...</svg>"
}
```

The `componentHint` tells the frontend which React component to render:
- `FlashChart` — standard charts (line, bar, scatter, histogram, etc.)
- `PieChart` — pie/donut charts
- `Surface3D` — interactive 3D surface

### Tool: `chart_resolve_type`

Recommend the best chart type for given data.

**Input:**
```json
{
  "description": "monthly revenue by product category",
  "columns": ["date", "product", "revenue"]
}
```

**Output:**
```json
{
  "recommendedType": "bar",
  "alternatives": ["stacked_bar", "line"],
  "reasoning": "Categorical comparison -- bar chart shows values across categories.",
  "exampleSpec": { "type": "bar", "title": "Comparison", ... }
}
```

**Resolution rules:** OHLC keywords → candlestick, surface/3D → surface_3d, correlation/matrix → heatmap, proportion/share → pie, waterfall/cumulative → waterfall, distribution → histogram, scatter/relationship → scatter, comparison/category → bar, time/date → line.

### Tool: `chart_get_styles`

Get current theme, color palettes, and supported chart types.

**Input:** none

**Output:**
```json
{
  "theme": { ... },
  "availableThemes": ["flash-dark"],
  "palettes": { "line": [...], "bar": [...], ... },
  "chartTypes": [
    { "type": "line", "description": "Line chart for time series and trends" },
    { "type": "bar", "description": "Bar chart for categorical comparisons" },
    ...
  ]
}
```

---

## HTTP API

### POST `/api/chart/render`

```bash
curl -X POST http://localhost:3000/api/chart/render \
  -H "Content-Type: application/json" \
  -d '{
    "spec": {
      "type": "bar",
      "title": "Revenue",
      "series": [{"data": [10, 20, 30], "label": "Q1"}],
      "xLabels": ["Jan", "Feb", "Mar"],
      "grid": true
    },
    "format": "scene"
  }'
```

Returns the same JSON as the MCP `chart_render` tool. CORS enabled.

---

## Python Package (Colab/Jupyter)

> **⚠️ IMPORTANT: The repository must be set to PUBLIC for `pip install` from GitHub to work. If you're testing charts in Colab/Jupyter notebooks, make sure the repo visibility is set to public first, otherwise the install command will fail with a 404 error.**

### Install

```bash
pip install git+https://github.com/quant-hive/ChartingEngine.git#subdirectory=python
```

### Usage with MCP Schema

```python
from flash_plot import render_chart

render_chart({
    "type": "bar",
    "title": "Sector Allocation",
    "series": [
        {"data": [28, 18, 15, 12], "label": "Current"},
        {"data": [22, 20, 18, 10], "label": "Target"}
    ],
    "xLabels": ["Tech", "Health", "Finance", "Energy"],
    "grid": True,
    "legend": {"show": True}
})
```

### Usage with Matplotlib-like API

```python
from flash_plot import FlashPlot

fig = FlashPlot(width=595, height=300)
fig.set_title("Cumulative Returns")
fig.plot([0, 5, 12, 8, 18], color="#d4d4d4", label="Strategy")
fig.plot([0, 3, 6, 5, 9], color="#707070", label="Benchmark")
fig.grid(True)
fig.legend()
fig.show()
```

### Colab Compatibility

The Python engine uses SVG `<animate>` elements for animations (bar grow, glow fade, sparkle float, grid draw, label shimmer) and gradient-based glow layers with the exact Bezier paths from FlashChart.tsx. No `<style>` tags, no `<filter>` elements — survives Colab's HTML sanitizer.

### Notebook

See `notebooks/flash_plot_demo.ipynb` — 12 examples using MCP ChartSpec JSON.

---

## Interactive Features (Frontend)

| Feature | Description |
|---------|-------------|
| Hover tooltips | Value display on bar/line/scatter hover |
| Crosshair | Vertical dashed line following cursor on line charts |
| Bar glow on hover | Additional glow layers activated on bar hover |
| Settings dropdown | Toggle grid, axis labels, legend; switch theme (dark/light/naked) |
| Editable titles | Click title/subtitle to edit inline |
| Scrollable bars | Left/right arrows + wheel scroll when >12 bars |
| 3D surface | Drag to rotate, scroll to zoom |
| Pie interaction | Hover to highlight slice |

---

## Settings Dropdown

The `ChartSettingsDropdown` component appears top-right of each chart:

- **Grid Lines** — toggle grid visibility
- **Axis Labels** — toggle tick label visibility
- **Legend** — toggle legend visibility
- **Theme** — Dark (#121212), Light (#fafafa), Naked (transparent)

---

## ChartSpec Examples

### Grouped Bar

```json
{
  "type": "bar",
  "title": "Sector Allocation",
  "subtitle": "Portfolio weight (%)",
  "series": [
    {"data": [28, 18, 15, 12, 14, 13], "label": "Current"},
    {"data": [22, 20, 18, 10, 16, 14], "label": "Target"}
  ],
  "xLabels": ["Tech", "Health", "Finance", "Energy", "Consumer", "Industrial"],
  "grid": true,
  "legend": {"show": true}
}
```

### Line Chart

```json
{
  "type": "line",
  "title": "Strategy vs Benchmark",
  "series": [
    {"data": [0, 5, 12, 8, 18, 25, 20, 32], "label": "Strategy", "color": "#d4d4d4"},
    {"data": [0, 3, 6, 5, 9, 12, 11, 15], "label": "Benchmark", "color": "#707070"}
  ],
  "xLabels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
  "grid": true,
  "legend": {"show": true}
}
```

### Scatter

```json
{
  "type": "scatter",
  "title": "Risk vs Return",
  "series": [
    {"data": [8, 12, 6, 15, 10], "x": [5, 8, 3, 12, 7], "label": "Funds", "color": "#4ECDC4", "markerSize": 6}
  ],
  "grid": true,
  "hlines": [{"y": 0, "color": "#707070", "lineStyle": "dashed"}]
}
```

### Pie

```json
{
  "type": "pie",
  "title": "Portfolio Allocation",
  "slices": [
    {"label": "Equities", "value": 45},
    {"label": "Bonds", "value": 25},
    {"label": "Real Estate", "value": 15},
    {"label": "Cash", "value": 15}
  ]
}
```

### Candlestick

```json
{
  "type": "candlestick",
  "title": "NVDA Daily",
  "series": [{
    "data": [130, 135, 128, 140, 138],
    "open": [125, 130, 136, 127, 141],
    "high": [132, 137, 138, 142, 143],
    "low": [123, 128, 126, 125, 136],
    "close": [130, 135, 128, 140, 138]
  }],
  "xLabels": ["Mon", "Tue", "Wed", "Thu", "Fri"]
}
```

### Histogram

```json
{
  "type": "histogram",
  "title": "Return Distribution",
  "series": [{"data": [-3, -1.5, 0, 0.5, 1, 1.5, 2, 3, -0.5, 0.8], "label": "Returns"}],
  "bins": 15,
  "grid": true
}
```

### Surface 3D

```json
{
  "type": "surface_3d",
  "title": "Volatility Surface",
  "surface": {
    "z": [[0.3, 0.25, 0.2], [0.25, 0.2, 0.17], [0.2, 0.17, 0.15]],
    "wireframe": true
  }
}
```

### Waterfall

```json
{
  "type": "waterfall",
  "title": "P&L Bridge",
  "series": [{"data": [50, 12, -8, 25, -15, 18], "label": "Revenue"}],
  "xLabels": ["Base", "Sales", "Churn", "Upsell", "Refunds", "Growth"],
  "grid": true
}
```

### Heatmap

```json
{
  "type": "heatmap",
  "title": "Correlation Matrix",
  "heatmap": {
    "data": [[1.0, 0.85, -0.15], [0.85, 1.0, -0.22], [-0.15, -0.22, 1.0]],
    "rowLabels": ["SPY", "QQQ", "TLT"],
    "colLabels": ["SPY", "QQQ", "TLT"]
  }
}
```
