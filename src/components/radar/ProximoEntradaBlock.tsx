import { useMemo } from 'react';
import { useWatchlist } from '@/hooks/use-watchlist';
import { Zap } from 'lucide-react';
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
}

export function ProximoEntradaBlock({ brokerFilter }: Props) {
  const { data: items } = useWatchlist();

  const near: NearItem[] = useMemo(() => {
    const list = (items ?? []).filter(i =>
      i.status === 'Vigilando' || i.status === '⚡ Señal próxima' || i.status === '⭐ En zona entrada'
    );
    const filtered = brokerFilter === 'all'
      ? list
      : list.filter(i => (i.broker ?? 'darwinex').toLowerCase() === brokerFilter);
    return filtered.flatMap(i => {
      const dir = (i.direction ?? '').toLowerCase();
      const alcista = dir === 'alcista' || dir === 'buy';
      const stoch = i.stochastic_level;
      const reason = (i.watch_reason ?? '').toLowerCase();
      const pullback = reason.includes('pullback');
      const matches = pullback
        || (alcista && stoch != null && stoch < 35)
        || (!alcista && stoch != null && stoch > 65);
      if (!matches) return [];
      const pbBars = pullback ? (reason.match(/(\d+)\s*v/)?.[1] ?? null) : null;
      return [{
        id: i.id,
        symbol: i.symbol,
        broker: ((i.broker ?? 'darwinex').toLowerCase() === 'fxpro' ? 'fxpro' : 'darwinex') as 'darwinex' | 'fxpro',
        direction: (alcista ? 'alcista' : 'bajista') as 'alcista' | 'bajista',
        stoch,
        pullback,
        pullbackBars: pbBars ? Number(pbBars) : null,
      }];
    }).sort((a, b) => {
      if (a.pullback !== b.pullback) return a.pullback ? -1 : 1;
      return 0;
    });
  }, [items, brokerFilter]);

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

function whatToDo(item: NearItem): string {
  if (item.direction === 'alcista') {
    return 'Stoch(5,2,2) cruce AL ALZA nivel 30 → BUY. SL = entrada − (ATR14 × 1.5). Anotar en bitácora.';
  }
  return 'Stoch(5,2,2) cruce A LA BAJA nivel 70 → SELL. SL = entrada + (ATR14 × 1.5). Anotar en bitácora.';
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
  return useMemo(() => {
    const list = (items ?? []).filter(i =>
      i.status === 'Vigilando' || i.status === '⚡ Señal próxima' || i.status === '⭐ En zona entrada'
    );
    const filtered = brokerFilter === 'all'
      ? list
      : list.filter(i => (i.broker ?? 'darwinex').toLowerCase() === brokerFilter);
    return filtered.filter(i => {
      const dir = (i.direction ?? '').toLowerCase();
      const alcista = dir === 'alcista' || dir === 'buy';
      const reason = (i.watch_reason ?? '').toLowerCase();
      const pullback = reason.includes('pullback');
      const stoch = i.stochastic_level;
      return pullback
        || (alcista && stoch != null && stoch < 35)
        || (!alcista && stoch != null && stoch > 65);
    }).length;
  }, [items, brokerFilter]);
}
