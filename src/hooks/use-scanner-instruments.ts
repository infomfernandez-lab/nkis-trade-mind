import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UnifiedInstrument, StochEstado } from '@/components/radar/EnTendenciaBlock';
import { normalizeStochEstado } from '@/components/radar/EnTendenciaBlock';

interface SessionRow {
  id: string;
  broker: string | null;
  top_instruments: unknown;
  created_at: string;
}

interface Raw {
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

/**
 * Map of `${symbol}::${broker}` → enriched instrument data from latest scanner.
 */
export function useLatestScannerByKey(): Map<string, UnifiedInstrument> {
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
    const map = new Map<string, UnifiedInstrument>();
    if (!data) return map;
    const latestByBroker = new Map<'darwinex' | 'fxpro', SessionRow>();
    for (const row of data) {
      const v = (row.broker ?? '').toLowerCase();
      const key: 'darwinex' | 'fxpro' = v.includes('fxpro') ? 'fxpro' : 'darwinex';
      if (!latestByBroker.has(key)) latestByBroker.set(key, row);
    }
    for (const [broker, row] of latestByBroker.entries()) {
      const arr = Array.isArray(row.top_instruments) ? (row.top_instruments as Raw[]) : [];
      for (const r of arr) {
        const inst: UnifiedInstrument = {
          symbol: r.symbol,
          direction: r.direction,
          score: Number(r.score ?? 0),
          adx_value: r.adx ?? r.adx_value ?? null,
          adx_state: r.adx_state ?? null,
          distance_to_ma50: r.dist_ma50 ?? r.distance_to_ma50 ?? null,
          pullback_active: !!r.pullback_active,
          pullback_bars: r.pullback_velas ?? r.pullback_bars ?? null,
          stoch_k: r.stoch_k ?? null,
          stoch_estado: normalizeStochEstado(r.stoch_estado, r.stoch_k, r.direction) as StochEstado,
          atr: r.atr_value ?? r.atr ?? null,
          structure: r.structure ?? null,
          breakout: r.breakout ?? null,
          volume: r.volume ?? null,
          broker,
        };
        map.set(`${inst.symbol}::${broker}`, inst);
      }
    }
    return map;
  }, [data]);
}
