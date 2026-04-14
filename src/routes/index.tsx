import { createFileRoute } from '@tanstack/react-router';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Target, Activity, Timer, ArrowDown } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import {
  formatCurrency, formatDate, computeStatsFromTrades,
  buildEquityCurve, buildMonthlyPnl
} from '@/lib/trade-utils';
import { computeDashboardKpis } from '@/lib/analytics';

export const Route = createFileRoute('/')({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: 'Dashboard — NKIS Trading Intelligence' },
      { name: 'description', content: 'Real-time trading overview and performance metrics.' },
    ],
  }),
});

function Dashboard() {
  const { closedTrades, openTrades, isLoading, error } = useAllTrades();
  const { data: settings } = useSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Failed to load data: {error.message}</p>
      </div>
    );
  }

  const startingBalance = Number(settings?.balance ?? 10000);
  const stats = computeStatsFromTrades(closedTrades, openTrades);
  const kpis = computeDashboardKpis(closedTrades, startingBalance);
  const equityCurve = buildEquityCurve(closedTrades, startingBalance);
  const monthlyPnl = buildMonthlyPnl(closedTrades);
  const recentTrades = [...closedTrades].reverse().slice(0, 8);
  const wins = closedTrades.filter(t => t.isWin);
  const losses = closedTrades.filter(t => !t.isWin);

  if (closedTrades.length === 0 && openTrades.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Mission control — Sistema 1</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm">No trades yet. Connect your MT5 sync script to start tracking.</p>
          <p className="text-xs text-muted-foreground mt-2">Go to Settings to get your API key for the sync script.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Mission control — Sistema 1</p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Trades" value={String(stats.totalTrades)} sub={`${stats.wins}W / ${stats.losses}L`} />
        <StatCard label="Avg Win" value={formatCurrency(wins.length > 0 ? wins.reduce((s, t) => s + t.netPnl, 0) / wins.length : 0)} positive />
        <StatCard label="Avg Loss" value={formatCurrency(losses.length > 0 ? losses.reduce((s, t) => s + t.netPnl, 0) / losses.length : 0)} />
        <StatCard label="Best Trade" value={formatCurrency(closedTrades.length > 0 ? Math.max(...closedTrades.map(t => t.netPnl)) : 0)} positive />
      </div>

      {/* Advanced KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Target className="w-4 h-4 text-primary" />} label="Expectancy" value={`€${kpis.expectancy.toFixed(2)}`} positive={kpis.expectancy >= 0} tooltip="(WinRate × AvgWin) - (LossRate × AvgLoss)" />
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-success" />} label="Profit Factor" value={kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)} positive={kpis.profitFactor >= 1} tooltip="Gross Profit / Gross Loss" />
        <KpiCard icon={<Activity className="w-4 h-4 text-primary" />} label="Recovery Factor" value={kpis.recoveryFactor === Infinity ? '∞' : kpis.recoveryFactor.toFixed(2)} positive={kpis.recoveryFactor >= 1} tooltip="Net P&L / Max Drawdown" />
        <KpiCard icon={<ArrowDown className="w-4 h-4 text-destructive" />} label="Current Drawdown" value={`€${kpis.currentDrawdown.toFixed(0)}`} sub={`${kpis.currentDrawdownPct.toFixed(1)}% from peak`} positive={kpis.currentDrawdown === 0} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Max Win Streak" value={String(kpis.maxConsecutiveWins)} sub="consecutive" positive />
        <StatCard label="Max Loss Streak" value={String(kpis.maxConsecutiveLosses)} sub="consecutive" />
        <KpiCard icon={<Timer className="w-4 h-4 text-success" />} label="Avg Duration (W)" value={`${kpis.avgDurationWinners.toFixed(1)}h`} />
        <KpiCard icon={<Timer className="w-4 h-4 text-destructive" />} label="Avg Duration (L)" value={`${kpis.avgDurationLosers.toFixed(1)}h`} />
      </div>

      {/* Equity Curve */}
      {equityCurve.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">Equity Curve</h2>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} domain={['dataMin - 200', 'dataMax + 200']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Equity']}
                />
                <Area type="monotone" dataKey="equity" stroke="#34d399" fill="url(#eqGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly P&L + Open Positions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {monthlyPnl.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
            <h2 className="font-display text-sm font-semibold text-foreground mb-4">Monthly P&L</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPnl} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [formatCurrency(value), 'P&L']}
                  />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]} fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">
            Open Positions <span className="text-muted-foreground font-normal">({openTrades.length})</span>
          </h2>
          <div className="space-y-3">
            {openTrades.map(trade => (
              <div key={trade.id} className="flex items-center justify-between p-3 rounded-md bg-secondary border border-border">
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-0.5 rounded text-xs font-data font-semibold ${trade.direction === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {trade.direction}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{trade.symbol}</div>
                    <div className="text-xs text-muted-foreground font-data">{trade.lotSize} lots</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-data font-semibold ${trade.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(trade.netPnl)}
                  </div>
                  <div className="text-xs text-muted-foreground font-data">{trade.durationHours}h</div>
                </div>
              </div>
            ))}
            {openTrades.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No open positions</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Closed Trades */}
      {recentTrades.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">Recent Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Symbol</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Dir</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Entry</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">P&L</th>
                  <th className="text-right py-2 px-2 text-xs text-muted-foreground font-medium">Duration</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Close</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map(trade => (
                  <tr key={trade.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-2.5 px-2 font-semibold">{trade.symbol}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-xs font-data font-semibold ${trade.direction === 'BUY' ? 'text-success' : 'text-destructive'}`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground font-data text-xs">{formatDate(trade.entryDate)}</td>
                    <td className={`py-2.5 px-2 text-right font-data font-semibold ${trade.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(trade.netPnl)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-muted-foreground font-data text-xs">{trade.durationHours}h</td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">{trade.howClosed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 card-hover">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-data font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-success' : 'text-destructive'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, positive, tooltip }: {
  icon?: React.ReactNode; label: string; value: string; sub?: string; positive?: boolean; tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 card-hover" title={tooltip}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-data font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-success' : 'text-destructive'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
