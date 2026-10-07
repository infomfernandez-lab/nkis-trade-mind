import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { rowToTrade, type Trade } from '@/lib/trade-utils';
import { useSettings } from '@/hooks/use-settings';
import { accountFromSettings, isCwndTradeRow } from '@/lib/account';

async function fetchTrades(isOpen: boolean): Promise<any[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('is_open', isOpen)
    .order('entry_date', { ascending: true })
    .limit(1000);

  if (error) throw error;
  return data ?? [];
}

/** Solo operaciones de la cuenta CWND desde la fecha de inicio (las antiguas quedan archivadas). */
function useCwndTrades(isOpen: boolean) {
  const { data: settings } = useSettings();
  const fechaInicio = accountFromSettings(settings).fechaInicio;
  return useQuery({
    queryKey: ['trades', isOpen ? 'open' : 'closed'],
    queryFn: () => fetchTrades(isOpen),
    select: (rows): Trade[] => rows.filter(r => isCwndTradeRow(r, fechaInicio)).map(rowToTrade),
  });
}

export function useClosedTrades() {
  return useCwndTrades(false);
}

export function useOpenTrades() {
  return useCwndTrades(true);
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
