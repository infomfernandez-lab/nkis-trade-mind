import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star, TrendingUp, TrendingDown, Eye, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useAddToWatchlist, useWatchlist } from '@/hooks/use-watchlist';
import { useAuth } from '@/hooks/use-auth';
import { useAllTrades } from '@/hooks/use-trades';
import type { BrokerFilter } from '@/lib/trade-utils';
import { toast } from 'sonner';

interface Raw {
  rank?: number;
  symbol: string;
  direction: string;
  score: number;
  adx?: number;
  adx_value?: number;
  adx_state?: string;
  dist_ma50?: number;
  distance_to_ma50?: number;
  pullback_active?: boolean;
  pullback_bars?: number;
  pullback_velas?: number;
  stoch_k?: number;
  stoch_estado?: string;
  atr?: number;
  atr_value?: number;
  structure?: string;
  breakout?: string;
  volume?: number;
}

export type StochEstado = 'ZONA_ENTRADA' | 'ZONA_MEDIA' | 'SOBRECOMPRADO' | null;

export interface UnifiedInstrument {
  symbol: string;
  direction: string;
  score: number;
  adx_value: number | null;
  adx_state: string | null;
  distance_to_ma50: number | null;
  pullback_active: boolean;
  pullback_bars: number | null;
  stoch_k: number | null;
  stoch_estado: StochEstado;
  atr: number | null;
  structure: string | null;
  breakout: string | null;
  volume: number | null;
  broker: 'darwinex' | 'fxpro';
}

interface SessionRow {
  id: string;
  broker: string | null;
  top_instruments: unknown;
  created_at: string;
}

function useUnifiedInstruments(brokerFilter: BrokerFilter): UnifiedInstrument[] {
  const { data } = useQuery({
    queryKey: ['scanner-sessions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('id, broker, top_instruments, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  return useMemo(() => {
    if (!data) return [];
    const latestByBroker = new Map<'darwinex' | 'fxpro', SessionRow>();
    for (const row of data) {
      const v = (row.broker ?? '').toLowerCase();
      const key: 'darwinex' | 'fxpro' = v.includes('fxpro') ? 'fxpro' : 'darwinex';
      if (!latestByBroker.has(key)) latestByBroker.set(key, row);
    }
    const out: UnifiedInstrument[] = [];
    for (const [broker, row] of latestByBroker.entries()) {
      if (brokerFilter !== 'all' && brokerFilter !== broker) continue;
      const arr = Array.isArray(row.top_instruments) ? (row.top_instruments as Raw[]) : [];
      for (const r of arr) {
        out.push({
          symbol: r.symbol,
          direction: r.direction,
          score: Number(r.score ?? 0),
          adx_value: r.adx ?? r.adx_value ?? null,
          adx_state: r.adx_state ?? null,
          distance_to_ma50: r.dist_ma50 ?? r.distance_to_ma50 ?? null,
          pullback_active: !!r.pullback_active,
          pullback_bars: r.pullback_velas ?? r.pullback_bars ?? null,
          stoch_k: r.stoch_k ?? null,
          stoch_estado: normalizeStochEstado(r.stoch_estado, r.stoch_k, r.direction),
          atr: r.atr_value ?? r.atr ?? null,
          structure: r.structure ?? null,
          breakout: r.breakout ?? null,
          volume: r.volume ?? null,
          broker,
        });
      }
    }
    return out.sort((a, b) => {
      if (a.pullback_active !== b.pullback_active) return a.pullback_active ? -1 : 1;
      return b.score - a.score;
    });
  }, [data, brokerFilter]);
}

interface Props { brokerFilter: BrokerFilter }

export function EnTendenciaBlock({ brokerFilter }: Props) {
  const items = useUnifiedInstruments(brokerFilter);
  const { data: watchlist } = useWatchlist();
  const { openTrades } = useAllTrades();
  const watchedSymbols = new Set((watchlist ?? []).map(w => `${w.symbol}::${(w.broker ?? 'darwinex')}`));
  const openSymbols = new Set(openTrades.map(t => t.symbol));

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Sin instrumentos en tendencia. Ejecuta el scanner.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Desktop table */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-3 py-2">Símbolo</th>
            <th className="text-left px-2 py-2 w-[90px]">Cuenta</th>
            <th className="text-left px-2 py-2 w-[70px]">Dir</th>
            <th className="text-right px-2 py-2 w-[80px]">Score</th>
            <th className="text-left px-2 py-2 w-[120px]">ADX</th>
            <th className="text-left px-2 py-2 w-[120px]">Dist MA50</th>
            <th className="text-left px-2 py-2">Notas</th>
            <th className="px-2 py-2 w-[120px]"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((inst, i) => (
            <DesktopRow
              key={`${inst.symbol}-${inst.broker}-${i}`}
              inst={inst}
              isWatched={watchedSymbols.has(`${inst.symbol}::${inst.broker}`)}
              isOpen={openSymbols.has(inst.symbol)}
            />
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {items.map((inst, i) => (
          <MobileCard
            key={`${inst.symbol}-${inst.broker}-${i}`}
            inst={inst}
            isWatched={watchedSymbols.has(`${inst.symbol}::${inst.broker}`)}
            isOpen={openSymbols.has(inst.symbol)}
          />
        ))}
      </div>
    </div>
  );
}

function adxColor(state: string | null): string {
  const s = (state ?? '').toUpperCase();
  if (s === 'ACELERANDO') return 'text-success';
  if (s === 'SUBIENDO') return 'text-yellow-400';
  return 'text-muted-foreground';
}

function distColor(d: number | null): string {
  if (d == null) return 'text-muted-foreground';
  if (d < 5) return 'text-success';
  if (d < 10) return 'text-blue-400';
  if (d < 20) return 'text-orange-400';
  return 'text-destructive';
}

function distLabel(d: number | null): string {
  if (d == null) return '—';
  if (d < 5) return 'MUY CERCA';
  if (d < 10) return 'CERCA';
  if (d < 20) return 'ALEJADO';
  return 'SOBREEXT';
}

function scoreIcon(score: number): string {
  if (score >= 75) return '★';
  if (score >= 60) return '●';
  return '◌';
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-yellow-400';
  if (score >= 60) return 'text-success';
  return 'text-muted-foreground';
}

function isAlcistaDir(d: string) {
  const v = d.toLowerCase();
  return v === 'alcista' || v === 'buy';
}

function useWatchAction(inst: UnifiedInstrument) {
  const add = useAddToWatchlist();
  const { user } = useAuth();
  return () => {
    if (!user) return;
    add.mutate({
      symbol: inst.symbol,
      direction: isAlcistaDir(inst.direction) ? 'alcista' : 'bajista',
      watch_reason: inst.pullback_active
        ? `Pullback activo — Score ${inst.score}/100`
        : `Desde Radar — Score ${inst.score}/100`,
      stochastic_level: inst.stoch_k ?? null,
      scanner_score: inst.score,
      adx_value: inst.adx_value,
      adx_state: inst.adx_state,
      distance_to_ma50: inst.distance_to_ma50,
      status: 'Vigilando',
      added_from_scanner: true,
      trade_id: null,
      broker: inst.broker,
    }, {
      onSuccess: () => toast.success(`${inst.symbol} añadido a Vigilando`),
      onError: () => toast.error('Error al añadir'),
    });
  };
}

function DesktopRow({ inst, isWatched, isOpen }: { inst: UnifiedInstrument; isWatched: boolean; isOpen: boolean }) {
  const onWatch = useWatchAction(inst);
  const alcista = isAlcistaDir(inst.direction);
  const notes = [inst.structure, inst.breakout, inst.volume != null ? `Vol ${inst.volume}` : null].filter(Boolean).join(' · ');

  return (
    <tr className={`border-t border-border text-sm ${inst.pullback_active ? 'bg-yellow-500/[0.05] border-l-[3px] border-l-yellow-400' : ''}`}>
      <td className="px-3 py-2 font-bold text-foreground">
        <div className="flex items-center gap-1.5">
          {inst.pullback_active && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
          {inst.symbol}
        </div>
      </td>
      <td className="px-2 py-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          inst.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
        }`}>{inst.broker === 'darwinex' ? 'Darwinex' : 'FXPro'}</span>
      </td>
      <td className="px-2 py-2">
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {alcista ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className={`px-2 py-2 text-right font-data font-bold ${scoreColor(inst.score)}`}>
        {scoreIcon(inst.score)} {inst.score}
      </td>
      <td className="px-2 py-2">
        {inst.adx_value != null ? (
          <div className="leading-tight">
            <div className="font-data text-xs text-foreground">{inst.adx_value}</div>
            {inst.adx_state && <div className={`text-[10px] font-semibold ${adxColor(inst.adx_state)}`}>{inst.adx_state.slice(0, 4).toUpperCase()}</div>}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-2 py-2">
        <div className="leading-tight">
          <div className={`font-data text-xs ${distColor(inst.distance_to_ma50)}`}>
            {inst.distance_to_ma50 != null ? `${inst.distance_to_ma50}%` : '—'}
          </div>
          <div className={`text-[9px] font-semibold ${distColor(inst.distance_to_ma50)}`}>{distLabel(inst.distance_to_ma50)}</div>
        </div>
      </td>
      <td className="px-2 py-2 text-[11px] text-muted-foreground">
        {inst.pullback_active && (
          <span className="mr-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
            ⭐ PULLBACK{inst.pullback_bars ? ` ${inst.pullback_bars}v` : ''}
          </span>
        )}
        {notes || '—'}
      </td>
      <td className="px-2 py-2 text-right">
        {isOpen ? (
          <span className="text-[10px] text-yellow-400 font-bold">EN POS</span>
        ) : isWatched ? (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-success"><Check className="w-3 h-3" />Vigilando</span>
        ) : (
          <button onClick={onWatch} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 transition-colors">
            <Eye className="w-3 h-3" /> Vigilar
          </button>
        )}
      </td>
    </tr>
  );
}

function MobileCard({ inst, isWatched, isOpen }: { inst: UnifiedInstrument; isWatched: boolean; isOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const onWatch = useWatchAction(inst);
  const alcista = isAlcistaDir(inst.direction);
  const notes = [inst.structure, inst.breakout, inst.volume != null ? `Vol ${inst.volume}` : null].filter(Boolean).join(' · ');

  return (
    <div className={`p-3 ${inst.pullback_active ? 'bg-yellow-500/[0.05] border-l-[3px] border-l-yellow-400' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2">
        {inst.pullback_active && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />}
        <span className="font-bold text-sm text-foreground">{inst.symbol}</span>
        <span className={`font-data font-bold text-sm ${scoreColor(inst.score)}`}>{scoreIcon(inst.score)} {inst.score}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {alcista ? 'BUY' : 'SELL'}
        </span>
        {inst.pullback_active && (
          <span className="text-[9px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-1 py-0.5 rounded">⭐ PB</span>
        )}
        {open ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              inst.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
            }`}>{inst.broker === 'darwinex' ? 'Darwinex' : 'FXPro'}</span>
            {inst.adx_value != null && (
              <span>ADX <span className="font-data text-foreground">{inst.adx_value}</span> <span className={`font-semibold ${adxColor(inst.adx_state)}`}>{(inst.adx_state ?? '').toUpperCase()}</span></span>
            )}
            <span className={`font-data ${distColor(inst.distance_to_ma50)}`}>MA50 {inst.distance_to_ma50 != null ? `${inst.distance_to_ma50}%` : '—'}</span>
          </div>
          {notes && <div>{notes}</div>}
          <div className="pt-1.5">
            {isOpen ? (
              <span className="text-[10px] text-yellow-400 font-bold">EN POSICIÓN</span>
            ) : isWatched ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-success"><Check className="w-3 h-3" />En Vigilando</span>
            ) : (
              <button onClick={onWatch} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                <Eye className="w-3 h-3" /> Añadir a Vigilando
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function useEnTendenciaCount(brokerFilter: BrokerFilter) {
  const items = useUnifiedInstruments(brokerFilter);
  return items.length;
}
