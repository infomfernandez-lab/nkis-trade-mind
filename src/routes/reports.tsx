import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { FileText, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { useClosedTrades } from '@/hooks/use-trades';
import { formatCurrency, formatDate, computeStatsFromTrades } from '@/lib/trade-utils';

export const Route = createFileRoute('/reports')({
  component: Reports,
  head: () => ({
    meta: [
      { title: 'Informes — CAP Trading' },
      { name: 'description', content: 'Genera informes semanales, mensuales e individuales de trades.' },
    ],
  }),
});

function Reports() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'trade'>('weekly');
  const { data: closedTrades, isLoading, error } = useClosedTrades();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando informes...</span>
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

  const trades = closedTrades ?? [];
  const stats = computeStatsFromTrades(trades, []);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const lastWeekTrades = trades.filter(t => t.exitDate && new Date(t.exitDate) >= oneWeekAgo);
  const weekPnl = lastWeekTrades.reduce((s, t) => s + t.netPnl, 0);
  const weekWins = lastWeekTrades.filter(t => t.isWin).length;
  const fullCompliance = lastWeekTrades.filter(t => t.systemCompliance === '100%').length;

  const now = new Date();
  const monthTrades = trades.filter(t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthStats = computeStatsFromTrades(monthTrades, []);

  const tabLabels: Record<string, string> = { weekly: 'Semanal', monthly: 'Mensual', trade: 'Por Trade' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Informes</h1>
        <p className="text-sm text-muted-foreground mt-1">Informes de rendimiento para revisión y análisis</p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary w-fit">
        {(['weekly', 'monthly', 'trade'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'weekly' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Informe Semanal</h2>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </div>
            <Calendar className="w-5 h-5 text-primary" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="Trades" value={String(lastWeekTrades.length)} />
            <MiniStat label="P&L" value={formatCurrency(weekPnl)} positive={weekPnl >= 0} />
            <MiniStat label="Win Rate" value={`${lastWeekTrades.length > 0 ? ((weekWins / lastWeekTrades.length) * 100).toFixed(0) : 0}%`} />
            <MiniStat label="Cumplimiento" value={`${lastWeekTrades.length > 0 ? ((fullCompliance / lastWeekTrades.length) * 100).toFixed(0) : 0}%`} />
          </div>

          {lastWeekTrades.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Trades de Esta Semana</h3>
              <div className="space-y-2">
                {lastWeekTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-data font-bold ${t.direction === 'BUY' ? 'text-success' : 'text-destructive'}`}>{t.direction}</span>
                      <span className="font-medium">{t.symbol}</span>
                    </div>
                    <span className={`font-data font-semibold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No se cerraron trades esta semana.</p>
          )}

          <div>
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Perspectiva Próxima Semana</h3>
            <textarea
              className="w-full h-20 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Escribe tu perspectiva para la próxima semana..."
            />
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Informe Mensual</h2>
              <p className="text-xs text-muted-foreground">{now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="P&L Total" value={formatCurrency(monthStats.totalPnl)} positive={monthStats.totalPnl >= 0} />
            <MiniStat label="Win Rate" value={`${monthStats.winRate.toFixed(1)}%`} />
            <MiniStat label="Profit Factor" value={monthStats.profitFactor === Infinity ? '∞' : monthStats.profitFactor.toFixed(2)} />
            <MiniStat label="Total Trades" value={String(monthStats.totalTrades)} />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Autoevaluación</h3>
            <textarea
              className="w-full h-24 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="¿Cómo evalúas tu rendimiento este mes?"
            />
          </div>
        </div>
      )}

      {activeTab === 'trade' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-2xl">
          <h2 className="font-display text-lg font-bold">Informe Individual de Trade</h2>
          {trades.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">Selecciona un trade del Registro para generar un informe detallado.</p>
              <div className="space-y-2">
                {[...trades].reverse().slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-md bg-secondary border border-border hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-data font-bold ${t.direction === 'BUY' ? 'text-success' : 'text-destructive'}`}>{t.direction}</span>
                      <span className="font-medium text-sm">{t.symbol}</span>
                      <span className="text-xs text-muted-foreground font-data">{formatDate(t.entryDate)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-data font-semibold text-sm ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aún no hay trades disponibles para informes.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="p-3 rounded-md bg-secondary">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-lg font-data font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-success' : 'text-destructive'}`}>{value}</div>
    </div>
  );
}
