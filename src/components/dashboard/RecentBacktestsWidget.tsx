import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FlaskConical, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Row = {
  id: string;
  symbol: string;
  broker: string;
  direction: string;
  created_at: string;
  metrics: any;
  params?: any;
};

export function RecentBacktestsWidget() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['recent-backtests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backtest_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as any[]).filter(r => r.params?.tipo === 'import' && r.archivada !== true).slice(0, 10) as Row[];
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
              const vs: any[] = r.metrics?.variantes ?? [];
              const best = [...vs].sort((a, b) => (b.pf ?? 0) - (a.pf ?? 0))[0];
              const dt = new Date(r.created_at);
              return (
                <li key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <span className="font-semibold flex-1 truncate">{r.params?.nombre}</span>
                  <span className="text-[10px] uppercase text-muted-foreground w-12 shrink-0">{r.params?.fuente}</span>
                  <span className="font-data text-muted-foreground w-16 text-right shrink-0">{r.metrics?.n ?? 0} ops</span>
                  <span className="font-data font-bold w-16 text-right shrink-0">PF {best ? (best.pf === null || best.pf > 1e9 ? '∞' : Number(best.pf).toFixed(2)) : '—'}</span>
                  <span className="text-[10px] text-muted-foreground font-data w-12 text-right shrink-0">
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
