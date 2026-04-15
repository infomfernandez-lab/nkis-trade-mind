import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Radar, Eye, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatDate } from '@/lib/trade-utils';

interface ScannerInstrument {
  rank: number;
  symbol: string;
  direction: string;
  score: number;
  adx_value?: number;
  adx_state?: string;
  distance_to_ma50?: number;
  momentum_aligned?: boolean;
}

function useLatestScannerSession() {
  return useQuery({
    queryKey: ['scanner-session', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('*')
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function ScannerSessionPanel({ onWatch }: { onWatch?: (instrument: ScannerInstrument) => void }) {
  const { data: session, isLoading } = useLatestScannerSession();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
        <h2 className="font-display text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          Última Sesión del Radar
        </h2>
        <div className="text-sm text-muted-foreground text-center py-8">Cargando...</div>
      </div>
    );
  }

  const instruments: ScannerInstrument[] = Array.isArray(session?.top_instruments)
    ? (session.top_instruments as ScannerInstrument[]).slice(0, 10)
    : [];

  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          Última Sesión del Radar
        </h2>
        {session && (
          <span className="text-xs text-muted-foreground font-data">
            {formatDate(session.session_date)}
          </span>
        )}
      </div>

      {instruments.length === 0 ? (
        <div className="text-center py-10">
          <Radar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Sin sesiones de radar todavía.</p>
          <p className="text-xs text-muted-foreground mt-1">Sincroniza tu scanner desde MT5 para ver resultados aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {instruments.map((inst, i) => {
            const isAlcista = inst.direction?.toLowerCase() === 'alcista' || inst.direction?.toLowerCase() === 'buy';
            return (
              <div
                key={`${inst.symbol}-${i}`}
                className={`rounded-lg border p-3 transition-colors ${
                  isAlcista ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-data text-muted-foreground">#{inst.rank}</span>
                  {isAlcista ? (
                    <TrendingUp className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                  )}
                </div>
                <div className="font-semibold text-sm mb-1">{inst.symbol}</div>
                <div className={`text-xs font-semibold mb-2 ${isAlcista ? 'text-success' : 'text-destructive'}`}>
                  {isAlcista ? 'Alcista' : 'Bajista'}
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Score</span>
                    <span className="font-data font-semibold text-foreground">{inst.score}/100</span>
                  </div>
                  {inst.adx_value != null && (
                    <div className="flex justify-between">
                      <span>ADX</span>
                      <span className="font-data">{inst.adx_value} {inst.adx_state && `(${inst.adx_state})`}</span>
                    </div>
                  )}
                  {inst.distance_to_ma50 != null && (
                    <div className="flex justify-between">
                      <span>Dist MA50</span>
                      <span className="font-data">{inst.distance_to_ma50}%</span>
                    </div>
                  )}
                  {inst.momentum_aligned != null && (
                    <div className="flex justify-between">
                      <span>Momentum</span>
                      <span className={inst.momentum_aligned ? 'text-success' : 'text-destructive'}>
                        {inst.momentum_aligned ? '✓ Alineado' : '✗ No'}
                      </span>
                    </div>
                  )}
                </div>

                {onWatch && (
                  <button
                    onClick={() => onWatch(inst)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Vigilar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {session?.notes && (
        <div className="mt-4 p-3 rounded-md bg-secondary text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Notas:</span> {session.notes}
        </div>
      )}
    </div>
  );
}
