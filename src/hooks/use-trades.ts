import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { rowToTrade, type Trade } from '@/lib/trade-utils';

async function fetchTrades(isOpen: boolean): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('is_open', isOpen)
    .order('entry_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToTrade);
}

export function useClosedTrades() {
  return useQuery({
    queryKey: ['trades', 'closed'],
    queryFn: () => fetchTrades(false),
  });
}

export function useOpenTrades() {
  return useQuery({
    queryKey: ['trades', 'open'],
    queryFn: () => fetchTrades(true),
  });
}

export function useAllTrades() {
  const closed = useClosedTrades();
  const open = useOpenTrades();
  return {
    closedTrades: closed.data ?? [],
    openTrades: open.data ?? [],
    isLoading: closed.isLoading || open.isLoading,
    error: closed.error || open.error,
  };
}
