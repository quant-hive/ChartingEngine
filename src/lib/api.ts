// Stub for API functions referenced by chartEngine.tsx
// TODO: wire to actual backend when available

export async function createChart(_params: { chart_type: string; backtest_id: string }): Promise<any> {
  return {};
}

export async function getBacktestCharts(_backtestId: string): Promise<any[]> {
  return [];
}
