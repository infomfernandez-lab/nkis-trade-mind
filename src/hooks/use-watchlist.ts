import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface WatchlistItem {
  id: string;
  symbol: string;
  direction: string;
  watch_reason: string | null;
  stochastic_level: number | null;
  scanner_score: number | null;
  adx_value: number | null;
  adx_state: string | null;
  distance_to_ma50: number | null;
  status: string;
  added_from_scanner: boolean;
  trade_id: string | null;
  broker: string;
  created_at: string;
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WatchlistItem[];
    },
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (item: Omit<WatchlistItem, 'id' | 'created_at'> & { user_id?: string }) => {
      const { error } = await supabase.from('watchlist').insert({
        user_id: user!.id,
        symbol: item.symbol,
        direction: item.direction,
        watch_reason: item.watch_reason,
        stochastic_level: item.stochastic_level,
        scanner_score: item.scanner_score,
        adx_value: item.adx_value,
        adx_state: item.adx_state,
        distance_to_ma50: item.distance_to_ma50,
        status: item.status || 'Vigilando',
        added_from_scanner: item.added_from_scanner || false,
        broker: item.broker || 'darwinex',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useUpdateWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WatchlistItem> & { id: string }) => {
      const { error } = await supabase.from('watchlist').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}

export function useDeleteWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('watchlist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
}
