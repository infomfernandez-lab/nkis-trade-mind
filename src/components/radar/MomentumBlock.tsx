import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { BrokerFilter } from '@/lib/trade-utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MomentumRow {
  id: string;
  session_id: string | null;
  symbol: string;
  broker: string | null;
  score: number;
  direccion: string;
  evento: string | null;
  stoch_k: number | null;
  stoch_d: number | null;
  adx: number | null;
  atr: number | null;
  ma50: number | null;
  ma200: number | null;
  precio_actual: number | null;
  vix_value: number | null;
  total_analyzed: number | null;
  created_at: string;
}

type Evento =
  | 'MOMENTUM_A'
  | 'MOMENTUM_B'
  | 'SHORT_A'
  | 'SHORT_B'
  | 'EN_ZONA'
  | 'OBSERVAR'
  | 'SIN_SEÑAL'
  | 'SIN_SENAL';

function normalizeEvento(e: string | null): Evento | null {
  if (!e) return null;
  const v = e.trim().toUpperCase().replace(/\s+/g, '_').replace('Ñ', 'N');
  if (
    v === 'MOMENTUM_A' || v === 'MOMENTUM_B' ||
    v === 'SHORT_A' || v === 'SHORT_B' ||
    v === 'EN_ZONA' || v === 'OBSERVAR' ||
    v === 'SIN_SENAL'
  ) return v as Evento;
  return null;
}

function eventoMeta(e: Evento | null): { label: string; cls: string } | null {
  switch (e) {
    case 'MOMENTUM_A':
      return { label: '▲ MOMENTO A', cls: 'bg-green-800 text-white border-green-700' };
    case 'MOMENTUM_B':
      return { label: '▲ MOMENTO B', cls: 'bg-green-600 text-white border-green-500' };
    case 'SHORT_A':
      return { label: '▼ CORTO A', cls: 'bg-red-800 text-white border-red-700' };
    case 'SHORT_B':
      return { label: '▼ CORTO B', cls: 'bg-red-600 text-white border-red-500' };
    case 'EN_ZONA':
      return { label: '◉ EN ZONA', cls: 'bg-amber-400 text-black border-amber-300' };
    case 'OBSERVAR':
      return { label: '○ OBSERVAR', cls: 'bg-slate-600 text-white border-slate-500' };
    default:
      return null;
  }
}

function brokerKey(b: string | null): 'darwinex' | 'octx' {
  const v = (b ?? '').toLowerCase();
  return v.includes('octx') || v.includes('octx') ? 'octx' : 'darwinex';
}

function dirIcon(d: string) {
  const v = (d ?? '').toLowerCase();
  if (v === 'long' || v === 'alcista' || v === 'buy') {
    return <ArrowUp className="w-3.5 h-3.5 text-success" />;
  }
  if (v === 'short' || v === 'bajista' || v === 'sell') {
    return <ArrowDown className="w-3.5 h-3.5 text-destructive" />;
  }
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function isLongDir(d: string): boolean {
  const v = (d ?? '').toLowerCase();
  return v === 'long' || v === 'alcista' || v === 'buy';
}
function isShortDir(d: string): boolean {
  const v = (d ?? '').toLowerCase();
  return v === 'short' || v === 'bajista' || v === 'sell';
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-success';
  if (score >= 60) return 'bg-amber-400';
  return 'bg-muted-foreground/40';
}

function formatAtr(atr: number | null): string {
  if (atr == null) return '—';
  if (Math.abs(atr) >= 100) return atr.toFixed(2);
  if (Math.abs(atr) >= 1) return atr.toFixed(3);
  return atr.toFixed(5);
}

function useLatestMomentumSession() {
  return useQuery({
    queryKey: ['momentum-sessions', 'latest'],
    queryFn: async () => {
      // Get most recent created_at, then load all rows of that session_id
      const { data: latest, error: e1 } = await supabase
        .from('momentum_sessions')
        .select('session_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!latest) return { rows: [] as MomentumRow[], sessionAt: null as string | null };

      let query = supabase
        .from('momentum_sessions')
        .select('*')
        .order('score', { ascending: false });

      if (latest.session_id) {
        query = query.eq('session_id', latest.session_id);
      } else if (latest.created_at) {
        query = query.eq('created_at', latest.created_at);
      }

      const { data, error } = await query;
      if (error) throw error;
      return {
        rows: (data ?? []) as MomentumRow[],
        sessionAt: latest.created_at as string,
      };
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

interface Props {
  brokerFilter: BrokerFilter;
}

export function MomentumBlock({ brokerFilter }: Props) {
  const { data, isLoading } = useLatestMomentumSession();
  const [showAll, setShowAll] = useState(false);

  const rows = data?.rows ?? [];

  const filtered = useMemo(() => {
    return rows
      .filter(r => {
        const bk = brokerKey(r.broker);
        if (brokerFilter !== 'all' && brokerFilter !== bk) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [rows, brokerFilter]);

  const visible = useMemo(
    () => (showAll ? filtered : filtered.filter(r => r.score >= 60)),
    [filtered, showAll],
  );

  const longCount = filtered.filter(r => r.score >= 60 && isLongDir(r.direccion)).length;
  const shortCount = filtered.filter(r => r.score >= 60 && isShortDir(r.direccion)).length;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Activity className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Sin sesión ejecutada hoy</p>
      </div>
    );
  }

  const sessionTime = data?.sessionAt
    ? new Date(data.sessionAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '—';

  // VIX & total analyzed: take from first row of session (they're session-level fields stored per row)
  const sample = rows[0];
  const totalAnalyzed = sample?.total_analyzed ?? rows.length;
  const vix = sample?.vix_value ?? null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Sub-header within the block: counts + toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-foreground border border-border">
            {filtered.filter(r => r.score >= 60).length} con score ≥ 60
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/40">
            LONG: {longCount}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/40">
            SHORT: {shortCount}
          </span>
        </div>
        <button
          onClick={() => setShowAll(s => !s)}
          className="text-[11px] font-medium px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
        >
          {showAll ? 'Solo score ≥ 60' : 'Ver todos'}
        </button>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Sin instrumentos que cumplan el filtro
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map(r => {
            const ev = normalizeEvento(r.evento);
            const meta = eventoMeta(ev);
            const dim = r.score < 60;
            const bk = brokerKey(r.broker);
            return (
              <li key={r.id} className={`px-3 py-2.5 ${dim ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground tracking-wide">
                    {r.symbol.toUpperCase()}
                  </span>
                  {meta && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${meta.cls}`}>
                      {meta.label}
                    </span>
                  )}
                  {dirIcon(r.direccion)}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                    bk === 'darwinex'
                      ? 'bg-blue-950 text-blue-300 border-blue-800'
                      : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
                  }`}>
                    {bk === 'darwinex' ? 'DWX' : 'OCTX'}
                  </span>

                  {/* Score bar pushed to right on desktop */}
                  <div className="ml-auto flex items-center gap-2 min-w-[140px]">
                    <div className="relative h-1.5 w-24 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 ${scoreBarColor(r.score)} transition-all`}
                        style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }}
                      />
                    </div>
                    <span className={`font-data font-bold text-xs tabular-nums w-7 text-right ${
                      r.score >= 80 ? 'text-success' : r.score >= 60 ? 'text-amber-400' : 'text-muted-foreground'
                    }`}>
                      {Math.round(r.score)}
                    </span>
                  </div>
                </div>

                {/* Tech line */}
                <div className="mt-1 text-[10.5px] text-muted-foreground font-data">
                  Stoch K: {r.stoch_k != null ? r.stoch_k.toFixed(1) : '—'}
                  <span className="mx-1.5 text-border">|</span>
                  ADX: {r.adx != null ? r.adx.toFixed(1) : '—'}
                  <span className="mx-1.5 text-border">|</span>
                  ATR: {formatAtr(r.atr)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-secondary/20 text-[10.5px] text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
        <span>
          Sesión: <span className="font-data text-foreground">{sessionTime}</span>
          <span className="mx-1.5 text-border">·</span>
          Analizados: <span className="font-data text-foreground">{totalAnalyzed}</span>
          <span className="mx-1.5 text-border">·</span>
          VIX: <span className="font-data text-foreground">{vix != null ? Number(vix).toFixed(2) : '—'}</span>
        </span>
        <span className="text-muted-foreground/70">
          Actualizado en tiempo real
        </span>
      </div>
    </div>
  );
}

export function useMomentumCount(brokerFilter: BrokerFilter): { total: number; long: number; short: number } {
  const { data } = useLatestMomentumSession();
  return useMemo(() => {
    const rows = (data?.rows ?? []).filter(r => {
      const bk = brokerKey(r.broker);
      if (brokerFilter !== 'all' && brokerFilter !== bk) return false;
      return r.score >= 60;
    });
    return {
      total: rows.length,
      long: rows.filter(r => isLongDir(r.direccion)).length,
      short: rows.filter(r => isShortDir(r.direccion)).length,
    };
  }, [data, brokerFilter]);
}
