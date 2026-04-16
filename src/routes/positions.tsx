import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { formatCurrency, formatDate, filterByBroker } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/positions')({
  component: PositionsPage,
  head: () => ({
    meta: [
      { title: 'Posiciones Abiertas — CAP Trading' },
      { name: 'description', content: 'Posiciones abiertas en tiempo real.' },
    ],
  }),
});

function PositionsPage() {
  const { openTrades: allOpen, isLoading } = useAllTrades();
  const { broker } = useBrokerFilter();
  const openTrades = filterByBroker(allOpen, broker);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando posiciones...</span>
      </div>
    );
  }

  const totalPnl = openTrades.reduce((s, t) => s + t.netPnl, 0);
  const brokers = [...new Set(openTrades.map(t => t.broker))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Posiciones Abiertas</h1>
        <p className="text-sm text-muted-foreground mt-1">Exposición actual del portafolio</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Posiciones</div>
          <div className="text-xl font-data font-bold text-foreground">{openTrades.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">P&L No Realizado</div>
          <div className={`text-xl font-data font-bold ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(totalPnl)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Brokers Activos</div>
          <div className="text-xl font-data font-bold text-foreground">
            {brokers.length > 0 ? brokers.join(', ') : '—'}
          </div>
        </div>
      </div>

      {/* Positions list */}
      {openTrades.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Sin posiciones abiertas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openTrades.map(trade => {
            const isPositive = trade.netPnl >= 0;
            const entryTime = new Date(trade.entryDate).getTime();
            const now = Date.now();
            const hoursOpen = (now - entryTime) / (1000 * 60 * 60);
            const durationLabel = hoursOpen >= 24
              ? `${Math.floor(hoursOpen / 24)}d ${Math.floor(hoursOpen % 24)}h`
              : `${Math.floor(hoursOpen)}h`;

            return (
              <div
                key={trade.id}
                className={`rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30 ${
                  isPositive ? 'border-l-4 border-l-success border-y-border border-r-border' : 'border-l-4 border-l-destructive border-y-border border-r-border'
                }`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Symbol & direction */}
                  <div className="flex items-center gap-3 min-w-[160px]">
                    <span className="text-lg font-bold text-foreground">{trade.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-data font-semibold ${
                      trade.direction === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {trade.direction}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-secondary text-xs text-muted-foreground capitalize">{trade.broker}</span>
                  </div>

                  {/* Entry & duration */}
                  <div className="text-xs text-muted-foreground">
                    <div>Entrada: {formatDate(trade.entryDate)}</div>
                    <div>Duración: <span className="font-data font-semibold text-foreground">{durationLabel}</span></div>
                  </div>

                  {/* Prices */}
                  <div className="text-xs font-data">
                    <div>Entry: <span className="text-foreground">{trade.entryPrice.toFixed(trade.entryPrice > 100 ? 2 : 5)}</span></div>
                    <div className="flex gap-3">
                      {trade.slPrice > 0 && <span>SL: <span className="text-destructive">{trade.slPrice.toFixed(trade.slPrice > 100 ? 2 : 5)}</span></span>}
                      {trade.tpPrice > 0 && <span>TP: <span className="text-success">{trade.tpPrice.toFixed(trade.tpPrice > 100 ? 2 : 5)}</span></span>}
                    </div>
                  </div>

                  {/* ADX & Stochastic */}
                  <div className="text-xs text-muted-foreground">
                    {trade.adxValue > 0 && <div>ADX: <span className="font-data text-foreground">{trade.adxValue.toFixed(1)}</span> <span className="text-primary">{trade.adxState}</span></div>}
                    {trade.stochasticK > 0 && <div>Stoch K: <span className="font-data text-foreground">{trade.stochasticK.toFixed(1)}</span></div>}
                  </div>

                  {/* P&L */}
                  <div className="ml-auto text-right">
                    <div className={`text-lg font-data font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(trade.netPnl)}
                    </div>
                    <div className="text-xs text-muted-foreground font-data">{trade.lotSize} lotes</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
