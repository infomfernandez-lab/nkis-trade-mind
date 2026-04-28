import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on trades, watchlist and scanner_sessions
 * and invalidates the matching React Query caches so the UI updates without
 * needing a manual refetch when SYNC scripts push new data.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('cap-trading-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => {
        qc.invalidateQueries({ queryKey: ['trades'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist' }, () => {
        qc.invalidateQueries({ queryKey: ['watchlist'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scanner_sessions' }, () => {
        qc.invalidateQueries({ queryKey: ['scanner-sessions-all'] });
        qc.invalidateQueries({ queryKey: ['scanner-sessions'] });
        qc.invalidateQueries({ queryKey: ['scanner-sessions-meta'] });
        qc.invalidateQueries({ queryKey: ['scanner-session'] });
        qc.invalidateQueries({ queryKey: ['scanner-sessions-latest-vix'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'momentum_sessions' }, () => {
        qc.invalidateQueries({ queryKey: ['momentum-sessions'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, () => {
        qc.invalidateQueries({ queryKey: ['user_settings'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
