import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useLatestScannerByKey } from '@/hooks/use-scanner-instruments';
import type { BrokerFilter } from '@/lib/trade-utils';

interface Props {
  brokerFilter: BrokerFilter;
}

interface NearItem {
  id: string;
  symbol: string;
  broker: 'darwinex' | 'fxpro';
  direction: 'alcista' | 'bajista';
  stoch: number | null;
  pullback: boolean;
  pullbackBars: number | null;
  atr: number | null;
}

function isAlcistaDir(d: string): boolean {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

function buildNearItems(
  brokerFilter: BrokerFilter,
  scannerMap: Map<string, ReturnType<typeof useLatestScannerByKey> extends Map<string, infer V> ? V : never>,
  watchlist: Array<{ id: string; symbol: string; broker: string; direction: string }>,
): NearItem[] {
  const out = new Map<string, NearItem>();

  // 1) Scanner-driven: ZONA_ENTRADA OR pullback_active
  for (const [key, inst] of scannerMap.entries()) {
    if (brokerFilter !== 'all' && brokerFilter !== inst.broker) continue;
    const matches = inst.pullback_active || inst.stoch_estado === 'ZONA_ENTRADA';
    if (!matches) continue;
    out.set(key, {
      id: key,
      symbol: inst.symbol,
      broker: inst.broker,
      direction: isAlcistaDir(inst.direction) ? 'alcista' : 'bajista',
      stoch: inst.stoch_k,
      pullback: inst.pullback_active,
      pullbackBars: inst.pullback_bars,
      atr: inst.atr,
    });
  }

  // 2) Watchlist-driven (fallback for items without scanner match — kept for compatibility)
  for (const w of watchlist) {
    const broker = (w.broker ?? 'darwinex').toLowerCase() === 'fxpro' ? 'fxpro' : 'darwinex';
    if (brokerFilter !== 'all' && brokerFilter !== broker) continue;
    const key = `${w.symbol}::${broker}`;
    if (out.has(key)) continue;
    const scan = scannerMap.get(key);
    if (!scan) continue;
    const matches = scan.pullback_active || scan.stoch_estado === 'ZONA_ENTRADA';
    if (!matches) continue;
    out.set(key, {
      id: w.id,
      symbol: w.symbol,
      broker,
      direction: isAlcistaDir(scan.direction) ? 'alcista' : 'bajista',
      stoch: scan.stoch_k,
      pullback: scan.pullback_active,
      pullbackBars: scan.pullback_bars,
      atr: scan.atr,
    });
  }

  return Array.from(out.values()).sort((a, b) => {
    if (a.pullback !== b.pullback) return a.pullback ? -1 : 1;
    return 0;
  });
}

export function ProximoEntradaBlock({ brokerFilter }: Props) {
  const { data: items } = useWatchlist();
  const scannerMap = useLatestScannerByKey();

  const near: NearItem[] = useMemo(
    () => buildNearItems(brokerFilter, scannerMap, items ?? []),
    [brokerFilter, scannerMap, items],
  );

  if (near.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <Zap className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-sm text-muted-foreground">Sin señales próximas hoy — continúa vigilando</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/[0.03] overflow-hidden">
      {/* Desktop */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="bg-destructive/10 text-[10px] uppercase tracking-wider text-destructive/90">
            <th className="text-left px-3 py-2">Símbolo</th>
            <th className="text-left px-2 py-2 w-[90px]">Cuenta</th>
            <th className="text-left px-2 py-2 w-[200px]">Señal</th>
            <th className="text-left px-2 py-2">Qué hacer</th>
          </tr>
        </thead>
        <tbody>
          {near.map(item => <NearRow key={item.id} item={item} />)}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {near.map(item => <NearMobileCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function signalText(item: NearItem): string {
  const dir = item.direction === 'alcista' ? 'BUY' : 'SELL';
  if (item.pullback) return `${dir} — PULLBACK${item.pullbackBars ? ` ${item.pullbackBars}v` : ''}`;
  if (item.stoch != null) return `${dir} — Stoch ~${Math.round(item.stoch)}`;
  return dir;
}

function formatAtr(atr: number | null): string {
  if (atr == null) return '';
  // 4 decimals for FX-like values, fewer for larger numbers
  if (Math.abs(atr) >= 100) return atr.toFixed(2);
  if (Math.abs(atr) >= 1) return atr.toFixed(3);
  return atr.toFixed(4);
}

function whatToDo(item: NearItem): string {
  const sign = item.direction === 'alcista' ? '−' : '+';
  const cross = item.direction === 'alcista' ? 'AL ALZA nivel 30 → BUY' : 'A LA BAJA nivel 70 → SELL';
  const atrPart = item.atr != null
    ? `SL = entrada ${sign} ${formatAtr(item.atr)} (ATR × 1.5).`
    : `SL = entrada ${sign} (ATR × 1.5).`;
  return `Stoch(5,2,2) cruce ${cross}. ${atrPart} Anotar en bitácora.`;
}

function NearRow({ item }: { item: NearItem }) {
  return (
    <tr className={`border-t border-border ${item.pullback ? 'bg-yellow-500/[0.05] border-l-[3px] border-l-yellow-400' : ''}`}>
      <td className="px-3 py-2 font-bold text-foreground text-sm">{item.symbol}</td>
      <td className="px-2 py-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          item.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
        }`}>{item.broker === 'darwinex' ? 'Darwinex' : 'FXPro'}</span>
      </td>
      <td className="px-2 py-2 text-xs">
        <span className={`font-bold ${item.direction === 'alcista' ? 'text-success' : 'text-destructive'}`}>
          {signalText(item)}
        </span>
      </td>
      <td className="px-2 py-2 text-[11px] text-muted-foreground leading-snug">{whatToDo(item)}</td>
    </tr>
  );
}

function NearMobileCard({ item }: { item: NearItem }) {
  return (
    <div className={`p-3 ${item.pullback ? 'bg-yellow-500/[0.05] border-l-[3px] border-l-yellow-400' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm text-foreground">{item.symbol}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          item.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
        }`}>{item.broker === 'darwinex' ? 'Darwinex' : 'FXPro'}</span>
        <span className={`text-xs font-bold ${item.direction === 'alcista' ? 'text-success' : 'text-destructive'}`}>
          {signalText(item)}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{whatToDo(item)}</div>
    </div>
  );
}

export function useProximoEntradaCount(brokerFilter: BrokerFilter): number {
  const { data: items } = useWatchlist();
  const scannerMap = useLatestScannerByKey();
  return useMemo(
    () => buildNearItems(brokerFilter, scannerMap, items ?? []).length,
    [brokerFilter, scannerMap, items],
  );
}
