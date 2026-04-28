import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the VIX from the most recent scanner session synced from MT5.
 * Updates in real-time via the realtime sync hook (invalidates 'scanner-sessions-latest-vix').
 */
export function useLatestVix() {
  return useQuery({
    queryKey: ['scanner-sessions-latest-vix'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('vix, created_at, broker')
        .not('vix', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

/**
 * CAP risk table based on VIX level.
 * Returns suggested risk % and a human-readable label/state.
 */
export function getCapRiskFromVix(vix: number | null | undefined): {
  riskPct: number | null;
  label: string;
  tone: 'success' | 'normal' | 'warn' | 'high' | 'block';
  blocked: boolean;
} {
  if (vix == null || !Number.isFinite(vix)) {
    return { riskPct: null, label: 'Sin datos del scanner', tone: 'normal', blocked: false };
  }
  if (vix < 15) return { riskPct: 1.5, label: 'Mercado tranquilo — 1.5% de riesgo', tone: 'success', blocked: false };
  if (vix < 20) return { riskPct: 1.0, label: 'Mercado normal — 1% de riesgo', tone: 'normal', blocked: false };
  if (vix < 25) return { riskPct: 0.75, label: 'Volatilidad elevada — 0.75% de riesgo', tone: 'warn', blocked: false };
  if (vix < 30) return { riskPct: 0.5, label: 'Mercado tenso — 0.5% de riesgo', tone: 'high', blocked: false };
  return { riskPct: 0, label: '⚠️ No operar o reducir al mínimo', tone: 'block', blocked: true };
}

export const CAP_VIX_LEGEND = [
  { range: 'VIX < 15', state: 'Mercado tranquilo', risk: '1.5% de riesgo', tone: 'success' as const },
  { range: 'VIX 15–20', state: 'Mercado normal', risk: '1% de riesgo', tone: 'normal' as const },
  { range: 'VIX 20–25', state: 'Volatilidad elevada', risk: '0.75% de riesgo', tone: 'warn' as const },
  { range: 'VIX 25–30', state: 'Mercado tenso', risk: '0.5% de riesgo', tone: 'high' as const },
  { range: 'VIX > 30', state: 'No operar', risk: 'Reducir al mínimo', tone: 'block' as const },
];
