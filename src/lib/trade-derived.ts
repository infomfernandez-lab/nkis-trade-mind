import type { Trade, TradeRow } from './trade-utils';

export type CloseType = 'TP' | 'SL' | 'MANUAL' | 'OPEN';

export interface CloseTypeInfo {
  type: CloseType;
  label: string;
  /** Tailwind text color */
  color: string;
  /** Tailwind bg color (subtle) */
  bg: string;
  /** Glyph */
  icon: string;
}

const TOLERANCE = 0.005; // 0.5%

/** Detect TP / SL / MANUAL / OPEN based on exit price vs sl/tp. */
export function detectCloseType(trade: Trade): CloseTypeInfo {
  if (trade.status === 'open') {
    return { type: 'OPEN', label: 'ABIERTA', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: '●' };
  }
  const exit = trade.exitPrice;
  if (exit == null) {
    return { type: 'MANUAL', label: 'MANUAL', color: 'text-primary', bg: 'bg-primary/10', icon: '◆' };
  }
  const close = (target: number) => target > 0 && Math.abs(exit - target) / target <= TOLERANCE;
  if (close(trade.tpPrice)) {
    return { type: 'TP', label: 'TP ✓', color: 'text-success', bg: 'bg-success/10', icon: '✓' };
  }
  if (close(trade.slPrice)) {
    return { type: 'SL', label: 'SL ✗', color: 'text-destructive', bg: 'bg-destructive/10', icon: '✗' };
  }
  return { type: 'MANUAL', label: 'MANUAL', color: 'text-primary', bg: 'bg-primary/10', icon: '◆' };
}

/** RR real = (exit - entry) / (entry - sl) respecting direction. Returns null if not computable. */
export function computeRR(trade: Trade): number | null {
  if (trade.exitPrice == null || trade.slPrice == null || trade.slPrice === 0) return null;
  const risk = Math.abs(trade.entryPrice - trade.slPrice);
  if (risk === 0) return null;
  const reward = trade.direction === 'BUY'
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice;
  return Math.round((reward / risk) * 100) / 100;
}

/** True if the journal has any meaningful entry filled in. */
export function hasJournal(trade: Trade): boolean {
  const fields = [
    trade.emotionalState,
    trade.reasonForEntry,
    trade.systemCompliance,
    trade.setupDoubts,
    trade.preTradeNotes,
    trade.managingWait,
    trade.manualIntervention,
    trade.duringTradeNotes,
    trade.feelingResult,
    trade.whatDoDifferently,
    trade.postTradeNotes,
  ];
  return fields.some(v => v != null && String(v).trim() !== '');
}

export interface ScannerLookup {
  rank: number | null;
  total: number | null;
  score: number | null;
}

interface ScannerSessionLite {
  session_date: string;
  broker: string;
  top_instruments: any;
}

/**
 * Find the scanner session that is closest BEFORE the trade entry, same broker,
 * and look up the trade's symbol inside top_instruments.
 */
export function lookupScannerRank(
  trade: Trade,
  sessions: ScannerSessionLite[] | null | undefined,
): ScannerLookup {
  if (!sessions || sessions.length === 0) return { rank: null, total: null, score: null };
  const entryTs = new Date(trade.entryDate).getTime();
  const candidates = sessions.filter(
    s => s.broker === trade.broker && new Date(s.session_date).getTime() <= entryTs,
  );
  if (candidates.length === 0) return { rank: null, total: null, score: null };
  candidates.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  const session = candidates[0];
  const list = Array.isArray(session.top_instruments) ? session.top_instruments : [];
  const total = list.length;
  const idx = list.findIndex((it: any) => it && it.symbol === trade.symbol);
  if (idx < 0) return { rank: null, total, score: null };
  const score = list[idx]?.score != null ? Number(list[idx].score) : null;
  return { rank: idx + 1, total, score };
}
