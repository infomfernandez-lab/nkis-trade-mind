import { createFileRoute } from '@tanstack/react-router';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  equityCurve, monthlyPnl, closedTrades, openPositions,
  formatCurrency, formatDate, computeStats
} from '@/lib/mock-data';

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
  const stats = computeStats();
  const recentTrades = [...closedTrades].reverse().slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Mission control — Sistema 1</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Trades" value={String(stats.totalTrades)} sub={`${stats.wins}W / ${stats.losses}L`} />
        <StatCard label="Avg Win" value={formatCurrency(closedTrades.filter(t=>t.isWin).reduce((s,t)=>s+t.netPnl,0) / Math.max(stats.wins,1))} positive />
        <StatCard label="Avg Loss" value={formatCurrency(closedTrades.filter(t=>!t.isWin).reduce((s,t)=>s+t.netPnl,0) / Math.max(stats.losses,1))} />
        <StatCard label="Best Trade" value={formatCurrency(Math.max(...closedTrades.map(t=>t.netPnl)))} positive />
      </div>

      {/* Equity Curve */}
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
              <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} domain={['dataMin - 200', 'dataMax + 200']} />
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

      {/* Monthly P&L + Open Positions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly P&L */}
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

        {/* Open Positions */}
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold text-foreground mb-4">
            Open Positions <span className="text-muted-foreground font-normal">({openPositions.length})</span>
          </h2>
          <div className="space-y-3">
            {openPositions.map(trade => (
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
            {openPositions.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No open positions</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Closed Trades */}
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
