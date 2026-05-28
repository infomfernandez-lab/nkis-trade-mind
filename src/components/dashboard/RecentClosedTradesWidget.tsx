import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, type Trade } from '@/lib/trade-utils';

export function RecentClosedTradesWidget({ closed }: { closed: Trade[] }) {
  const recent = useMemo(() => {
    return [...closed]
      .sort((a, b) => new Date(b.exitDate ?? b.entryDate).getTime() - new Date(a.exitDate ?? a.entryDate).getTime())
      .slice(0, 5);
  }, [closed]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <h2 className="font-display font-bold text-sm">ÚLTIMAS CERRADAS</h2>
        <Link
          to="/trades"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </header>
      <div className="p-2">
        {recent.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-4">
            Aún no hay operaciones cerradas.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map(t => {
              const dt = new Date(t.exitDate ?? t.entryDate);
              return (
                <li key={t.id}>
                  <Link
                    to="/trade/$tradeId"
                    params={{ tradeId: t.id }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-secondary/40"
                  >
                    <span className="font-data font-bold w-24 truncate">{t.symbol}</span>
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      t.direction === 'BUY' ? 'bg-success/15 text-success border-success/40' : 'bg-destructive/15 text-destructive border-destructive/40'
                    }`}>
                      {t.direction === 'BUY' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {t.direction}
                    </span>
                    <span className={`ml-auto font-data font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(t.netPnl)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-data w-16 text-right shrink-0">
                      {dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
