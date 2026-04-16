import { createFileRoute } from '@tanstack/react-router';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, ScatterChart, Scatter, Cell
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import {
  formatCurrency, filterByBroker, buildEquityCurve
} from '@/lib/trade-utils';
import {
  computeDashboardKpis, computeAdvancedMetrics, computeMaeMfe,
  getPerformanceByAdxState, getPerformanceByMA50, getPerformanceByMomentum,
  getPerformanceByBroker, type GroupStat, type BrokerStat
} from '@/lib/analytics';
import { useBrokerFilter } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/statistics')({
  component: StatisticsPage,
  head: () => ({
    meta: [
      { title: 'Estadísticas — CAP Trading' },
      { name: 'description', content: 'Métricas avanzadas y análisis de rendimiento.' },
    ],
  }),
});

const GOLD = '#D4A017';
const GREEN = '#34d399';
const RED = '#f87171';

function StatisticsPage() {
  const { closedTrades: allClosed, openTrades: allOpen, isLoading } = useAllTrades();
  const { data: settings } = useSettings();
  const { broker } = useBrokerFilter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const closedTrades = filterByBroker(allClosed, broker);
  const startingBalance = Number(settings?.balance ?? 10000);
  const kpis = computeDashboardKpis(closedTrades, startingBalance);
  const adv = computeAdvancedMetrics(closedTrades, startingBalance);
  const maeMfe = computeMaeMfe(closedTrades);
  const byAdx = getPerformanceByAdxState(closedTrades);
  const byMA50 = getPerformanceByMA50(closedTrades);
  const byMomentum = getPerformanceByMomentum(closedTrades);
  const byBroker = getPerformanceByBroker(closedTrades);

  // Instrument categories
  const categorize = (symbol: string): string => {
    if (/XAUUSD|XAGUSD|GOLD|SILVER/i.test(symbol)) return 'Metales';
    if (/USOIL|UKOIL|BRENT|WTI|NGAS/i.test(symbol)) return 'Energía';
    if (/US30|US500|NAS100|GER40|UK100|JP225|SPX|NDX/i.test(symbol)) return 'Índices';
    if (/WHEAT|CORN|SOYBEAN|COCOA|COFFEE|SUGAR|COTTON/i.test(symbol)) return 'Agrícola';
    return 'Forex';
  };
  const byCategory: Record<string, typeof closedTrades> = {};
  closedTrades.forEach(t => {
    const cat = categorize(t.symbol);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  });
  const categoryStats = Object.entries(byCategory).map(([name, trades]) => ({
    name,
    winRate: trades.length > 0 ? (trades.filter(t => t.isWin).length / trades.length) * 100 : 0,
    totalPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    count: trades.length,
  }));

  // Monthly heatmap
  const heatmapData: Record<number, Record<number, number>> = {};
  closedTrades.forEach(t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (!heatmapData[y]) heatmapData[y] = {};
    heatmapData[y][m] = (heatmapData[y][m] ?? 0) + t.netPnl;
  });
  const years = Object.keys(heatmapData).map(Number).sort();
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Drawdown chart
  const equityCurve = buildEquityCurve(closedTrades, startingBalance);
  const drawdownData = (() => {
    let peak = startingBalance;
    return equityCurve.map(p => {
      if (p.equity > peak) peak = p.equity;
      const dd = peak - p.equity;
      return { date: p.date, drawdown: -dd };
    });
  })();

  // Duration distribution
  const wins = closedTrades.filter(t => t.isWin);
  const losses = closedTrades.filter(t => !t.isWin);
  const durationBuckets = [
    { label: '<1h', min: 0, max: 1 },
    { label: '1-4h', min: 1, max: 4 },
    { label: '4-12h', min: 4, max: 12 },
    { label: '12-24h', min: 12, max: 24 },
    { label: '1-3d', min: 24, max: 72 },
    { label: '3-7d', min: 72, max: 168 },
    { label: '>7d', min: 168, max: Infinity },
  ];
  const durationDist = durationBuckets.map(b => ({
    label: b.label,
    wins: wins.filter(t => t.durationHours >= b.min && t.durationHours < b.max).length,
    losses: losses.filter(t => t.durationHours >= b.min && t.durationHours < b.max).length,
  }));

  if (closedTrades.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Estadísticas</h1>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No hay trades cerrados para analizar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Estadísticas</h1>

      {/* Core metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Esperanza" value={`€${kpis.expectancy.toFixed(2)}`} positive={kpis.expectancy >= 0} />
        <MetricCard label="Profit Factor" value={kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)} positive={kpis.profitFactor >= 1} />
        <MetricCard label="Recovery Factor" value={kpis.recoveryFactor === Infinity ? '∞' : kpis.recoveryFactor.toFixed(2)} positive={kpis.recoveryFactor >= 1} />
        <MetricCard label="Payoff Ratio" value={adv.payoffRatio === Infinity ? '∞' : adv.payoffRatio.toFixed(2)} positive={adv.payoffRatio >= 1} />
      </div>

      {/* MAE/MFE */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
        <h2 className="font-display text-sm font-semibold text-foreground mb-4" style={{ color: GOLD }}>Análisis MAE / MFE</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MiniStat label="MAE Winners" value={`${maeMfe.avgMaeWinners.toFixed(2)}%`} />
          <MiniStat label="MAE Losers" value={`${maeMfe.avgMaeLosers.toFixed(2)}%`} />
          <MiniStat label="MFE Winners" value={`${maeMfe.avgMfeWinners.toFixed(2)}%`} />
          <MiniStat label="MFE Losers" value={`${maeMfe.avgMfeLosers.toFixed(2)}%`} />
          <MiniStat label="MFE Capturado" value={`${maeMfe.avgMfeCapturedPct.toFixed(0)}%`} />
        </div>
      </div>

      {/* Win rate breakdowns */}
      <div className="grid lg:grid-cols-2 gap-6">
        <GroupChart title="Win Rate por Estado ADX" data={byAdx} />
        <GroupChart title="Win Rate por Dist. MA50" data={byMA50} />
        <GroupChart title="Win Rate por Momentum" data={byMomentum} />
        <BrokerComparison data={byBroker} />
      </div>

      {/* Category performance */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
        <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>Rendimiento por Categoría</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-xs text-muted-foreground">Categoría</th>
                <th className="text-right py-2 px-2 text-xs text-muted-foreground">Trades</th>
                <th className="text-right py-2 px-2 text-xs text-muted-foreground">Win Rate</th>
                <th className="text-right py-2 px-2 text-xs text-muted-foreground">P&L Total</th>
              </tr>
            </thead>
            <tbody>
              {categoryStats.map(c => (
                <tr key={c.name} className="border-b border-border/50">
                  <td className="py-2 px-2 font-semibold">{c.name}</td>
                  <td className="py-2 px-2 text-right font-data">{c.count}</td>
                  <td className={`py-2 px-2 text-right font-data font-semibold ${c.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>{c.winRate.toFixed(1)}%</td>
                  <td className={`py-2 px-2 text-right font-data font-semibold ${c.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(c.totalPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Heatmap */}
      {years.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>Heatmap P&L Mensual</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-data">
              <thead>
                <tr>
                  <th className="py-1 px-2 text-left text-muted-foreground">Año</th>
                  {monthNames.map(m => <th key={m} className="py-1 px-2 text-center text-muted-foreground">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {years.map(y => (
                  <tr key={y}>
                    <td className="py-1 px-2 font-semibold text-foreground">{y}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const val = heatmapData[y]?.[i];
                      if (val === undefined) return <td key={i} className="py-1 px-2 text-center text-muted-foreground/30">—</td>;
                      const bg = val >= 0 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive';
                      return <td key={i} className={`py-1 px-2 text-center font-semibold rounded ${bg}`}>{val >= 0 ? '+' : ''}{val.toFixed(0)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawdown chart */}
      {drawdownData.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>Drawdown</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownData}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={RED} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'Drawdown']} />
                <Area type="monotone" dataKey="drawdown" stroke={RED} fill="url(#ddGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Duration distribution */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
        <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>Distribución de Duración</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={durationDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="wins" name="Winners" fill={GREEN} radius={[3, 3, 0, 0]} />
              <Bar dataKey="losses" name="Losers" fill={RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-data font-bold ${positive === undefined ? 'text-foreground' : positive ? 'text-success' : 'text-destructive'}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-data font-bold text-foreground">{value}</div>
    </div>
  );
}

function GroupChart({ title, data }: { title: string; data: GroupStat[] }) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>{title}</h2>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={v => `${v}%`} domain={[0, 100]} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Win Rate']} />
            <Bar dataKey="winRate" radius={[0, 3, 3, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.winRate >= 50 ? GREEN : RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {data.map(d => (
          <span key={d.name}>{d.name}: <span className="font-data font-semibold text-foreground">{d.count} trades</span> • <span className={d.totalPnl >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(d.totalPnl)}</span></span>
        ))}
      </div>
    </div>
  );
}

function BrokerComparison({ data }: { data: BrokerStat[] }) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>Comparación por Broker</h2>
      <div className="space-y-3">
        {data.map(b => (
          <div key={b.name} className="flex items-center justify-between p-3 rounded-md bg-secondary border border-border">
            <div>
              <div className="text-sm font-semibold capitalize">{b.name}</div>
              <div className="text-xs text-muted-foreground">{b.count} trades</div>
            </div>
            <div className="flex gap-4 text-xs font-data">
              <div>WR: <span className={`font-semibold ${b.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>{b.winRate.toFixed(1)}%</span></div>
              <div>PF: <span className="font-semibold text-foreground">{b.profitFactor === Infinity ? '∞' : b.profitFactor.toFixed(2)}</span></div>
              <div>P&L: <span className={`font-semibold ${b.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(b.totalPnl)}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
