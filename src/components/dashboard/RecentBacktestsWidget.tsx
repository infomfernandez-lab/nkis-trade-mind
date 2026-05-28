import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/trade-utils';

type Row = {
  id: string;
  symbol: string;
  broker: string;
  direction: string;
  created_at: string;
  metrics: any;
};

export function RecentBacktestsWidget() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['recent-backtests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backtest_sessions')
        .select('id, symbol, broker, direction, created_at, metrics')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm">ÚLTIMOS 10 BACKTESTS</h2>
        <Link
          to="/backtester"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          Backtester <ArrowRight className="w-3 h-3" />
        </Link>
      </header>
      <div className="p-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-4">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-4">
            Aún no hay backtests guardados.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(r => {
              const pnl = Number(r.metrics?.total_pnl ?? r.metrics?.totalPnl ?? 0);
              const wr = Number(r.metrics?.win_rate ?? r.metrics?.winRate ?? 0);
              const pf = r.metrics?.profit_factor ?? r.metrics?.profitFactor;
              const dt = new Date(r.created_at);
              return (
                <li key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <span className="font-data font-bold w-20 truncate">{r.symbol}</span>
                  <span className="text-[10px] uppercase text-muted-foreground w-10 shrink-0">{r.broker}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border w-12 text-center shrink-0 ${
                    r.direction === 'long' || r.direction === 'BUY'
                      ? 'bg-success/15 text-success border-success/40'
                      : 'bg-destructive/15 text-destructive border-destructive/40'
                  }`}>
                    {r.direction === 'long' || r.direction === 'BUY' ? 'LONG' : 'SHORT'}
                  </span>
                  <span className={`font-data font-bold ml-auto ${pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(pnl)}
                  </span>
                  <span className="font-data text-muted-foreground w-12 text-right shrink-0">
                    {wr ? `${wr.toFixed(0)}%` : '—'}
                  </span>
                  <span className="font-data text-muted-foreground w-10 text-right shrink-0">
                    {pf != null ? Number(pf).toFixed(2) : '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-data w-16 text-right shrink-0">
                    {dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
