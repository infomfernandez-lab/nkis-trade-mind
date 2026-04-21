import { createFileRoute, Link } from '@tanstack/react-router';
import { Loader2, ArrowRight, Zap } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import {
  formatCurrency, computeStatsFromTrades, filterByBroker,
} from '@/lib/trade-utils';
import { computeDashboardKpis } from '@/lib/analytics';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { StatusBar } from '@/components/radar/StatusBar';
import { ProximoEntradaBlock, useProximoEntradaCount } from '@/components/radar/ProximoEntradaBlock';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { MomentumBlock, useMomentumCount } from '@/components/radar/MomentumBlock';

export const Route = createFileRoute('/')({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: 'Panel — CAP Trading' },
      { name: 'description', content: 'Vista resumida del centro de mando: próximas señales, posiciones abiertas y KPIs del sistema.' },
    ],
  }),
});

function Dashboard() {
  const { closedTrades: allClosed, openTrades: allOpen, isLoading, error } = useAllTrades();
  const { data: settings } = useSettings();
  const { broker } = useBrokerFilter();
  const proximoCount = useProximoEntradaCount(broker);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando panel...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Error al cargar datos: {error.message}</p>
      </div>
    );
  }

  const closedTrades = filterByBroker(allClosed, broker);
  const openTrades = filterByBroker(allOpen, broker);
  const startingBalance = Number(settings?.balance ?? 10000);
  const stats = computeStatsFromTrades(closedTrades, openTrades);
  const kpis = computeDashboardKpis(closedTrades, startingBalance);

  const brokerLabel = broker === 'all' ? '' : ` — ${broker === 'darwinex' ? 'Darwinex' : 'FXPro'}`;

  return (
    <div className="space-y-4">
      <StatusBar brokerFilter={broker} />

      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Panel{brokerLabel}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">CAP Trend Following — Vista resumida</p>
        </div>
        <Link
          to="/radar"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
        >
          Centro de mando completo <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ④ Próximo a entrada — siempre visible y prioritario */}
      <section className="space-y-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${
          proximoCount > 0 ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-card border-border'
        }`}>
          {proximoCount > 0 && <Zap className="w-4 h-4 animate-pulse" />}
          <h2 className={`font-display font-bold text-sm ${proximoCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
            ④ PRÓXIMO A ENTRADA
          </h2>
          {proximoCount > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/40">
              {proximoCount} ⚡
            </span>
          )}
        </div>
        <ProximoEntradaBlock brokerFilter={broker} />
      </section>

      {/* ① Posiciones abiertas */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
          <h2 className="font-display font-bold text-sm text-foreground">① POSICIONES ABIERTAS</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
            {openTrades.length}
          </span>
        </div>
        <OpenPositionsTable brokerFilter={broker} />
      </section>

      {/* ⑤ Momentum */}
      <MomentumSection broker={broker} />

      {/* KPIs resumidos */}
      {(closedTrades.length > 0 || openTrades.length > 0) && (
        <section className="space-y-2">
          <h2 className="font-display font-bold text-sm text-foreground px-1">Resumen del sistema</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="P&L Total" value={formatCurrency(stats.totalPnl)} positive={stats.totalPnl >= 0} />
            <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} positive={stats.winRate >= 50} sub={`${stats.wins}W / ${stats.losses}L`} />
            <StatCard label="Profit Factor" value={kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)} positive={kpis.profitFactor >= 1} />
            <StatCard label="Esperanza" value={`€${kpis.expectancy.toFixed(2)}`} positive={kpis.expectancy >= 0} />
          </div>
        </section>
      )}

      {closedTrades.length === 0 && openTrades.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">Aún no hay trades. Conecta tu script de sincronización MT5 para empezar.</p>
        </div>
      )}
    </div>
  );
}

function MomentumSection({ broker }: { broker: ReturnType<typeof useBrokerFilter>['broker'] }) {
  const { total, long, short } = useMomentumCount(broker);
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border flex-wrap">
        <h2 className="font-display font-bold text-sm text-foreground">⑤ MOMENTUM</h2>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
          {total}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/40">
          LONG: {long}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/40">
          SHORT: {short}
        </span>
      </div>
      <MomentumBlock brokerFilter={broker} />
    </section>
  );
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 card-hover">
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-lg font-data font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-success' : 'text-destructive'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

