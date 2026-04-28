import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { Loader2, Info } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { filterByBroker, type Trade } from '@/lib/trade-utils';
import { computeRR, hasJournal } from '@/lib/trade-derived';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/statistics')({
  component: StatisticsPage,
  head: () => ({
    meta: [
      { title: 'Estadísticas — CAP Trading' },
      { name: 'description', content: 'Métricas avanzadas y análisis de rendimiento.' },
    ],
  }),
});

const GREEN = '#34d399';
const RED = '#f87171';
const GOLD = '#D4A017';
const YELLOW = '#facc15';

/* ─── helpers ─── */

function fmt(v: number, decimals = 2): string {
  return v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtCurrency(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}€${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeAllStats(trades: Trade[], startingBalance: number) {
  const winners = trades.filter(t => t.netPnl > 0);
  const losers = trades.filter(t => t.netPnl < 0);

  // Block 1
  const grossProfit = winners.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = losers.reduce((s, t) => s + Math.abs(t.netPnl), 0);
  const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.netPnl)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.netPnl)) : 0;

  // Active months & days
  const entryDates = trades.map(t => new Date(t.entryDate).getTime());
  const exitDates = trades.map(t => new Date(t.exitDate ?? t.entryDate).getTime());
  const minDate = entryDates.length > 0 ? Math.min(...entryDates) : Date.now();
  const maxDate = exitDates.length > 0 ? Math.max(...exitDates) : Date.now();
  const activeMonths = Math.max(1, Math.round((maxDate - minDate) / (30.44 * 24 * 3600 * 1000)));
  const activeDays = Math.max(1, Math.round((maxDate - minDate) / (24 * 3600 * 1000)));
  const netTotal = trades.reduce((s, t) => s + t.netPnl, 0);
  const avgPnlPerMonth = netTotal / activeMonths;

  // New consistency metrics
  const tradesPerDay = trades.length / activeDays;
  const winnersPerMonth = winners.length / activeMonths;
  const losersPerMonth = losers.length / activeMonths;

  // Block 2 — streaks
  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.netPnl > 0) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
    else { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
  }
  const tradesPerMonth = trades.length / activeMonths;

  // MAE > 50% SL — we don't have MAE field, skip or compute from available data
  // For now mark as N/A since there's no mae column
  const maeAbove50Pct: number | null = null;

  // Block 3 — Drawdown
  const equityCurve: number[] = [];
  let equity = startingBalance;
  for (const t of trades) {
    equity += t.netPnl;
    equityCurve.push(equity);
  }

  let maxDdAbs = 0, maxDdPct = 0;
  let peak = startingBalance;
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDdAbs) maxDdAbs = dd;
    if (ddPct > maxDdPct) maxDdPct = ddPct;
  }

  // Drawdown duration avg (in trades, convert to approx days)
  const ddPeriods: number[] = [];
  let inDd = false, ddStart = 0;
  peak = startingBalance;
  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) { peak = equityCurve[i]; if (inDd) { ddPeriods.push(i - ddStart); inDd = false; } }
    else if (!inDd && equityCurve[i] < peak) { inDd = true; ddStart = i; }
  }
  if (inDd) ddPeriods.push(equityCurve.length - ddStart);

  // Convert trade-based periods to days using avg duration
  const avgDurationDays = trades.length > 0
    ? trades.reduce((s, t) => s + t.durationHours, 0) / trades.length / 24
    : 1;
  const avgDdDurationDays = ddPeriods.length > 0
    ? (ddPeriods.reduce((s, v) => s + v, 0) / ddPeriods.length) * avgDurationDays
    : 0;

  // Outlier losses > 2x avg loss
  const outlierPct = losers.length > 0 && avgLoss > 0
    ? (losers.filter(t => Math.abs(t.netPnl) > 2 * avgLoss).length / trades.length) * 100
    : 0;

  // Heatmap
  const heatmap: Record<number, Record<number, number>> = {};
  trades.forEach(t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    const y = d.getFullYear(), m = d.getMonth();
    if (!heatmap[y]) heatmap[y] = {};
    heatmap[y][m] = (heatmap[y][m] ?? 0) + t.netPnl;
  });

  // Histogram
  const buckets = [
    { label: '<-2000', min: -Infinity, max: -2000 },
    { label: '-2000 a -1000', min: -2000, max: -1000 },
    { label: '-1000 a 0', min: -1000, max: 0 },
    { label: '0 a 1000', min: 0, max: 1000 },
    { label: '1000 a 2000', min: 1000, max: 2000 },
    { label: '>2000', min: 2000, max: Infinity },
  ];
  const histogramData = buckets.map(b => ({
    label: b.label,
    count: trades.filter(t => t.netPnl >= b.min && t.netPnl < b.max).length,
    negative: b.max <= 0,
  }));

  // Return % and reliability factor
  const returnPct = startingBalance > 0 ? (netTotal / startingBalance) * 100 : 0;
  const reliabilityFactor = netTotal > 0 ? netTotal / (netTotal + maxDdAbs) : 0;

  // Summary block
  const totalTrades = trades.length;
  const winnersCount = winners.length;
  const losersCount = losers.length;
  const winPct = totalTrades > 0 ? (winnersCount / totalTrades) * 100 : 0;
  const lossPct = totalTrades > 0 ? (losersCount / totalTrades) * 100 : 0;

  return {
    grossProfit, grossLoss, payoffRatio, avgWin, avgLoss, bestTrade, worstTrade, avgPnlPerMonth,
    maxWinStreak, maxLossStreak, tradesPerMonth, maeAbove50Pct,
    tradesPerDay, winnersPerMonth, losersPerMonth,
    maxDdAbs, maxDdPct, avgDdDurationDays, outlierPct,
    returnPct, reliabilityFactor,
    heatmap, histogramData, activeMonths, netTotal,
    totalTrades, winnersCount, losersCount, winPct, lossPct,
  };
}

/* ─── Page ─── */

function StatisticsPage() {
  const { closedTrades: allClosed, isLoading } = useAllTrades();
  const { data: settings } = useSettings();
  const { broker } = useBrokerFilter();

  const closedTrades = useMemo(() => filterByBroker(allClosed, broker), [allClosed, broker]);
  const startingBalance = broker === 'octx' ? 30 : 1000000;
  const stats = useMemo(() => computeAllStats(closedTrades, startingBalance), [closedTrades, startingBalance]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Estadísticas</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    );
  }

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

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const years = Object.keys(stats.heatmap).map(Number).sort();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Estadísticas</h1>

        {/* BLOQUE 0 — Resumen General */}
        <Section title="Resumen General">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Operaciones" value={`${stats.totalTrades}`} color="muted" tip="Número total de trades cerrados." />
            <StatCard label="Operaciones Ganadoras" value={`${stats.winnersCount}`} color="success" tip="Trades cerrados con beneficio positivo." />
            <StatCard label="Operaciones Perdedoras" value={`${stats.losersCount}`} color="destructive" tip="Trades cerrados con beneficio negativo." />
            <StatCard label="Beneficio Neto" value={fmtCurrency(stats.netTotal)} color={stats.netTotal >= 0 ? 'success' : 'destructive'} tip="Suma del P&L de todos los trades cerrados." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <StatCard label="Probabilidad Ganancia" value={`${fmt(stats.winPct)}%`} color={stats.winPct >= 50 ? 'success' : 'destructive'} tip="Porcentaje de trades cerrados que fueron ganadores." />
            <StatCard label="Probabilidad Pérdida" value={`${fmt(stats.lossPct)}%`} color={stats.lossPct > 50 ? 'destructive' : 'success'} tip="Porcentaje de trades cerrados que fueron perdedores." />
            <StatCard label="Retorno %" value={`${stats.returnPct >= 0 ? '+' : ''}${fmt(stats.returnPct)}%`} color={stats.returnPct >= 0 ? 'success' : 'destructive'} tip={`(Beneficio Neto / Capital Inicial) × 100. Capital: €${startingBalance.toLocaleString('es-ES')}.`} />
            <StatCard label="Factor de Fiabilidad" value={fmt(stats.reliabilityFactor)} color={stats.reliabilityFactor > 0.5 ? 'success' : stats.reliabilityFactor >= 0.2 ? 'warning' : 'destructive'} tip="Proporción del beneficio no consumida por el drawdown. Cercano a 1 = sistema robusto." />
          </div>
        </Section>

        {/* BLOQUE 1 — Rendimiento por Trade */}
        <Section title="Rendimiento por Trade">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Beneficio Bruto" value={fmtCurrency(stats.grossProfit)} color="success" tip="Suma de todos los trades ganadores." />
            <StatCard label="Pérdida Bruta" value={`€${fmt(stats.grossLoss)}`} color="destructive" tip="Suma del valor absoluto de todos los trades perdedores." />
            <StatCard label="Ratio B/P (Payoff)" value={stats.payoffRatio === Infinity ? '∞' : fmt(stats.payoffRatio)} color={stats.payoffRatio >= 1 ? 'success' : 'destructive'} tip="Beneficio medio ganador / Pérdida media perdedora. >1 es favorable." />
            <StatCard label="Beneficio Medio" value={fmtCurrency(stats.avgWin)} color="success" tip="Promedio de P&L en trades ganadores." />
            <StatCard label="Pérdida Media" value={`€${fmt(stats.avgLoss)}`} color="destructive" tip="Promedio del valor absoluto de P&L en trades perdedores." />
            <StatCard label="Mayor Ganador" value={fmtCurrency(stats.bestTrade)} color="success" tip="El trade con mayor beneficio." />
            <StatCard label="Mayor Perdedor" value={`€${fmt(Math.abs(stats.worstTrade))}`} color="destructive" tip="El trade con mayor pérdida (valor absoluto)." />
            <StatCard label="Beneficio/Mes" value={fmtCurrency(stats.avgPnlPerMonth)} color={stats.avgPnlPerMonth >= 0 ? 'success' : 'destructive'} tip={`P&L neto total dividido entre ${stats.activeMonths} meses activos.`} />
          </div>
        </Section>

        {/* BLOQUE 2 — Consistencia */}
        <Section title="Consistencia">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Racha Ganadora Máx." value={`${stats.maxWinStreak}`} sub="trades consecutivos ganadores" color="success" tip="Mayor número de trades ganadores consecutivos." />
            <StatCard label="Racha Perdedora Máx." value={`${stats.maxLossStreak}`} sub="trades consecutivos perdedores" color={stats.maxLossStreak > 5 ? 'destructive' : 'muted'} tip="Mayor número de trades perdedores consecutivos. Preocupante si >5." />
            <StatCard label="Operaciones/Mes" value={fmt(stats.tradesPerMonth, 1)} color="muted" tip="Promedio de trades cerrados por mes activo." />
            <StatCard
              label="% Trades MAE > 50% SL"
              value={stats.maeAbove50Pct !== null ? `${fmt(stats.maeAbove50Pct, 1)}%` : 'N/A'}
              color={stats.maeAbove50Pct === null ? 'muted' : stats.maeAbove50Pct > 60 ? 'destructive' : stats.maeAbove50Pct > 40 ? 'warning' : 'muted'}
              tip="Porcentaje de trades donde la excursión adversa máxima superó el 50% del stop loss. Requiere campo MAE."
            />
            <StatCard label="Operaciones/Día" value={`${fmt(stats.tradesPerDay)} trades/día`} color="muted" tip="Número total de trades cerrados dividido entre el número de días entre el primer y último trade." />
            <StatCard label="Ganadoras/Mes" value={fmt(stats.winnersPerMonth, 1)} color="success" tip="Número de trades ganadores dividido entre los meses activos." />
            <StatCard label="Perdedoras/Mes" value={fmt(stats.losersPerMonth, 1)} color="destructive" tip="Número de trades perdedores dividido entre los meses activos." />
          </div>
        </Section>

        {/* BLOQUE 3 — Riesgo y Drawdown */}
        <Section title="Riesgo y Drawdown">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Drawdown Máx. (€)" value={`€${fmt(stats.maxDdAbs)}`} color="destructive" tip="Mayor caída desde un pico de equity hasta un valle posterior." />
            <StatCard label="Drawdown Máx. (%)" value={`${fmt(stats.maxDdPct, 1)}%`} color="destructive" tip="Mayor caída porcentual desde un pico de equity." />
            <StatCard label="Duración Media DD" value={`${fmt(stats.avgDdDurationDays, 1)} días`} color="muted" tip="Duración promedio de los períodos de drawdown en días." />
            <StatCard
              label="Pérdidas > 2x Media"
              value={`${fmt(stats.outlierPct, 1)}%`}
              color={stats.outlierPct > 10 ? 'destructive' : 'muted'}
              tip="% de trades con pérdida superior al doble de la pérdida media. Detecta outliers destructivos."
            />
            <StatCard
              label="Retorno %"
              value={`${stats.returnPct >= 0 ? '+' : ''}${fmt(stats.returnPct)}%`}
              color={stats.returnPct >= 0 ? 'success' : 'destructive'}
              tip={`(Beneficio Neto / Capital Inicial) × 100. Capital usado: €${startingBalance.toLocaleString('es-ES')}.`}
            />
            <StatCard
              label="Factor de Fiabilidad"
              value={fmt(stats.reliabilityFactor)}
              color={stats.reliabilityFactor > 0.5 ? 'success' : stats.reliabilityFactor >= 0.2 ? 'warning' : 'destructive'}
              tip="Mide qué parte del beneficio generado no fue consumida por el drawdown. Cercano a 1 = excelente."
            />
          </div>
        </Section>

        {/* Heatmap P&L Mensual */}
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
                        const val = stats.heatmap[y]?.[i];
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

        {/* Histogram */}
        <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
          <h2 className="font-display text-sm font-semibold mb-4" style={{ color: GOLD }}>Distribución de Resultados</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.histogramData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} />
                <ReTooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v} trades`, 'Cantidad']} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {stats.histogramData.map((entry, i) => (
                    <Cell key={i} fill={entry.negative ? RED : GREEN} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ─── Sub-components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-sm font-semibold mb-3" style={{ color: GOLD }}>{title}</h2>
      {children}
    </div>
  );
}

type CardColor = 'success' | 'destructive' | 'muted' | 'warning';

const colorMap: Record<CardColor, string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  muted: 'text-foreground',
  warning: 'text-yellow-400',
};

function StatCard({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color: CardColor; tip: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs">{tip}</TooltipContent>
        </Tooltip>
      </div>
      <div className={`text-xl font-data font-bold ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
