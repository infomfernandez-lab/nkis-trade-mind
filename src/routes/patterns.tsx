import { createFileRoute } from '@tanstack/react-router';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { useClosedTrades } from '@/hooks/use-trades';
import { formatCurrency, type Trade } from '@/lib/trade-utils';

export const Route = createFileRoute('/patterns')({
  component: Patterns,
  head: () => ({
    meta: [
      { title: 'Pattern Intelligence — NKIS Trading Intelligence' },
      { name: 'description', content: 'Behavioral and performance pattern analysis.' },
    ],
  }),
});

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = fn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function Patterns() {
  const { data: closedTrades, isLoading, error } = useClosedTrades();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading patterns...</span>
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

  const trades = closedTrades ?? [];

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Pattern Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Not enough data yet</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm">Patterns will emerge once you have closed trades in the system.</p>
        </div>
      </div>
    );
  }

  const byCompliance = groupBy(trades.filter(t => t.systemCompliance), t => t.systemCompliance!);
  const complianceData = Object.entries(byCompliance).map(([key, trades]) => ({
    name: key,
    avgPnl: trades.reduce((s, t) => s + t.netPnl, 0) / trades.length,
    winRate: (trades.filter(t => t.isWin).length / trades.length) * 100,
    count: trades.length,
  }));

  const byEmotion = groupBy(trades.filter(t => t.emotionalState), t => t.emotionalState!);
  const emotionData = Object.entries(byEmotion).map(([key, trades]) => ({
    name: key,
    avgPnl: trades.reduce((s, t) => s + t.netPnl, 0) / trades.length,
    totalPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    winRate: (trades.filter(t => t.isWin).length / trades.length) * 100,
    count: trades.length,
  }));

  const withIntervention = trades.filter(t => t.manualIntervention && t.manualIntervention !== 'None, EA managing');
  const interventionCost = withIntervention.reduce((s, t) => s + t.netPnl, 0);
  const interventionByType = groupBy(withIntervention, t => t.manualIntervention!);

  const adxGroups = [
    { label: 'ADX > 35', trades: trades.filter(t => t.adxValue > 35) },
    { label: 'ADX 25-35', trades: trades.filter(t => t.adxValue >= 25 && t.adxValue <= 35) },
    { label: 'ADX < 25', trades: trades.filter(t => t.adxValue < 25) },
  ].filter(g => g.trades.length > 0);

  const adxData = adxGroups.map(g => ({
    name: g.label,
    winRate: (g.trades.filter(t => t.isWin).length / g.trades.length) * 100,
    avgPnl: g.trades.reduce((s, t) => s + t.netPnl, 0) / g.trades.length,
    count: g.trades.length,
  }));

  const bySymbol = groupBy(trades, t => t.symbol);
  const instrumentData = Object.entries(bySymbol).map(([symbol, trades]) => ({
    symbol,
    totalPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    winRate: (trades.filter(t => t.isWin).length / trades.length) * 100,
    count: trades.length,
    avgPnl: trades.reduce((s, t) => s + t.netPnl, 0) / trades.length,
  })).sort((a, b) => b.totalPnl - a.totalPnl);

  const byAdxState = groupBy(trades, t => t.adxState);
  const adxStateData = Object.entries(byAdxState).map(([state, trades]) => ({
    name: state,
    winRate: (trades.filter(t => t.isWin).length / trades.length) * 100,
    count: trades.length,
    avgPnl: trades.reduce((s, t) => s + t.netPnl, 0) / trades.length,
  }));

  const insights = generateInsights(trades, complianceData, emotionData, interventionCost, withIntervention, adxData);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Pattern Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">Behavioral and performance patterns from {trades.length} trades</p>
      </div>

      {insights.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 lg:p-6 gold-glow">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-primary">Auto-Generated Insights</h2>
          </div>
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${insight.type === 'positive' ? 'bg-success' : insight.type === 'warning' ? 'bg-yellow-500' : 'bg-destructive'}`} />
                <p className="text-foreground/90">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Performance by System Compliance">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'Avg P&L']} />
                <Bar dataKey="avgPnl" radius={[3, 3, 0, 0]}>
                  {complianceData.map((d, i) => (
                    <Cell key={i} fill={d.avgPnl >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {complianceData.map(d => (
              <div key={d.name} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{d.name}</span>: {d.winRate.toFixed(0)}% WR ({d.count} trades)
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Emotional State Analysis">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emotionData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'Avg P&L']} />
                <Bar dataKey="avgPnl" radius={[3, 3, 0, 0]}>
                  {emotionData.map((d, i) => (
                    <Cell key={i} fill={d.avgPnl >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Cost of Manual Interventions">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${interventionCost < 0 ? 'text-destructive' : 'text-success'}`} />
              <div>
                <div className={`text-2xl font-data font-bold ${interventionCost < 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(interventionCost)}
                </div>
                <div className="text-xs text-muted-foreground">Total cost of {withIntervention.length} interventions</div>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(interventionByType).map(([type, trades]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                  <span className="text-muted-foreground">{type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{trades.length} trades</span>
                    <span className={`font-data font-semibold ${trades.reduce((s, t) => s + t.netPnl, 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(trades.reduce((s, t) => s + t.netPnl, 0))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Win Rate by ADX Level">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adxData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Win Rate']} />
                <Bar dataKey="winRate" radius={[3, 3, 0, 0]} fill="#c8a951" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {adxData.map(d => (
              <div key={d.name} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{d.name}</span>: Avg {formatCurrency(d.avgPnl)} ({d.count} trades)
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
        <h2 className="font-display text-sm font-semibold text-foreground mb-4">Instrument Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Symbol</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Total P&L</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Win Rate</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Avg P&L</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Trades</th>
              </tr>
            </thead>
            <tbody>
              {instrumentData.map(d => (
                <tr key={d.symbol} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="py-2.5 px-3 font-semibold">{d.symbol}</td>
                  <td className={`py-2.5 px-3 text-right font-data font-semibold ${d.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(d.totalPnl)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-data ${d.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>
                    {d.winRate.toFixed(0)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-data ${d.avgPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(d.avgPnl)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground font-data">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
        <h2 className="font-display text-sm font-semibold text-foreground mb-4">Win Rate by ADX State</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {adxStateData.map(d => (
            <div key={d.name} className="p-3 rounded-md bg-secondary border border-border text-center">
              <div className="text-xs text-muted-foreground mb-1">{d.name}</div>
              <div className={`text-xl font-data font-bold ${d.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>{d.winRate.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground mt-1">{d.count} trades • Avg {formatCurrency(d.avgPnl)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <h2 className="font-display text-sm font-semibold text-foreground mb-4">{title}</h2>
      {children}
    </div>
  );
}

interface Insight {
  text: string;
  type: 'positive' | 'warning' | 'negative';
  impact: number;
}

function generateInsights(
  trades: Trade[],
  complianceData: { name: string; avgPnl: number; winRate: number; count: number }[],
  emotionData: { name: string; avgPnl: number; totalPnl: number; winRate: number; count: number }[],
  interventionCost: number,
  withIntervention: Trade[],
  adxData: { name: string; winRate: number; avgPnl: number; count: number }[],
): Insight[] {
  const insights: Insight[] = [];
  const MIN_TRADES = 3;

  const full = complianceData.find(c => c.name === '100%');
  const partial = complianceData.filter(c => c.name !== '100%');
  if (full && full.count >= MIN_TRADES && partial.length > 0) {
    const partialAvg = partial.reduce((s, c) => s + c.avgPnl * c.count, 0) / partial.reduce((s, c) => s + c.count, 0);
    if (full.avgPnl > partialAvg) {
      const diff = ((full.avgPnl - partialAvg) / Math.abs(partialAvg) * 100);
      insights.push({
        text: `You are ${Math.abs(diff).toFixed(0)}% more profitable when you follow the system exactly. Full compliance win rate: ${full.winRate.toFixed(0)}%.`,
        type: 'positive',
        impact: Math.abs(diff),
      });
    }
  }

  const anxious = emotionData.find(e => e.name === 'Anxious');
  const calm = emotionData.find(e => e.name === 'Calm');
  if (anxious && anxious.count >= MIN_TRADES && anxious.totalPnl < 0) {
    insights.push({
      text: `Trading while anxious has cost you ${formatCurrency(Math.abs(anxious.totalPnl)).replace('+', '')} in realized losses across ${anxious.count} trades.`,
      type: 'negative',
      impact: Math.abs(anxious.totalPnl),
    });
  }
  if (calm && calm.count >= MIN_TRADES) {
    insights.push({
      text: `When calm, your win rate is ${calm.winRate.toFixed(0)}% with an average P&L of ${formatCurrency(calm.avgPnl)} per trade.`,
      type: 'positive',
      impact: calm.avgPnl,
    });
  }

  if (withIntervention.length >= 2) {
    insights.push({
      text: `You have intervened manually in ${withIntervention.length} trades, resulting in a net ${formatCurrency(interventionCost)}.`,
      type: interventionCost < 0 ? 'negative' : 'warning',
      impact: Math.abs(interventionCost),
    });
  }

  const highAdx = adxData.find(a => a.name === 'ADX > 35');
  const lowAdx = adxData.find(a => a.name === 'ADX < 25');
  if (highAdx && lowAdx && highAdx.count >= MIN_TRADES && lowAdx.count >= MIN_TRADES) {
    insights.push({
      text: `Your win rate with ADX > 35 is ${highAdx.winRate.toFixed(0)}% vs ${lowAdx.winRate.toFixed(0)}% with ADX < 25. Strong trends produce better results.`,
      type: 'positive',
      impact: highAdx.winRate - lowAdx.winRate,
    });
  }

  return insights.sort((a, b) => b.impact - a.impact);
}
