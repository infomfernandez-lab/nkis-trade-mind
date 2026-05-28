import { Flame, Snowflake } from 'lucide-react';
import { formatCurrency, computeStatsFromTrades, type Trade } from '@/lib/trade-utils';
import { computeDashboardKpis } from '@/lib/analytics';

export function SystemPerformanceWidget({
  closed, open, startingBalance, initialBalance, currentBalance,
}: {
  closed: Trade[]; open: Trade[]; startingBalance: number; initialBalance: number; currentBalance: number;
}) {
  const stats = computeStatsFromTrades(closed, open);
  const kpis = computeDashboardKpis(closed, startingBalance);
  const totalPnlPct = startingBalance > 0 ? (stats.totalPnl / startingBalance) * 100 : 0;

  const peak = Math.max(initialBalance, currentBalance);
  const ddRaw = peak > 0 && currentBalance > 0
    ? Math.max(0, ((peak - currentBalance) / peak) * 100)
    : 0;
  const drawdownPct = Math.min(100, ddRaw);

  const winRateOk = stats.winRate >= 40;
  const pfTone = kpis.profitFactor === Infinity || kpis.profitFactor >= 1.5
    ? 'good' : kpis.profitFactor < 1 ? 'bad' : 'neutral';
  const ddBad = drawdownPct > 3;

  return (
    <section className="space-y-2">
      <h2 className="font-display font-bold text-sm text-foreground px-1">RENDIMIENTO DEL SISTEMA</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="P&L Total" value={formatCurrency(stats.totalPnl)} sub={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`} tone={stats.totalPnl >= 0 ? 'good' : 'bad'} />
        <Metric label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub={`mín 40% · ${stats.wins}W / ${stats.losses}L`} tone={winRateOk ? 'good' : 'bad'} />
        <Metric label="Profit Factor" value={kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)} sub={pfTone === 'good' ? '≥ 1.5 ✓' : pfTone === 'bad' ? '< 1 ✗' : '1 – 1.5'} tone={pfTone} />
        <Metric label="Drawdown Máx" value={`${drawdownPct.toFixed(2)}%`} sub={currentBalance > 0 ? `${formatCurrency(currentBalance)} / pico ${formatCurrency(peak)}` : 'Sin balance sincronizado'} tone={ddBad ? 'bad' : 'good'} />
        <Metric label="Posiciones Abiertas" value={String(open.length)} tone="neutral" />
        <Metric
          label="Racha Actual"
          value={`${stats.currentStreak} ${stats.streakType}`}
          icon={stats.streakType === 'W' ? <Flame className="w-4 h-4 text-success" /> : <Snowflake className="w-4 h-4 text-destructive" />}
          tone={stats.currentStreak === 0 ? 'neutral' : stats.streakType === 'W' ? 'good' : 'bad'}
        />
      </div>
    </section>
  );
}

function Metric({ label, value, sub, tone = 'neutral', icon }: {
  label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral'; icon?: React.ReactNode;
}) {
  const valueColor = tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card p-3 card-hover">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-data font-bold flex items-center gap-1.5 ${valueColor}`}>
        {icon}
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
