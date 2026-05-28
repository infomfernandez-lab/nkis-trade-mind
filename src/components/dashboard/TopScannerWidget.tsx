import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Radar, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

type Asset = {
  symbol: string;
  broker: string;
  familia: string | null;
  last_score: number | null;
  last_direction: string | null;
  is_active_scanner: boolean | null;
};

export function TopScannerWidget({ brokerFilter }: { brokerFilter: 'all' | 'darwinex' | 'octx' }) {
  const brokerDb = brokerFilter === 'darwinex' ? 'nkis' : brokerFilter === 'octx' ? 'octx' : 'all';

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['top-scanner', brokerDb],
    queryFn: async () => {
      const qs = new URLSearchParams({ select: '*' });
      if (brokerDb !== 'all') qs.set('broker', brokerDb);
      const res = await fetch(`/api/assets-proxy?${qs.toString()}`);
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      return (await res.json()) as Asset[];
    },
  });

  const top = assets
    .filter(a => a.is_active_scanner && a.last_score != null)
    .sort((a, b) => Number(b.last_score) - Number(a.last_score))
    .slice(0, 10);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Radar className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm">TOP 10 ESCÁNER</h2>
        <Link
          to="/radar"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          Ver completo <ArrowRight className="w-3 h-3" />
        </Link>
      </header>
      <div className="p-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-4">Cargando…</div>
        ) : top.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-4">
            Sin instrumentos activos en el escáner.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {top.map(a => {
              const score = Number(a.last_score ?? 0);
              const tier =
                score >= 75 ? { cls: 'bg-primary/15 text-primary border-primary/40', label: 'Élite' }
                : score >= 60 ? { cls: 'bg-success/15 text-success border-success/40', label: 'Sólido' }
                : { cls: 'bg-secondary text-muted-foreground border-border', label: 'Obs.' };
              const dir = (a.last_direction ?? '').toUpperCase();
              const isUp = dir === 'ALCISTA';
              return (
                <li key={`${a.symbol}-${a.broker}`}>
                  <Link
                    to="/activos/$broker/$symbol"
                    params={{ broker: a.broker, symbol: a.symbol }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-secondary/40"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${tier.cls} w-12 text-center shrink-0`}>
                      {tier.label}
                    </span>
                    <span className="font-data font-bold w-20 truncate">{a.symbol}</span>
                    <span className="text-[10px] uppercase text-muted-foreground w-10 shrink-0">{a.broker}</span>
                    <span className="text-[10px] text-muted-foreground truncate flex-1">{a.familia ?? '—'}</span>
                    {dir && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isUp ? 'text-success' : 'text-destructive'}`}>
                        {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {dir === 'ALCISTA' ? 'AL' : dir === 'BAJISTA' ? 'BA' : dir}
                      </span>
                    )}
                    <span className="font-data font-bold text-sm w-10 text-right">{score.toFixed(0)}</span>
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
