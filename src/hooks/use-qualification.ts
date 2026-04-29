import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export type QualificationStage = 'escaneado' | 'calificado' | 'senal_activa' | 'en_cartera';

export interface QualificationRow {
  id: string;
  user_id: string;
  symbol: string;
  broker: string;
  direction: string;
  checklist_date: string;
  c1_elite: boolean;
  c2_direction: boolean;
  c3_signal_candle: boolean;
  c4_prev_candle: boolean;
  c5_adx: boolean;
  c6_sizing: boolean;
  c7_sl_mt5: boolean;
  c1_at: string | null;
  c2_at: string | null;
  c3_at: string | null;
  c4_at: string | null;
  c5_at: string | null;
  c6_at: string | null;
  c7_at: string | null;
  score: number;
  stage: QualificationStage;
}

export const CRITERIA_POINTS = [2, 3, 4, 3, 4, 2, 2] as const;

export function computeScore(c: Pick<QualificationRow, 'c1_elite' | 'c2_direction' | 'c3_signal_candle' | 'c4_prev_candle' | 'c5_adx' | 'c6_sizing' | 'c7_sl_mt5'>): number {
  return (
    (c.c1_elite ? CRITERIA_POINTS[0] : 0) +
    (c.c2_direction ? CRITERIA_POINTS[1] : 0) +
    (c.c3_signal_candle ? CRITERIA_POINTS[2] : 0) +
    (c.c4_prev_candle ? CRITERIA_POINTS[3] : 0) +
    (c.c5_adx ? CRITERIA_POINTS[4] : 0) +
    (c.c6_sizing ? CRITERIA_POINTS[5] : 0) +
    (c.c7_sl_mt5 ? CRITERIA_POINTS[6] : 0)
  );
}

export function stageFromScore(score: number): QualificationStage {
  if (score >= 18) return 'en_cartera';
  if (score >= 13) return 'senal_activa';
  if (score >= 8) return 'calificado';
  return 'escaneado';
}

export interface StageStyle {
  tone: 'gray' | 'yellow' | 'orange' | 'green';
  /** Soft background + dark text for headers and badges */
  badge: string;
  /** Background tint for the section header */
  header: string;
  /** Border color for outlined panels */
  border: string;
  /** Section accent (left border / divider) */
  accent: string;
}

export const STAGE_META: Record<QualificationStage, { label: string; emoji: string } & StageStyle> = {
  escaneado: {
    label: 'Escaneado', emoji: '📡', tone: 'gray',
    badge: 'bg-muted/40 text-muted-foreground border-border',
    header: 'bg-muted/40 text-muted-foreground border-border',
    border: 'border-border',
    accent: 'border-l-muted-foreground/40',
  },
  calificado: {
    label: 'Calificado', emoji: '🔍', tone: 'yellow',
    badge: 'bg-primary/15 text-primary border-primary/40',
    header: 'bg-primary/15 text-primary border-primary/40',
    border: 'border-primary/40',
    accent: 'border-l-primary',
  },
  senal_activa: {
    label: 'Señal activa', emoji: '⚡', tone: 'orange',
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    header: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
    border: 'border-orange-500/40',
    accent: 'border-l-orange-400',
  },
  en_cartera: {
    label: 'En cartera', emoji: '📈', tone: 'green',
    badge: 'bg-success/15 text-success border-success/40',
    header: 'bg-success/15 text-success border-success/40',
    border: 'border-success/40',
    accent: 'border-l-success',
  },
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fetch all today's qualification rows for the current user. */
export function useTodayQualifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['qualifications', 'today', user?.id ?? null],
    queryFn: async (): Promise<QualificationRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('qualification_checklist')
        .select('*')
        .eq('user_id', user.id)
        .eq('checklist_date', todayISO());
      if (error) throw error;
      return (data ?? []) as QualificationRow[];
    },
    enabled: !!user,
    staleTime: 5_000,
  });
}

/** Map of `${symbol}::${broker}` → today's row. */
export function useQualificationMap(): Map<string, QualificationRow> {
  const { data } = useTodayQualifications();
  const map = new Map<string, QualificationRow>();
  for (const r of data ?? []) map.set(`${r.symbol}::${r.broker}`, r);
  return map;
}

/** Detect calculator usage today for a given instrument (criterion 6). */
export function useCalculatorUsedToday(symbol: string): boolean {
  const { data } = useQuery({
    queryKey: ['calc-used-today', symbol],
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from('calculadora_registro')
        .select('id', { count: 'exact', head: true })
        .eq('instrumento', symbol)
        .gte('created_at', start.toISOString());
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: 30_000,
  });
  return !!data;
}

interface UpsertArgs {
  symbol: string;
  broker: string;
  direction: string;
  patch: Partial<Omit<QualificationRow, 'id' | 'user_id' | 'symbol' | 'broker' | 'direction' | 'checklist_date'>>;
  existing?: QualificationRow;
}

export function useUpsertQualification() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ symbol, broker, direction, patch, existing }: UpsertArgs) => {
      if (!user) throw new Error('No user');
      const date = todayISO();
      const merged = {
        c1_elite: existing?.c1_elite ?? false,
        c2_direction: existing?.c2_direction ?? false,
        c3_signal_candle: existing?.c3_signal_candle ?? false,
        c4_prev_candle: existing?.c4_prev_candle ?? false,
        c5_adx: existing?.c5_adx ?? false,
        c6_sizing: existing?.c6_sizing ?? false,
        c7_sl_mt5: existing?.c7_sl_mt5 ?? false,
        ...patch,
      };
      const score = computeScore(merged);
      const stage = stageFromScore(score);
      const now = new Date().toISOString();
      const tsPatch: Record<string, string | null> = {};
      const keys = ['c1_elite','c2_direction','c3_signal_candle','c4_prev_candle','c5_adx','c6_sizing','c7_sl_mt5'] as const;
      const tsKeys = ['c1_at','c2_at','c3_at','c4_at','c5_at','c6_at','c7_at'] as const;
      keys.forEach((k, i) => {
        const prev = existing?.[k] ?? false;
        const next = merged[k];
        if (prev !== next) tsPatch[tsKeys[i]] = next ? now : null;
      });

      const row = {
        user_id: user.id,
        symbol,
        broker,
        direction,
        checklist_date: date,
        ...merged,
        ...tsPatch,
        score,
        stage,
      };

      const { data, error } = await supabase
        .from('qualification_checklist')
        .upsert(row, { onConflict: 'user_id,symbol,broker,checklist_date' })
        .select()
        .single();
      if (error) throw error;
      return data as QualificationRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qualifications'] });
    },
  });
}
