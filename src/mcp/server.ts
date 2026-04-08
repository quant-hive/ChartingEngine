#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { executeChartRender } from "./tools/chartRender.js";
import { resolveChartType } from "./tools/chartResolve.js";
import { getChartStyles } from "./tools/chartStyles.js";
import { ChartSpecSchema } from "../lib/plot/core/chartSpecSchema.js";

// ── Server setup ────────────────────────────────────────────────────────

const server = new McpServer({
  name: "flash-plot",
  version: "1.0.0",
});

// ── Tool: chart_render ──────────────────────────────────────────────────

server.tool(
  "chart_render",
  "Render a chart from a ChartSpec JSON. Returns a Scene graph (for FlashChart), pie slice data (for PieChart), or surface data (for Surface3D) — plus an optional SVG string. The componentHint field tells the frontend which React component to use.",
  {
    spec: ChartSpecSchema.describe("Full ChartSpec — the JSON schema for chart rendering"),
    format: z.enum(["scene", "svg"]).optional().describe("Output format. 'scene' returns JSON for React components (default). 'svg' also includes a static SVG string."),
  },
  async ({ spec, format }) => {
    try {
      const result = executeChartRender(spec as any, format ?? "scene");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: err.message ?? "Render failed" }),
          },
        ],
        isError: true,
      };
    }
  }
);

// ── Tool: chart_resolve_type ────────────────────────────────────────────

server.tool(
  "chart_resolve_type",
  "Given a description of the data and optionally column names, recommend the best chart type. Returns the recommended type, alternatives, reasoning, and a skeleton ChartSpec.",
  {
    description: z.string().describe("Natural language description of the data (e.g. 'monthly revenue by product category', 'stock OHLC prices', 'portfolio allocation weights')"),
    columns: z.array(z.string()).optional().describe("Column names from the dataset (e.g. ['date', 'open', 'high', 'low', 'close', 'volume'])"),
  },
  async ({ description, columns }) => {
    const result = resolveChartType(description, columns);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Tool: chart_get_styles ──────────────────────────────────────────────

server.tool(
  "chart_get_styles",
  "Get the current chart theme, color palettes, and list of all supported chart types with descriptions. Use this to understand available styling options before rendering.",
  {},
  async () => {
    const result = getChartStyles();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result),
        },
      ],
    };
  }
);

// ── Start server ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("flash-plot MCP server failed to start:", err);
  process.exit(1);
});
