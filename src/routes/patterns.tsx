import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  ScatterChart, Scatter, ZAxis, LineChart, Line, PieChart, Pie, ReferenceLine, Legend,
} from 'recharts';
import { Loader2, Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useClosedTrades } from '@/hooks/use-trades';
import { filterByBroker, isFullCompliance, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { AnchorNav } from '@/components/radar/AnchorNav';

const BROKER_LABELS: Record<BrokerFilter, string> = {
  all: 'Todos los brokers',
  darwinex: 'NK',
  octx: 'OX',
};

const PATTERN_ANCHORS = [
  { id: 'cuando-funciona', label: '¿Cuándo funciona?' },
  { id: 'respeto-sistema', label: 'Respeto del sistema' },
  { id: 'errores', label: 'Errores' },
  { id: 'gestion-trade', label: 'Gestión' },
  { id: 'consistencia', label: 'Consistencia' },
];

export const Route = createFileRoute('/patterns')({
  component: Patterns,
  head: () => ({
    meta: [
      { title: 'Inteligencia de Patrones — CAP Trading' },
      { name: 'description', content: 'Descubre cuándo y cómo funciona realmente tu sistema.' },
    ],
  }),
});

const NO_INTERVENTION_VALUES = new Set([
  'EA gestionando solo',
  'None, EA managing',
  'Sin intervención',
  'No EA gestionando solo',
]);

const MIN_GROUP = 5;

/* ────────── helpers ────────── */

function pct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}
function avg(nums: number[]) {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}
function eur(n: number) {
  const sign = n >= 0 ? '+' : '−';
  return `${sign}€${Math.abs(n).toFixed(0)}`;
}
function wrColor(wr: number) {
  return wr >= 50 ? 'text-success' : 'text-destructive';
}
function wrBar(wr: number) {
  return wr >= 50 ? 'bg-success' : 'bg-destructive';
}
function trafficLight(wr: number) {
  if (wr < 35) return { icon: '🔴', color: 'text-destructive' };
  if (wr <= 50) return { icon: '🟡', color: 'text-primary' };
  return { icon: '🟢', color: 'text-success' };
}

interface GroupRow {
  key: string;
  count: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
}

function buildGroup(trades: Trade[], keyFn: (t: Trade) => string | null): GroupRow[] {
  const buckets: Record<string, Trade[]> = {};
  for (const t of trades) {
    const k = keyFn(t);
    if (!k) continue;
    (buckets[k] ??= []).push(t);
  }
  return Object.entries(buckets).map(([key, arr]) => ({
    key,
    count: arr.length,
    winRate: pct(arr.filter(t => t.isWin).length, arr.length),
    totalPnl: arr.reduce((s, t) => s + t.netPnl, 0),
    avgPnl: avg(arr.map(t => t.netPnl)),
  }));
}

function isIntervened(t: Trade): boolean {
  const v = t.manualIntervention?.trim();
  if (!v) return false; // null = sin bitácora → fuera del cálculo (manejado aparte)
  return !NO_INTERVENTION_VALUES.has(v);
}

/* ────────── page ────────── */

function Patterns() {
  const { data: allClosed, isLoading, error } = useClosedTrades();
  const { broker } = useBrokerFilter();

  const trades = useMemo(
    () => filterByBroker(allClosed ?? [], broker),
    [allClosed, broker],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header count={0} broker={broker} loading />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header count={0} broker={broker} />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Error al cargar datos: {error.message}</p>
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <Header count={0} broker={broker} />
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Los patrones aparecerán cuando tengas trades cerrados en el sistema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <Header count={trades.length} broker={broker} />
      <AnchorNav items={PATTERN_ANCHORS} />
      <section id="cuando-funciona" className="scroll-mt-24">
        <Block1WhenItWorks trades={trades} />
      </section>
      <section id="respeto-sistema" className="scroll-mt-24">
        <Block2RespectingSystem trades={trades} />
      </section>
      <section id="errores" className="scroll-mt-24">
        <Block3WhenYouEnterBad trades={trades} />
      </section>
      <section id="gestion-trade" className="scroll-mt-24">
        <Block4TradeManagement trades={trades} />
      </section>
      <section id="consistencia" className="scroll-mt-24">
        <Block5Consistency trades={trades} />
      </section>
    </div>
  );
}

function Header({ count, broker, loading }: { count: number; broker: BrokerFilter; loading?: boolean }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Inteligencia de Patrones</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Descubre cuándo y cómo funciona realmente tu sistema
      </p>
      <p className="text-xs text-muted-foreground/80 mt-2 font-data">
        {loading ? 'Cargando…' : `Analizando ${count} trade${count === 1 ? '' : 's'} de ${BROKER_LABELS[broker]}`}
      </p>
    </div>
  );
}

/* ────────── shared UI ────────── */

function BlockHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-primary/20 pb-3">
      <h2 className="font-display text-lg lg:text-xl font-bold text-primary">{title}</h2>
      <p className="text-xs lg:text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
      <h3 className="font-display text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div>{children}</div>
      {footer && <div className="mt-3 pt-3 border-t border-border/60">{footer}</div>}
    </div>
  );
}

function Insight({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs lg:text-sm italic text-muted-foreground">
      <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

function NotEnough({ note }: { note?: string }) {
  return (
    <div className="text-xs text-muted-foreground/70 italic py-6 text-center">
      {note ?? 'Necesitas más trades para este análisis (mínimo 5)'}
    </div>
  );
}

function GroupBars({ rows }: { rows: GroupRow[] }) {
  const sorted = [...rows].sort((a, b) => b.winRate - a.winRate);
  return (
    <div className="space-y-2.5">
      {sorted.map(r => (
        <div key={r.key}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-foreground">{r.key}</span>
            <span className={`font-data font-semibold ${wrColor(r.winRate)}`}>
              {r.winRate.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full ${wrBar(r.winRate)} transition-all`}
              style={{ width: `${Math.min(100, Math.max(2, r.winRate))}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-data">
            <span>{r.count} trades</span>
            <span className={r.totalPnl >= 0 ? 'text-success' : 'text-destructive'}>
              {eur(r.totalPnl)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────── BLOQUE 1 ────────── */

function Block1WhenItWorks({ trades }: { trades: Trade[] }) {
  const adxRows = useMemo(() => buildGroup(trades, t => t.adxState || null), [trades]);
  const ma50Rows = useMemo(() => buildGroup(trades, t => t.distanceToMA50Label || null), [trades]);

  const rankRows = useMemo(() => buildGroup(trades, t => {
    if (t.scannerRank == null) return 'Fuera del radar';
    if (t.scannerRank <= 3) return 'Top 3 del radar';
    if (t.scannerRank <= 7) return 'Top 4-7';
    return 'Resto del radar';
  }), [trades]);

  const vixRows = useMemo(() => buildGroup(trades, t => {
    const v = t.vixAtEntry;
    if (v == null) return 'Sin dato';
    if (v < 15) return 'VIX Bajo (<15)';
    if (v <= 25) return 'VIX Medio (15-25)';
    return 'VIX Alto (>25)';
  }), [trades]);

  const bestAdx = [...adxRows].sort((a, b) => b.winRate - a.winRate)[0];
  const bestMa50 = [...ma50Rows].sort((a, b) => b.winRate - a.winRate)[0];
  const top3 = rankRows.find(r => r.key === 'Top 3 del radar');
  const restRanks = rankRows.filter(r => r.key !== 'Top 3 del radar');
  const restAvg = restRanks.length ? avg(restRanks.map(r => r.winRate)) : 0;
  const bestVix = [...vixRows].filter(r => r.key !== 'Sin dato').sort((a, b) => b.winRate - a.winRate)[0];

  return (
    <section className="space-y-4">
      <BlockHeader
        title="¿Cuándo funciona el sistema?"
        subtitle="Condiciones de mercado donde tu edge es real"
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Win Rate por Estado ADX">
          {adxRows.length > 0 ? <GroupBars rows={adxRows} /> : <NotEnough />}
          {bestAdx && (
            <div className="mt-4">
              <Insight text={`Tu mejor condición de entrada es ${bestAdx.key} con ${bestAdx.winRate.toFixed(0)}% de win rate en ${bestAdx.count} trades.`} />
            </div>
          )}
        </Card>

        <Card title="Win Rate por Distancia MA50">
          {ma50Rows.length > 0 ? <GroupBars rows={ma50Rows} /> : <NotEnough />}
          {bestMa50 && (
            <div className="mt-4">
              <Insight text={`Entrar cuando el precio está ${bestMa50.key} tiene un win rate de ${bestMa50.winRate.toFixed(0)}%.`} />
            </div>
          )}
        </Card>

        <Card title="Win Rate por Ranking Scanner">
          {rankRows.length > 0 ? <GroupBars rows={rankRows} /> : <NotEnough />}
          {top3 && restAvg > 0 && (
            <div className="mt-4">
              <Insight text={`Los trades del Top 3 tienen un ${(top3.winRate - restAvg).toFixed(0)} pts ${top3.winRate >= restAvg ? 'más' : 'menos'} de win rate que el resto (${top3.winRate.toFixed(0)}% vs ${restAvg.toFixed(0)}%).`} />
            </div>
          )}
        </Card>

        <Card title="Win Rate por VIX">
          {vixRows.length > 0 ? <GroupBars rows={vixRows} /> : <NotEnough />}
          {bestVix && (
            <div className="mt-4">
              <Insight text={`Tu mejor entorno es ${bestVix.key} con ${bestVix.winRate.toFixed(0)}% de win rate en ${bestVix.count} trades.`} />
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

/* ────────── BLOQUE 2 ────────── */

function Block2RespectingSystem({ trades }: { trades: Trade[] }) {
  // Solo trades con bitácora rellena para intervención
  const withInterventionLog = useMemo(
    () => trades.filter(t => t.manualIntervention != null && t.manualIntervention.trim() !== ''),
    [trades],
  );
  const intervened = withInterventionLog.filter(isIntervened);
  const notIntervened = withInterventionLog.filter(t => !isIntervened(t));

  const interventionRate = pct(intervened.length, withInterventionLog.length);
  const interventionRateColor =
    interventionRate > 40 ? 'text-destructive' : interventionRate > 20 ? 'text-primary' : 'text-success';

  const avgIntervened = avg(intervened.map(t => t.netPnl));
  const avgNotIntervened = avg(notIntervened.map(t => t.netPnl));
  const interventionDelta = avgIntervened - avgNotIntervened;
  const totalInterventionCost = intervened.reduce((s, t) => s + t.netPnl, 0);

  // Respeto del sistema (systemCompliance maps to "Sí completamente" / "No al 100%" / "No")
  const respectMap: Record<string, string> = {
    '100%': 'Sí completamente',
    'Sí completamente': 'Sí completamente',
    '75%': 'No al 100%',
    '50%': 'No al 100%',
    'No al 100%': 'No al 100%',
    '25%': 'No',
    '0%': 'No',
    'No': 'No',
  };
  const withRespect = trades.filter(t => t.systemCompliance && respectMap[t.systemCompliance]);
  const respectGroups: Record<string, number> = { 'Sí completamente': 0, 'No al 100%': 0, 'No': 0 };
  for (const t of withRespect) {
    respectGroups[respectMap[t.systemCompliance!]] = (respectGroups[respectMap[t.systemCompliance!]] ?? 0) + 1;
  }
  const respectData = Object.entries(respectGroups).map(([name, value]) => ({ name, value }));
  const respectColors: Record<string, string> = {
    'Sí completamente': '#34d399',
    'No al 100%': '#facc15',
    'No': '#f87171',
  };

  // Impacto emocional
  const withEmotion = trades.filter(t => t.emotionalState && t.emotionalState.trim() !== '');
  const tranquilo = withEmotion.filter(t => /tranquil/i.test(t.emotionalState!));
  const otros = withEmotion.filter(t => !/tranquil/i.test(t.emotionalState!));
  const wrTranquilo = pct(tranquilo.filter(t => t.isWin).length, tranquilo.length);
  const wrOtros = pct(otros.filter(t => t.isWin).length, otros.length);

  return (
    <section className="space-y-4">
      <BlockHeader
        title="¿Estás respetando el sistema?"
        subtitle="El mayor enemigo eres tú mismo — Pablo Gil"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Tasa de Intervención">
          {withInterventionLog.length >= MIN_GROUP ? (
            <>
              <div className={`text-3xl font-data font-bold ${interventionRateColor}`}>
                {interventionRate.toFixed(0)}%
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {intervened.length} de {withInterventionLog.length} trades
              </div>
              <div className="text-[10px] text-muted-foreground mt-2">
                Basado en {withInterventionLog.length} trades con bitácora rellenada
              </div>
            </>
          ) : (
            <NotEnough note="Necesitas más trades con bitácora" />
          )}
        </Card>

        <Card title="Coste de Intervenciones">
          {intervened.length >= 2 && notIntervened.length >= 2 ? (
            <>
              <div className={`text-2xl font-data font-bold ${interventionDelta < 0 ? 'text-destructive' : 'text-success'}`}>
                {eur(interventionDelta)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                <div>Intervención: <span className="font-data">{eur(avgIntervened)}</span> medio</div>
                <div>Sin intervención: <span className="font-data">{eur(avgNotIntervened)}</span> medio</div>
              </div>
            </>
          ) : (
            <NotEnough note="Necesitas más trades comparables" />
          )}
        </Card>

        <Card title="Respeto del Sistema">
          {withRespect.length >= MIN_GROUP ? (
            <div className="flex items-center gap-2">
              <div className="w-20 h-20 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={respectData} dataKey="value" innerRadius={20} outerRadius={36} paddingAngle={2}>
                      {respectData.map(d => (
                        <Cell key={d.name} fill={respectColors[d.name]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[10px] space-y-1">
                {respectData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: respectColors[d.name] }} />
                    <span className="text-muted-foreground">{d.name}: <span className="font-data text-foreground">{pct(d.value, withRespect.length).toFixed(0)}%</span></span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <NotEnough note="Necesitas más trades con bitácora" />
          )}
        </Card>

        <Card title="Impacto Emocional">
          {tranquilo.length >= 2 && otros.length >= 2 ? (
            <div className="space-y-2">
              <div>
                <div className="text-[11px] text-muted-foreground">Tranquilo</div>
                <div className={`text-xl font-data font-bold ${wrColor(wrTranquilo)}`}>
                  {wrTranquilo.toFixed(0)}%
                </div>
                <div className="text-[10px] text-muted-foreground">{tranquilo.length} trades</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Otros estados</div>
                <div className={`text-xl font-data font-bold ${wrColor(wrOtros)}`}>
                  {wrOtros.toFixed(0)}%
                </div>
                <div className="text-[10px] text-muted-foreground">{otros.length} trades</div>
              </div>
            </div>
          ) : (
            <NotEnough note="Necesitas más bitácoras" />
          )}
        </Card>
      </div>

      {intervened.length >= 2 && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 ${
          totalInterventionCost < 0
            ? 'border-destructive/40 bg-destructive/10'
            : 'border-success/40 bg-success/10'
        }`}>
          {totalInterventionCost < 0
            ? <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            : <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />}
          <p className="text-sm">
            {totalInterventionCost < 0
              ? <>Tus intervenciones te han costado <span className="font-data font-bold text-destructive">{eur(totalInterventionCost)}</span> — el sistema funciona mejor sin ti.</>
              : <>Intervenir te ha aportado <span className="font-data font-bold text-success">{eur(totalInterventionCost)}</span> en estos {intervened.length} trades.</>
            }
          </p>
        </div>
      )}
    </section>
  );
}

/* ────────── BLOQUE 3 ────────── */

interface BadEntryRow {
  label: string;
  count: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  basedOnLog?: boolean;
  logged?: number;
}

function Block3WhenYouEnterBad({ trades }: { trades: Trade[] }) {
  const make = (filterFn: (t: Trade) => boolean, label: string, basedOnLog = false): BadEntryRow => {
    const filtered = trades.filter(filterFn);
    const wins = filtered.filter(t => t.isWin).length;
    return {
      label,
      count: filtered.length,
      winRate: pct(wins, filtered.length),
      avgPnl: avg(filtered.map(t => t.netPnl)),
      totalPnl: filtered.reduce((s, t) => s + t.netPnl, 0),
      basedOnLog,
    };
  };

  const rows: BadEntryRow[] = [
    make(t => t.adxState === 'AGOTANDO', 'ADX = AGOTANDO al entrar'),
    make(t => t.momentum20d < 0, 'Momentum 20d negativo al entrar'),
    make(t => /sobreext/i.test(t.distanceToMA50Label), 'Precio SOBREEXTENDIDO sobre MA50'),
    make(t => t.scannerRank == null || t.scannerRank > 7, 'Scanner rank > 7 o sin ranking'),
    make(isIntervened, 'Trades con intervención manual', true),
    make(t => t.systemCompliance === 'No' || t.systemCompliance === '0%' || t.systemCompliance === '25%', 'Sistema no respetado', true),
  ].filter(r => r.count >= 3);

  const worst = [...rows].filter(r => r.totalPnl < 0).sort((a, b) => a.totalPnl - b.totalPnl)[0];

  return (
    <section className="space-y-4">
      <BlockHeader
        title="¿Cuándo entras mal?"
        subtitle="Entiende tus errores sistemáticos — Ray Dalio"
      />
      <Card title="Errores sistemáticos detectados">
        {rows.length === 0 ? (
          <NotEnough note="No hay suficientes trades en estas categorías para análisis." />
        ) : (
          <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-2 font-medium">Patrón</th>
                  <th className="text-right py-2 px-2 font-medium">N</th>
                  <th className="text-right py-2 px-2 font-medium">Win Rate</th>
                  <th className="text-right py-2 px-2 font-medium">P&L Medio</th>
                  <th className="text-right py-2 pl-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const tl = trafficLight(r.winRate);
                  return (
                    <tr key={r.label} className="border-b border-border/40">
                      <td className="py-2.5 pr-2 text-foreground">{r.label}</td>
                      <td className="py-2.5 px-2 text-right font-data text-muted-foreground">{r.count}</td>
                      <td className={`py-2.5 px-2 text-right font-data font-semibold ${wrColor(r.winRate)}`}>{r.winRate.toFixed(0)}%</td>
                      <td className={`py-2.5 px-2 text-right font-data font-semibold ${r.avgPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{eur(r.avgPnl)}</td>
                      <td className="py-2.5 pl-2 text-right text-base">{tl.icon}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {worst && (
          <div className="mt-4">
            <Insight text={`Tu error más costoso es "${worst.label}" — te ha costado ${eur(worst.totalPnl)} en ${worst.count} trades.`} />
          </div>
        )}
      </Card>
    </section>
  );
}

/* ────────── BLOQUE 4 ────────── */

function Block4TradeManagement({ trades }: { trades: Trade[] }) {
  // 4A — MFE Capturado: aproximamos MFE como distancia entry→TP teórico
  const winnersWithTp = trades.filter(t =>
    t.isWin && t.tpPrice > 0 && t.exitPrice != null
  );
  const mfeCaptured = winnersWithTp.map(t => {
    const tpDist = Math.abs(t.tpPrice - t.entryPrice);
    const actualDist = Math.abs((t.exitPrice ?? t.entryPrice) - t.entryPrice);
    return tpDist > 0 ? Math.min(100, (actualDist / tpDist) * 100) : 100;
  });
  const avgMfeCaptured = avg(mfeCaptured);
  const mfeColor = avgMfeCaptured < 40 ? 'text-destructive' : avgMfeCaptured < 70 ? 'text-primary' : 'text-success';

  // 4B — MAE Ganadores vs Perdedores (% en términos de precio)
  const wins = trades.filter(t => t.isWin && t.slPrice > 0);
  const losses = trades.filter(t => !t.isWin && t.slPrice > 0);
  const maeWinners = avg(wins.map(t => Math.abs(t.entryPrice - t.slPrice) / t.entryPrice * 100));
  const maeLosers = avg(losses.map(t => Math.abs(t.entryPrice - t.slPrice) / t.entryPrice * 100));
  const slTooWide = maeLosers > maeWinners * 1.3;

  // 4C — RR Real vs Teórico
  const rrData = useMemo(() => trades
    .filter(t => t.slPrice > 0 && t.tpPrice > 0 && t.exitPrice != null)
    .map(t => {
      const risk = Math.abs(t.entryPrice - t.slPrice);
      const theoreticalReward = Math.abs(t.tpPrice - t.entryPrice);
      const actualReward = t.direction === 'BUY'
        ? (t.exitPrice! - t.entryPrice)
        : (t.entryPrice - t.exitPrice!);
      return {
        symbol: t.symbol,
        theoreticalRR: risk > 0 ? theoreticalReward / risk : 0,
        actualRR: risk > 0 ? actualReward / risk : 0,
        isWin: t.isWin,
      };
    }), [trades]);
  const belowDiag = rrData.filter(p => p.actualRR < p.theoreticalRR).length;
  const belowDiagPct = pct(belowDiag, rrData.length);

  // 4D — Duración por resultado
  const buckets = [
    { label: '<1d', min: 0, max: 24 },
    { label: '1-3d', min: 24, max: 72 },
    { label: '3-7d', min: 72, max: 168 },
    { label: '>7d', min: 168, max: Infinity },
  ];
  const durData = buckets.map(b => {
    const inBucket = trades.filter(t => t.durationHours >= b.min && t.durationHours < b.max);
    const w = inBucket.filter(t => t.isWin).length;
    const l = inBucket.length - w;
    return {
      range: b.label,
      ganadores: w,
      perdedores: l,
      total: inBucket.length,
      winRate: pct(w, inBucket.length),
    };
  });
  const bestDur = [...durData].filter(d => d.total >= 3).sort((a, b) => b.winRate - a.winRate)[0];

  return (
    <section className="space-y-4">
      <BlockHeader
        title="Gestión del trade"
        subtitle="El timing de salida importa tanto como la entrada"
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="MFE Capturado">
          {mfeCaptured.length >= MIN_GROUP ? (
            <>
              <div className={`text-4xl font-data font-bold ${mfeColor}`}>
                {avgMfeCaptured.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Sobre {mfeCaptured.length} trades ganadores con TP definido
              </div>
              <div className="mt-4">
                <Insight text={`Capturas el ${avgMfeCaptured.toFixed(0)}% del movimiento favorable medio. ${
                  avgMfeCaptured < 40 ? 'Estás cerrando demasiado pronto.' :
                  avgMfeCaptured < 70 ? 'Hay margen para dejar correr más los ganadores.' :
                  'Excelente captura de beneficio.'
                }`} />
              </div>
            </>
          ) : <NotEnough />}
        </Card>

        <Card title="MAE Ganadores vs Perdedores">
          {wins.length >= 3 && losses.length >= 3 ? (
            <>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Ganadores</span>
                    <span className="font-data text-success">{maeWinners.toFixed(2)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-success" style={{ width: `${Math.min(100, (maeWinners / Math.max(maeWinners, maeLosers, 0.01)) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Perdedores</span>
                    <span className="font-data text-destructive">{maeLosers.toFixed(2)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-destructive" style={{ width: `${Math.min(100, (maeLosers / Math.max(maeWinners, maeLosers, 0.01)) * 100)}%` }} />
                  </div>
                </div>
              </div>
              {slTooWide && (
                <div className="mt-3 flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>El SL puede estar demasiado amplio en perdedores</span>
                </div>
              )}
            </>
          ) : <NotEnough />}
        </Card>

        <Card title="RR Real vs Teórico">
          {rrData.length >= MIN_GROUP ? (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                    <XAxis type="number" dataKey="theoreticalRR" name="RR Teórico" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="actualRR" name="RR Real" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <ZAxis range={[40, 40]} />
                    <ReferenceLine
                      segment={[{ x: 0, y: 0 }, { x: 5, y: 5 }]}
                      stroke="#c8a951" strokeDasharray="4 4" ifOverflow="extendDomain"
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, n: string) => [Number(v).toFixed(2), n]}
                      labelFormatter={(_, p) => p?.[0]?.payload?.symbol ?? ''}
                    />
                    <Scatter data={rrData.filter(r => r.isWin)} fill="#34d399" name="Ganadores" />
                    <Scatter data={rrData.filter(r => !r.isWin)} fill="#f87171" name="Perdedores" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              {belowDiagPct > 50 && (
                <div className="mt-2">
                  <Insight text={`${belowDiagPct.toFixed(0)}% de tus trades están bajo la diagonal — estás capturando menos RR del planificado.`} />
                </div>
              )}
            </>
          ) : <NotEnough />}
        </Card>

        <Card title="Duración por Resultado">
          {durData.some(d => d.total > 0) ? (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ganadores" fill="#34d399" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="perdedores" fill="#f87171" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {bestDur && (
                <div className="mt-2">
                  <Insight text={`Tus mejores trades duran ${bestDur.range} (${bestDur.winRate.toFixed(0)}% win rate en ${bestDur.total} trades).`} />
                </div>
              )}
            </>
          ) : <NotEnough />}
        </Card>
      </div>
    </section>
  );
}

/* ────────── BLOQUE 5 ────────── */

function Block5Consistency({ trades }: { trades: Trade[] }) {
  const monthly = useMemo(() => {
    const buckets: Record<string, Trade[]> = {};
    for (const t of trades) {
      const d = new Date(t.exitDate ?? t.entryDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      (buckets[key] ??= []).push(t);
    }
    const sortedKeys = Object.keys(buckets).sort();
    let cumWins = 0, cumTotal = 0;
    return sortedKeys.map(key => {
      const arr = buckets[key];
      const wins = arr.filter(t => t.isWin).length;
      cumWins += wins;
      cumTotal += arr.length;
      const interventions = arr.filter(t => t.manualIntervention != null && isIntervened(t)).length;
      const withCompliance = arr.filter(t => t.systemCompliance);
      const respectFull = withCompliance.filter(t => isFullCompliance(t.systemCompliance)).length;
      const respectPct = withCompliance.length > 0 ? pct(respectFull, withCompliance.length) : null;
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString('es-ES', { month: 'short', year: '2-digit' });
      return {
        key,
        label,
        trades: arr.length,
        winRate: pct(wins, arr.length),
        cumWinRate: pct(cumWins, cumTotal),
        pnl: arr.reduce((s, t) => s + t.netPnl, 0),
        interventions,
        respectPct,
      };
    });
  }, [trades]);

  const recent = [...monthly].reverse();

  return (
    <section className="space-y-4">
      <BlockHeader
        title="Consistencia en el tiempo"
        subtitle="La disciplina se mide en meses, no en operaciones"
      />

      <Card title="Evolución del Win Rate Mensual">
        {monthly.length >= 2 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="winRate" name="Win Rate Mensual" stroke="#c8a951" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cumWinRate" name="WR Acumulado" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <NotEnough note="Se necesitan al menos 2 meses con trades" />}
      </Card>

      <Card title="Resumen Mensual">
        {recent.length > 0 ? (
          <div className="overflow-x-auto -mx-4 lg:mx-0 px-4 lg:px-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-2 font-medium">Mes</th>
                  <th className="text-right py-2 px-2 font-medium">Trades</th>
                  <th className="text-right py-2 px-2 font-medium">Win Rate</th>
                  <th className="text-right py-2 px-2 font-medium">P&L</th>
                  <th className="text-right py-2 px-2 font-medium">Intervenc.</th>
                  <th className="text-right py-2 pl-2 font-medium">Respeto</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(m => {
                  const respectColor = m.respectPct == null ? 'bg-secondary text-muted-foreground'
                    : m.respectPct >= 80 ? 'bg-success/20 text-success'
                    : m.respectPct >= 50 ? 'bg-primary/20 text-primary'
                    : 'bg-destructive/20 text-destructive';
                  return (
                    <tr key={m.key} className="border-b border-border/40">
                      <td className="py-2.5 pr-2 capitalize text-foreground">{m.label}</td>
                      <td className="py-2.5 px-2 text-right font-data text-muted-foreground">{m.trades}</td>
                      <td className={`py-2.5 px-2 text-right font-data font-semibold ${wrColor(m.winRate)}`}>{m.winRate.toFixed(0)}%</td>
                      <td className={`py-2.5 px-2 text-right font-data font-semibold ${m.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>{eur(m.pnl)}</td>
                      <td className="py-2.5 px-2 text-right font-data text-muted-foreground">{m.interventions}</td>
                      <td className="py-2.5 pl-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-md font-data text-[11px] ${respectColor}`}>
                          {m.respectPct == null ? '—' : `${m.respectPct.toFixed(0)}%`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <NotEnough />}
      </Card>
    </section>
  );
}
