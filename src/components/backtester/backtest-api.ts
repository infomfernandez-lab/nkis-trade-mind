export const SERVER_URL = 'https://ointment-handcraft-payee.ngrok-free.dev';

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price?: number;
  sl_price?: number;
  tp_price?: number | null;
  lot_size?: number;
  days?: number;
  mfe?: number;
  pnl: number;
  reason?: string;
}

export interface BacktestMetrics {
  win_rate?: number;
  profit_factor?: number;
  sharpe?: number;
  pnl?: number;
  drawdown?: number;
  trades?: number;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equity_curve: Array<{ date?: string; equity: number }>;
  trades: BacktestTrade[];
}

/** Normalize raw server response → BacktestResult.
 * The Python backend returns trades with fields like `sl`, `lots`, `exit_reason`;
 * we map them to our internal shape so charts and tables show the correct data. */
export function normalizeBacktestResult(raw: any): BacktestResult {
  const trades: BacktestTrade[] = (raw?.trades ?? []).map((t: any) => ({
    entry_date: t.entry_date ?? t.entryDate ?? '',
    exit_date: t.exit_date ?? t.exitDate ?? '',
    entry_price: Number(t.entry_price ?? t.entryPrice ?? 0),
    exit_price: t.exit_price ?? t.exitPrice ?? undefined,
    sl_price: Number(t.sl_price ?? t.sl ?? t.stop_loss ?? 0) || undefined,
    tp_price: t.tp == null && t.tp_price == null ? null : Number(t.tp ?? t.tp_price) || null,
    lot_size: Number(t.lot_size ?? t.lots ?? t.size ?? 0) || undefined,
    days: t.days ?? t.duration_days ?? undefined,
    mfe: t.mfe ?? t.max_favorable ?? undefined,
    pnl: Number(t.pnl ?? t.profit ?? t.net_pnl ?? 0),
    reason: t.reason ?? t.exit_reason ?? t.close_reason ?? undefined,
  }));
  return {
    metrics: raw?.metrics ?? {},
    equity_curve: raw?.equity_curve ?? [],
    trades,
  };
}
