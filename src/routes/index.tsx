import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { filterByBroker } from '@/lib/trade-utils';
import { accountFromSettings } from '@/lib/account';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { StatusBar } from '@/components/radar/StatusBar';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { PnlCalendarSection } from '@/components/statistics/PnlCalendarSection';
import { MarketBriefing } from '@/components/dashboard/MarketBriefing';
import { AgendaTodayWidget } from '@/components/agenda/AgendaTodayWidget';
import { TodaySummary } from '@/components/dashboard/TodaySummary';
import { TopScannerWidget } from '@/components/dashboard/TopScannerWidget';
import { EconomicCalendarWidget } from '@/components/dashboard/EconomicCalendarWidget';
import { RecentBacktestsWidget } from '@/components/dashboard/RecentBacktestsWidget';
import { RecentClosedTradesWidget } from '@/components/dashboard/RecentClosedTradesWidget';
import { SystemPerformanceWidget } from '@/components/dashboard/SystemPerformanceWidget';

export const Route = createFileRoute('/')({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: 'Panel — CAP Trading' },
      { name: 'description', content: 'Cockpit diario de la cuenta CWND: resumen del día, briefing, escáner, posiciones y backtests.' },
      { property: 'og:title', content: 'Panel — CAP Trading' },
      { property: 'og:description', content: 'Cockpit diario de la cuenta CWND.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
});

function Dashboard() {
  const { closedTrades: allClosed, openTrades: allOpen, isLoading, error } = useAllTrades();
  const { data: settings } = useSettings();
  const { broker } = useBrokerFilter();

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
  const startingBalance = accountFromSettings(settings).saldoInicial;

  const account = accountFromSettings(settings);
  const initialBalance = account.saldoInicial;
  // El balance que llega del script de sincronización (balance_nkis) es el de CWND.
  const syncedBalance = Number((settings as any)?.balance_nkis ?? 0);
  const realized = closedTrades.reduce((s, t) => s + t.netPnl, 0);
  const currentBalance = syncedBalance > 0 ? syncedBalance : initialBalance + realized;
  const brokerLabel = ' — CWND';

  return (
    <div className="space-y-4 max-w-[1800px] mx-auto">
      <StatusBar brokerFilter={broker} />

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Panel{brokerLabel}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cockpit diario · CAP Trend Following</p>
      </div>

      {/* Fila 1: Resumen de hoy + Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <TodaySummary closed={closedTrades} open={openTrades} />
        </div>
        <div className="lg:col-span-2">
          <MarketBriefing openTrades={openTrades} />
        </div>
      </div>

      {/* Fila 2: Rendimiento del sistema (ancho completo) */}
      <SystemPerformanceWidget
        closed={closedTrades}
        open={openTrades}
        startingBalance={startingBalance}
        initialBalance={initialBalance}
        currentBalance={currentBalance}
      />

      {/* Fila 3: Top escáner + Calendario económico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopScannerWidget brokerFilter={broker} />
        <EconomicCalendarWidget />
      </div>

      {/* Fila 4: Posiciones abiertas + Agenda hoy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
            <h2 className="font-display font-bold text-sm">POSICIONES ABIERTAS</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
              {openTrades.length}
            </span>
          </div>
          <OpenPositionsTable brokerFilter={broker} compact />
        </div>
        <div>
          <AgendaTodayWidget />
        </div>
      </div>

      {/* Fila 5: Últimas cerradas + Backtests recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentClosedTradesWidget closed={closedTrades} />
        <RecentBacktestsWidget />
      </div>

      {/* Fila 6: Calendario P&L */}
      <PnlCalendarSection closedTrades={closedTrades} />

      {closedTrades.length === 0 && openTrades.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">Aún no hay trades. Conecta tu script de sincronización MT5 para empezar.</p>
        </div>
      )}
    </div>
  );
}
