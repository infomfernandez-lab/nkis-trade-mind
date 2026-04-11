import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { FileText, Calendar, TrendingUp } from 'lucide-react';
import { closedTrades, formatCurrency, formatDate, computeStats } from '@/lib/mock-data';

export const Route = createFileRoute('/reports')({
  component: Reports,
  head: () => ({
    meta: [
      { title: 'Reports — NKIS Trading Intelligence' },
      { name: 'description', content: 'Generate weekly, monthly, and individual trade reports.' },
    ],
  }),
});

function Reports() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'trade'>('weekly');
  const stats = computeStats();
  const lastWeekTrades = closedTrades.slice(-4);
  const weekPnl = lastWeekTrades.reduce((s, t) => s + t.netPnl, 0);
  const weekWins = lastWeekTrades.filter(t => t.isWin).length;
  const fullCompliance = lastWeekTrades.filter(t => t.systemCompliance === '100%').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Performance reports for review and analysis</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary w-fit">
        {(['weekly', 'monthly', 'trade'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'weekly' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Weekly Report</h2>
              <p className="text-xs text-muted-foreground">Week of 07/04/2026 — 11/04/2026</p>
            </div>
            <Calendar className="w-5 h-5 text-primary" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="Trades" value={String(lastWeekTrades.length)} />
            <MiniStat label="P&L" value={formatCurrency(weekPnl)} positive={weekPnl >= 0} />
            <MiniStat label="Win Rate" value={`${lastWeekTrades.length > 0 ? ((weekWins / lastWeekTrades.length) * 100).toFixed(0) : 0}%`} />
            <MiniStat label="Compliance" value={`${lastWeekTrades.length > 0 ? ((fullCompliance / lastWeekTrades.length) * 100).toFixed(0) : 0}%`} />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Trades This Week</h3>
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

          <div>
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Next Week Outlook</h3>
            <textarea
              className="w-full h-20 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Write your outlook for next week..."
            />
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Monthly Report</h2>
              <p className="text-xs text-muted-foreground">April 2026</p>
            </div>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="Total P&L" value={formatCurrency(stats.totalPnl)} positive={stats.totalPnl >= 0} />
            <MiniStat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
            <MiniStat label="Profit Factor" value={stats.profitFactor.toFixed(2)} />
            <MiniStat label="Total Trades" value={String(stats.totalTrades)} />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Self-Assessment</h3>
            <textarea
              className="w-full h-24 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="How do you assess your performance this month?"
            />
          </div>
        </div>
      )}

      {activeTab === 'trade' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-2xl">
          <h2 className="font-display text-lg font-bold">Individual Trade Report</h2>
          <p className="text-sm text-muted-foreground">Select a trade from the Trade Log to generate a detailed report.</p>
          <div className="space-y-2">
            {closedTrades.slice(-5).reverse().map(t => (
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
