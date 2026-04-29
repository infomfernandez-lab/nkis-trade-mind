import type { Tables } from '@/integrations/supabase/types';

// Re-export the DB row type with a convenient alias
export type TradeRow = Tables<'trades'>;
export type UserSettingsRow = Tables<'user_settings'>;
export type ScannerSessionRow = Tables<'scanner_sessions'>;

export type BrokerFilter = 'all' | 'darwinex' | 'octx';

/**
 * Normalize broker values from the DB.
 * - 'nkis' / 'darwinex'  → 'darwinex' (cuenta NKIS, futuros)
 * - 'octx'  / 'fxpro'    → 'octx'     (cuenta OCTX, CFDs)
 * Legacy 'fxpro' rows in the database are treated as 'octx'.
 */
export function normalizeBroker(raw: string | null | undefined): string {
  const v = (raw ?? '').toString().toLowerCase().trim();
  if (v === 'nkis' || v === 'darwinex') return 'darwinex';
  if (v === 'octx' || v === 'fxpro') return 'octx';
  return v || 'darwinex';
}

// Legacy Trade interface for compatibility with UI components
export interface Trade {
  id: string;
  ticket: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  slPrice: number;
  tpPrice: number;
  lotSize: number;
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  durationHours: number;
  magicNumber: number;
  eaComment: string;
  adxValue: number;
  adxState: string;
  distanceToMA50: number;
  distanceToMA50Label: string;
  momentum20d: number;
  momentumAligned: boolean;
  stochasticK: number;
  scannerRank: number | null;
  vixAtEntry: number | null;
  emotionalState: string | null;
  reasonForEntry: string | null;
  systemCompliance: string | null;
  setupDoubts: string | null;
  preTradeNotes: string | null;
  managingWait: string | null;
  manualIntervention: string | null;
  duringTradeNotes: string | null;
  howClosed: string | null;
  feelingResult: string | null;
  whatDoDifferently: string | null;
  postTradeNotes: string | null;
  status: 'open' | 'closed';
  isWin: boolean;
  broker: string;
  updatedAt: string;
}

/** Convert a Supabase trade row to the UI Trade shape */
export function rowToTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    ticket: Number(row.ticket ?? 0),
    symbol: row.symbol,
    direction: row.direction as 'BUY' | 'SELL',
    entryDate: row.entry_date,
    exitDate: row.exit_date,
    entryPrice: Number(row.entry_price),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    slPrice: Number(row.sl_price ?? 0),
    tpPrice: Number(row.tp_price ?? 0),
    lotSize: Number(row.lot_size),
    grossPnl: Number(row.gross_pnl ?? 0),
    commission: Number(row.commission ?? 0),
    swap: Number(row.swap ?? 0),
    netPnl: Number(row.net_pnl ?? 0),
    durationHours: Number(row.duration_hours ?? 0),
    magicNumber: Number(row.magic_number ?? 0),
    eaComment: row.ea_comment ?? '',
    adxValue: Number(row.adx_value ?? 0),
    adxState: row.adx_state ?? 'STABLE',
    distanceToMA50: Number(row.distance_to_ma50 ?? 0),
    distanceToMA50Label: row.distance_to_ma50_label ?? 'CLOSE',
    momentum20d: Number(row.momentum_20d ?? 0),
    momentumAligned: row.momentum_aligned ?? false,
    stochasticK: Number(row.stochastic_k ?? 0),
    scannerRank: row.scanner_rank,
    vixAtEntry: row.vix_at_entry != null ? Number(row.vix_at_entry) : null,
    emotionalState: row.emotional_state,
    reasonForEntry: row.reason_for_entry,
    systemCompliance: row.system_compliance,
    setupDoubts: row.setup_doubts,
    preTradeNotes: row.pre_trade_notes,
    managingWait: row.managing_wait,
    manualIntervention: row.manual_intervention,
    duringTradeNotes: row.during_trade_notes,
    howClosed: row.how_closed,
    feelingResult: row.feeling_result,
    whatDoDifferently: row.what_do_differently,
    postTradeNotes: row.post_trade_notes,
    status: row.is_open ? 'open' : 'closed',
    isWin: row.is_win ?? false,
    broker: normalizeBroker((row as any).broker),
    updatedAt: row.updated_at,
  };
}

/** Filter trades by broker */
export function filterByBroker(trades: Trade[], broker: BrokerFilter): Trade[] {
  if (broker === 'all') return trades;
  if (broker === 'darwinex') {
    return trades.filter(t => t.broker === 'darwinex' || t.broker === 'nkis');
  }
  if (broker === 'octx') {
    return trades.filter(t => t.broker === 'octx' || t.broker === 'fxpro');
  }
  return trades.filter(t => t.broker === broker);
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface MonthlyPnl {
  month: string;
  pnl: number;
}

export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** True if a systemCompliance value represents full (100%) compliance.
 *  Accepts "100%", "Sí al 100%", "Si al 100%", "Sí completamente", or any string containing "100%". */
export function isFullCompliance(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  if (v === 'Sí completamente') return true;
  return v.includes('100%');
}

export function getTradeColorStrip(trade: Trade): string {
  if (trade.status === 'open') return 'bg-primary';
  const followedSystem = isFullCompliance(trade.systemCompliance) && trade.manualIntervention === 'None, EA managing';
  if (trade.isWin && followedSystem) return 'bg-success';
  if (trade.isWin && !followedSystem) return 'bg-primary';
  if (!trade.isWin && followedSystem) return 'bg-orange-500';
  return 'bg-destructive';
}

/** Build equity curve from sorted closed trades and a starting balance */
export function buildEquityCurve(trades: Trade[], startingBalance: number): EquityPoint[] {
  if (trades.length === 0) return [];
  const points: EquityPoint[] = [{ date: trades[0].entryDate.slice(0, 10), equity: startingBalance }];
  let running = startingBalance;
  for (const t of trades) {
    running += t.netPnl;
    const d = t.exitDate ? t.exitDate.slice(0, 10) : t.entryDate.slice(0, 10);
    points.push({ date: d, equity: Math.round(running * 100) / 100 });
  }
  return points;
}

/** Build monthly P&L from closed trades */
export function buildMonthlyPnl(trades: Trade[]): MonthlyPnl[] {
  const map: Record<string, number> = {};
  for (const t of trades) {
    const d = new Date(t.exitDate ?? t.entryDate);
    const key = `${d.toLocaleString('en-US', { month: 'short' })} ${String(d.getFullYear()).slice(2)}`;
    map[key] = (map[key] ?? 0) + t.netPnl;
  }
  return Object.entries(map).map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));
}

/** Compute stats from trade arrays */
export function computeStatsFromTrades(closedTrades: Trade[], openTrades: Trade[]) {
  const all = closedTrades;
  const totalPnl = all.reduce((s, t) => s + t.netPnl, 0) + openTrades.reduce((s, t) => s + t.netPnl, 0);
  const wins = all.filter(t => t.isWin);
  const losses = all.filter(t => !t.isWin);
  const winRate = all.length > 0 ? (wins.length / all.length) * 100 : 0;
  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  let currentStreak = 0;
  let streakType: 'W' | 'L' = 'W';
  for (let i = all.length - 1; i >= 0; i--) {
    if (i === all.length - 1) {
      streakType = all[i].isWin ? 'W' : 'L';
      currentStreak = 1;
    } else if ((streakType === 'W' && all[i].isWin) || (streakType === 'L' && !all[i].isWin)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    totalPnl,
    winRate,
    profitFactor,
    openCount: openTrades.length,
    currentStreak,
    streakType,
    totalTrades: all.length,
    wins: wins.length,
    losses: losses.length,
  };
}
