import { createFileRoute } from '@tanstack/react-router';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Zap, AlertTriangle, Loader2, Shield, Gauge, TrendingUp, BarChart3 } from 'lucide-react';
import { useClosedTrades } from '@/hooks/use-trades';
import { formatCurrency, type Trade } from '@/lib/trade-utils';
import {
  getPerformanceByAdxState, getPerformanceByMA50, getPerformanceByMomentum,
  getInterventionCosts, getEmotionalPerformanceMatrix, getMonthlyConsistencyScore,
  computeMaeMfe, computeRrData, generateEnhancedInsights,
  type GroupStat, type HeatmapCell,
} from '@/lib/analytics';
import { useSettings } from '@/hooks/use-settings';

export const Route = createFileRoute('/patterns')({
  component: Patterns,
  head: () => ({
    meta: [
      { title: 'Inteligencia de Patrones — CAP Trading' },
      { name: 'description', content: 'Análisis de patrones de comportamiento y rendimiento.' },
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
  const { data: settings } = useSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando patrones...</span>
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

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Inteligencia de Patrones</h1>
          <p className="text-sm text-muted-foreground mt-1">Datos insuficientes aún</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm">Los patrones aparecerán cuando tengas trades cerrados en el sistema.</p>
        </div>
      </div>
    );
  }

  const startingBalance = Number(settings?.balance ?? 10000);
  const insights = generateEnhancedInsights(trades, startingBalance);

  const byCompliance = groupBy(trades.filter(t => t.systemCompliance), t => t.systemCompliance!);
  const complianceData = Object.entries(byCompliance).map(([key, g]) => ({
    name: key,
    avgPnl: g.reduce((s, t) => s + t.netPnl, 0) / g.length,
    winRate: (g.filter(t => t.isWin).length / g.length) * 100,
    count: g.length,
  }));

  const byEmotion = groupBy(trades.filter(t => t.emotionalState), t => t.emotionalState!);
  const emotionData = Object.entries(byEmotion).map(([key, g]) => ({
    name: key,
    avgPnl: g.reduce((s, t) => s + t.netPnl, 0) / g.length,
    totalPnl: g.reduce((s, t) => s + t.netPnl, 0),
    winRate: (g.filter(t => t.isWin).length / g.length) * 100,
    count: g.length,
  }));

  const bySymbol = groupBy(trades, t => t.symbol);
  const instrumentData = Object.entries(bySymbol).map(([symbol, g]) => ({
    symbol,
    totalPnl: g.reduce((s, t) => s + t.netPnl, 0),
    winRate: (g.filter(t => t.isWin).length / g.length) * 100,
    count: g.length,
    avgPnl: g.reduce((s, t) => s + t.netPnl, 0) / g.length,
  })).sort((a, b) => b.totalPnl - a.totalPnl);

  const adxStateData = getPerformanceByAdxState(trades);
  const ma50Data = getPerformanceByMA50(trades);
  const momentumData = getPerformanceByMomentum(trades);
  const interventions = getInterventionCosts(trades);
  const emotionalMatrix = getEmotionalPerformanceMatrix(trades);
  const consistency = getMonthlyConsistencyScore(trades);
  const maeMfe = computeMaeMfe(trades);
  const rrData = computeRrData(trades);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Inteligencia de Patrones</h1>
        <p className="text-sm text-muted-foreground mt-1">Patrones de comportamiento y rendimiento de {trades.length} trades</p>
      </div>

      {insights.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 lg:p-6 gold-glow">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-primary">Insights Automáticos</h2>
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

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title="Consistencia Mensual">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <div className={`text-3xl font-data font-bold ${consistency.score >= 80 ? 'text-success' : consistency.score >= 50 ? 'text-primary' : 'text-destructive'}`}>
                {consistency.score.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">{consistency.compliantMonths}/{consistency.totalMonths} meses al 100% de cumplimiento</div>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Análisis MAE (Colocación SL)">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">MAE Medio Ganadores</span>
              <span className="font-data text-sm text-success">{maeMfe.avgMaeWinners.toFixed(3)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">MAE Medio Perdedores</span>
              <span className="font-data text-sm text-destructive">{maeMfe.avgMaeLosers.toFixed(3)}%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {maeMfe.avgMaeLosers <= maeMfe.avgMaeWinners * 1.3
                ? '✅ El SL parece bien colocado'
                : '⚠️ El SL puede ser demasiado amplio en perdedores'}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Análisis MFE (Beneficio Capturado)">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">MFE Medio Ganadores</span>
              <span className="font-data text-sm text-success">{maeMfe.avgMfeWinners.toFixed(3)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">MFE Capturado</span>
              <span className={`font-data text-sm font-semibold ${maeMfe.avgMfeCapturedPct >= 70 ? 'text-success' : 'text-primary'}`}>
                {maeMfe.avgMfeCapturedPct.toFixed(0)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {maeMfe.avgMfeCapturedPct >= 80
                ? '✅ Buena captura de beneficio'
                : `⚠️ Dejando ${(100 - maeMfe.avgMfeCapturedPct).toFixed(0)}% sobre la mesa`}
            </div>
          </div>
        </ChartCard>
      </div>

      {rrData.length > 0 && (
        <ChartCard title="RR Real vs Teórico">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                <XAxis type="number" dataKey="theoreticalRR" name="RR Teórico" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} label={{ value: 'RR Teórico', position: 'bottom', offset: -5, style: { fontSize: 10, fill: '#475569' } }} />
                <YAxis type="number" dataKey="actualRR" name="RR Real" tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} label={{ value: 'RR Real', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#475569' } }} />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => [value.toFixed(2), name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.symbol ?? ''}
                />
                <Scatter data={rrData.filter(r => r.isWin)} fill="#34d399" name="Ganadores" />
                <Scatter data={rrData.filter(r => !r.isWin)} fill="#f87171" name="Perdedores" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span><span className="inline-block w-2 h-2 rounded-full bg-success mr-1" />Ganadores</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-destructive mr-1" />Perdedores</span>
            <span className="ml-auto">Puntos sobre la diagonal = capturó más de lo esperado</span>
          </div>
        </ChartCard>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {adxStateData.length > 0 && (
          <ChartCard title="Rendimiento por Estado ADX">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adxStateData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Win Rate']} />
                  <Bar dataKey="winRate" radius={[3, 3, 0, 0]} fill="#c8a951" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <StatSummary data={adxStateData} />
          </ChartCard>
        )}

        {ma50Data.length > 0 && (
          <ChartCard title="Rendimiento por Distancia MA50">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ma50Data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Win Rate']} />
                  <Bar dataKey="winRate" radius={[3, 3, 0, 0]} fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <StatSummary data={ma50Data} />
          </ChartCard>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {momentumData.length > 0 && (
          <ChartCard title="Rendimiento por Alineación de Momentum">
            <div className="grid grid-cols-2 gap-4">
              {momentumData.map(d => (
                <div key={d.name} className="p-4 rounded-md bg-secondary border border-border text-center">
                  <div className="text-xs text-muted-foreground mb-1">{d.name === 'Aligned' ? 'Alineado' : 'No Alineado'}</div>
                  <div className={`text-2xl font-data font-bold ${d.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>
                    {d.winRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{d.count} trades</div>
                  <div className={`text-sm font-data font-semibold mt-1 ${d.avgPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    Media {formatCurrency(d.avgPnl)}
                  </div>
                  <div className={`text-xs font-data ${d.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    Total: €{d.totalPnl.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        <ChartCard title="Coste de Intervenciones Manuales">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${interventions.total < 0 ? 'text-destructive' : 'text-success'}`} />
              <div>
                <div className={`text-2xl font-data font-bold ${interventions.total < 0 ? 'text-destructive' : 'text-success'}`}>
                  €{interventions.total.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Total de {interventions.totalCount} intervenciones</div>
              </div>
            </div>
            <div className="space-y-2">
              {interventions.byType.map(it => (
                <div key={it.type} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                  <span className="text-muted-foreground">{it.type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{it.count} trades</span>
                    <span className={`font-data font-semibold ${it.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      €{it.totalPnl.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
              {interventions.byType.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">Sin intervenciones registradas</div>
              )}
            </div>
          </div>
        </ChartCard>
      </div>

      {emotionalMatrix.length > 0 && (
        <ChartCard title="Matriz Emocional × Cumplimiento (P&L Medio)">
          <div className="overflow-x-auto">
            {(() => {
              const emotions = [...new Set(emotionalMatrix.map(c => c.emotion))];
              const compliances = [...new Set(emotionalMatrix.map(c => c.compliance))];
              const lookup = (e: string, c: string) => emotionalMatrix.find(cell => cell.emotion === e && cell.compliance === c);
              return (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Emoción \ Cumplimiento</th>
                      {compliances.map(c => (
                        <th key={c} className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emotions.map(e => (
                      <tr key={e} className="border-b border-border/50">
                        <td className="py-2.5 px-3 font-medium text-sm">{e}</td>
                        {compliances.map(c => {
                          const cell = lookup(e, c);
                          if (!cell) return <td key={c} className="py-2.5 px-3 text-center text-xs text-muted-foreground">—</td>;
                          const intensity = Math.min(Math.abs(cell.avgPnl) / 50, 1);
                          const bg = cell.avgPnl >= 0
                            ? `rgba(52, 211, 153, ${intensity * 0.3})`
                            : `rgba(248, 113, 113, ${intensity * 0.3})`;
                          return (
                            <td key={c} className="py-2.5 px-3 text-center" style={{ backgroundColor: bg }}>
                              <div className={`font-data font-semibold text-sm ${cell.avgPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                                €{cell.avgPnl.toFixed(0)}
                              </div>
                              <div className="text-xs text-muted-foreground">{cell.count} trades</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </ChartCard>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Rendimiento por Cumplimiento del Sistema">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complianceData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'P&L Medio']} />
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

        <ChartCard title="Análisis por Estado Emocional">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emotionData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#475569', fontFamily: 'Inconsolata' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'P&L Medio']} />
                <Bar dataKey="avgPnl" radius={[3, 3, 0, 0]}>
                  {emotionData.map((d, i) => (
                    <Cell key={i} fill={d.avgPnl >= 0 ? '#34d399' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Rendimiento por Instrumento">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Símbolo</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">P&L Total</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Win Rate</th>
                <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">P&L Medio</th>
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
      </ChartCard>
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

function StatSummary({ data }: { data: GroupStat[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {data.map(d => (
        <div key={d.name} className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{d.name}</span>: {d.winRate.toFixed(0)}% WR • Media {formatCurrency(d.avgPnl)} • €{d.totalPnl.toFixed(0)} total ({d.count})
        </div>
      ))}
    </div>
  );
}
