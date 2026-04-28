import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { FileText, Calendar, TrendingUp, BarChart3, Download, Loader2, CalendarDays, Save } from 'lucide-react';
import { useClosedTrades, useOpenTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { useLatestVix } from '@/hooks/use-latest-vix';
import { useLatestScannerByKey } from '@/hooks/use-scanner-instruments';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { formatCurrency, filterByBroker, type Trade } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { exportWeeklyReport, exportMonthlyReport, exportPerformanceReport, exportDailyReport, type DailyEliteSignal, type DailyOpenPos } from '@/lib/report-pdf';

export const Route = createFileRoute('/reports')({
  component: Reports,
  head: () => ({
    meta: [
      { title: 'Informes — CAP Trading' },
      { name: 'description', content: 'Informes semanal, mensual y de performance generados automáticamente desde Supabase.' },
    ],
  }),
});

function Reports() {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'performance'>('daily');
  const { data: openTrades } = useOpenTrades();
  const { data: allClosed, isLoading, error } = useClosedTrades();
  const { broker } = useBrokerFilter();
  const { data: settings } = useSettings();

  const [perspective, setPerspective] = useState('');
  const [selfAssessment, setSelfAssessment] = useState('');

  const trades = useMemo(() => filterByBroker(allClosed ?? [], broker), [allClosed, broker]);

  const startingBalance = useMemo(() => {
    if (!settings) return 0;
    if (broker === 'darwinex') return Number(settings.balance_nkis ?? 0);
    if (broker === 'octx') return Number(settings.balance_octx ?? 0);
    return Number(settings.balance_nkis ?? 0) + Number(settings.balance_octx ?? 0);
  }, [settings, broker]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando informes…</span>
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

  // ----- weekly window -----
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  const weeklyTrades = trades.filter(t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    return d >= weekStart && d <= weekEnd;
  });

  // ----- monthly windows -----
  const monthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthlyTrades = trades.filter(t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
  });
  const prevMonthTrades = trades.filter(t => {
    const d = new Date(t.exitDate ?? t.entryDate);
    return d.getMonth() === prevMonthDate.getMonth() && d.getFullYear() === prevMonthDate.getFullYear();
  });

  const tabs: Array<{ key: typeof activeTab; label: string; icon: typeof Calendar }> = [
    { key: 'daily', label: 'Diario', icon: CalendarDays },
    { key: 'weekly', label: 'Semanal', icon: Calendar },
    { key: 'monthly', label: 'Mensual', icon: TrendingUp },
    { key: 'performance', label: 'Performance', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Informes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informes generados automáticamente con los datos del registro de trades · Exportables a PDF con diseño NKIS
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <DailyPanel
          closedTrades={trades}
          openTrades={(openTrades ?? []).filter(t =>
            broker === 'all' ? true :
            broker === 'darwinex' ? (t.broker === 'darwinex' || t.broker === 'nkis') :
            (t.broker === 'octx' || t.broker === 'fxpro')
          )}
          brokerFilter={broker}
        />
      )}

      {activeTab === 'weekly' && (
        <WeeklyPanel
          trades={weeklyTrades}
          weekStart={weekStart}
          weekEnd={weekEnd}
          perspective={perspective}
          setPerspective={setPerspective}
        />
      )}

      {activeTab === 'monthly' && (
        <MonthlyPanel
          trades={monthlyTrades}
          prevTrades={prevMonthTrades}
          monthDate={monthDate}
          startingBalance={startingBalance}
          selfAssessment={selfAssessment}
          setSelfAssessment={setSelfAssessment}
        />
      )}

      {activeTab === 'performance' && (
        <PerformancePanel
          trades={trades}
          startingBalance={startingBalance}
          vixCautionThreshold={Number(settings?.vix_caution_threshold ?? 25)}
        />
      )}
    </div>
  );
}

// ===================== Helpers =====================
function metrics(trades: Trade[]) {
  const wins = trades.filter(t => t.isWin);
  const losses = trades.filter(t => !t.isWin);
  const totalPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  return { totalPnl, winRate, profitFactor, wins: wins.length, losses: losses.length };
}

function maxDD(trades: Trade[]) {
  let peak = 0, run = 0, dd = 0;
  for (const t of trades) {
    run += t.netPnl;
    if (run > peak) peak = run;
    if (peak - run > dd) dd = peak - run;
  }
  return dd;
}

function compliance(trades: Trade[]) {
  if (!trades.length) return 0;
  return (trades.filter(t => t.systemCompliance === '100%').length / trades.length) * 100;
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
    >
      <Download className="w-4 h-4" />
      Exportar PDF
    </button>
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

// ===================== WEEKLY =====================
function WeeklyPanel({ trades, weekStart, weekEnd, perspective, setPerspective }: {
  trades: Trade[]; weekStart: Date; weekEnd: Date; perspective: string; setPerspective: (s: string) => void;
}) {
  const m = metrics(trades);
  const dd = maxDD(trades);
  const comp = compliance(trades);

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Informe Semanal</h2>
          <p className="text-xs text-muted-foreground">
            {weekStart.toLocaleDateString('es-ES')} — {weekEnd.toLocaleDateString('es-ES')}
          </p>
        </div>
        <ExportButton onClick={() => exportWeeklyReport({ trades, weekStart, weekEnd, perspective })} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Trades" value={String(trades.length)} />
        <MiniStat label="P&L Total" value={formatCurrency(m.totalPnl)} positive={m.totalPnl >= 0} />
        <MiniStat label="Win Rate" value={`${m.winRate.toFixed(1)}%`} />
        <MiniStat label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
        <MiniStat label="Drawdown máx." value={formatCurrency(-dd)} positive={false} />
        <MiniStat label="Cumplimiento" value={`${comp.toFixed(0)}%`} />
        <MiniStat label="Ganadores" value={String(m.wins)} positive />
        <MiniStat label="Perdedores" value={String(m.losses)} positive={false} />
      </div>

      {trades.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Trades Cerrados</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {trades.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-data font-bold ${t.direction === 'BUY' ? 'text-success' : 'text-destructive'}`}>{t.direction}</span>
                  <span className="font-medium">{t.symbol}</span>
                  <span className="text-xs text-muted-foreground capitalize">{t.broker}</span>
                  <span className="text-xs text-muted-foreground">{t.systemCompliance ?? '—'}</span>
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
          value={perspective}
          onChange={e => setPerspective(e.target.value)}
          className="w-full h-24 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="¿Qué esperas y cómo planeas operar la próxima semana?"
        />
      </div>
    </div>
  );
}

// ===================== MONTHLY =====================
function MonthlyPanel({ trades, prevTrades, monthDate, startingBalance, selfAssessment, setSelfAssessment }: {
  trades: Trade[]; prevTrades: Trade[]; monthDate: Date; startingBalance: number;
  selfAssessment: string; setSelfAssessment: (s: string) => void;
}) {
  const m = metrics(trades);
  const prev = metrics(prevTrades);
  const dd = maxDD(trades);
  const sorted = [...trades].sort((a, b) => b.netPnl - a.netPnl);
  const best = sorted.slice(0, 3);
  const worst = sorted.slice(-3).reverse();

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Informe Mensual</h2>
          <p className="text-xs text-muted-foreground capitalize">
            {monthDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <ExportButton onClick={() => exportMonthlyReport({ trades, prevTrades, monthDate, startingBalance, selfAssessment })} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="P&L Total" value={formatCurrency(m.totalPnl)} positive={m.totalPnl >= 0} />
        <MiniStat label="Trades" value={String(trades.length)} />
        <MiniStat label="Win Rate" value={`${m.winRate.toFixed(1)}%`} />
        <MiniStat label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
        <MiniStat label="Drawdown máx." value={formatCurrency(-dd)} positive={false} />
        <MiniStat label="Mes anterior" value={formatCurrency(prev.totalPnl)} positive={prev.totalPnl >= 0} />
        <MiniStat label="Δ vs mes ant." value={formatCurrency(m.totalPnl - prev.totalPnl)} positive={m.totalPnl - prev.totalPnl >= 0} />
        <MiniStat label="Cumplimiento" value={`${compliance(trades).toFixed(0)}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopList title="🥇 3 Mejores Trades" trades={best} positive />
        <TopList title="🔻 3 Peores Trades" trades={worst} positive={false} />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Autoevaluación</h3>
        <textarea
          value={selfAssessment}
          onChange={e => setSelfAssessment(e.target.value)}
          className="w-full h-24 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="¿Cómo evalúas tu rendimiento este mes?"
        />
      </div>
    </div>
  );
}

function TopList({ title, trades, positive }: { title: string; trades: Trade[]; positive: boolean }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">{title}</h3>
      {trades.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin datos</p>
      ) : (
        <div className="space-y-1.5">
          {trades.map(t => (
            <div key={t.id} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
              <span className="font-medium">{t.symbol}</span>
              <span className={`font-data font-semibold ${positive ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== PERFORMANCE =====================
function PerformancePanel({ trades, startingBalance, vixCautionThreshold }: {
  trades: Trade[]; startingBalance: number; vixCautionThreshold: number;
}) {
  const m = metrics(trades);
  const dd = maxDD(trades);
  const comp = compliance(trades);

  const bySymbol = useMemo(() => {
    const map: Record<string, Trade[]> = {};
    trades.forEach(t => { (map[t.symbol] ??= []).push(t); });
    return Object.entries(map).map(([sym, ts]) => {
      const mm = metrics(ts);
      return { sym, count: ts.length, pnl: mm.totalPnl, wr: mm.winRate, pf: mm.profitFactor };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Informe de Performance</h2>
          <p className="text-xs text-muted-foreground">Acumulado desde el inicio · {trades.length} trades</p>
        </div>
        <ExportButton onClick={() => exportPerformanceReport({ trades, startingBalance, vixCautionThreshold })} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="P&L Total" value={formatCurrency(m.totalPnl)} positive={m.totalPnl >= 0} />
        <MiniStat label="Trades" value={String(trades.length)} />
        <MiniStat label="Win Rate" value={`${m.winRate.toFixed(1)}%`} />
        <MiniStat label="Profit Factor" value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)} />
        <MiniStat label="Drawdown máx." value={formatCurrency(-dd)} positive={false} />
        <MiniStat label="Cumplimiento" value={`${comp.toFixed(0)}%`} />
        <MiniStat label="Ganadores" value={String(m.wins)} positive />
        <MiniStat label="Perdedores" value={String(m.losses)} positive={false} />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> Análisis por Instrumento
        </h3>
        {bySymbol.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin datos.</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr className="text-xs uppercase text-muted-foreground">
                  <th className="text-left px-3 py-2">Símbolo</th>
                  <th className="text-right px-3 py-2">Trades</th>
                  <th className="text-right px-3 py-2">P&L</th>
                  <th className="text-right px-3 py-2">Win Rate</th>
                  <th className="text-right px-3 py-2">PF</th>
                </tr>
              </thead>
              <tbody>
                {bySymbol.map(r => (
                  <tr key={r.sym} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{r.sym}</td>
                    <td className="px-3 py-2 text-right font-data">{r.count}</td>
                    <td className={`px-3 py-2 text-right font-data font-semibold ${r.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(r.pnl)}</td>
                    <td className="px-3 py-2 text-right font-data">{r.wr.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-data">{r.pf === Infinity ? '∞' : r.pf.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        El PDF incluye además: curva de equity completa, análisis por condición de VIX y desglose mes a mes.
      </p>
    </div>
  );
}

// ===================== DAILY =====================
const SYSTEM_FOLLOWED_OPTIONS = ['Sí al 100%', 'Casi', 'No'];
const ERROR_OPTIONS = ['Ninguno', 'Entré sin señal', 'Moví el SL', 'Cerré antes', 'Otro'];

function DailyPanel({ closedTrades, openTrades, brokerFilter }: {
  closedTrades: Trade[];
  openTrades: Trade[];
  brokerFilter: 'all' | 'darwinex' | 'octx';
}) {
  const { user } = useAuth();
  const { data: vixRow } = useLatestVix();
  const scannerMap = useLatestScannerByKey();

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const tomorrow = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d;
  }, [today]);
  const reportDateStr = today.toISOString().slice(0, 10);

  // Closed today
  const closedToday = useMemo(() => closedTrades.filter(t => {
    const dt = new Date(t.exitDate ?? t.entryDate);
    return dt >= today && dt < tomorrow;
  }), [closedTrades, today, tomorrow]);

  // Open positions → DailyOpenPos
  const openNow = useMemo<DailyOpenPos[]>(() => openTrades.map(t => ({
    symbol: t.symbol,
    broker: t.broker,
    direction: t.direction,
    lotSize: t.lotSize,
    entryPrice: t.entryPrice,
    slPrice: t.slPrice,
    floatingPnl: t.netPnl ?? 0,
  })), [openTrades]);

  // Elite signals from latest scanner (score >= 75)
  const { eliteNkis, eliteOctx } = useMemo(() => {
    const nkis: DailyEliteSignal[] = [];
    const octx: DailyEliteSignal[] = [];
    for (const inst of scannerMap.values()) {
      if (inst.score < 75) continue;
      const sig: DailyEliteSignal = {
        symbol: inst.symbol,
        broker: inst.broker,
        direction: inst.direction,
        score: inst.score,
      };
      if (inst.broker === 'darwinex') nkis.push(sig);
      else if (inst.broker === 'octx') octx.push(sig);
    }
    nkis.sort((a, b) => b.score - a.score);
    octx.sort((a, b) => b.score - a.score);
    return { eliteNkis: nkis, eliteOctx: octx };
  }, [scannerMap]);

  // Manual fields
  const [marketContext, setMarketContext] = useState('');
  const [systemFollowed, setSystemFollowed] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [lesson, setLesson] = useState('');
  const [planTomorrow, setPlanTomorrow] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load existing report for today (if any)
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('report_date', reportDateStr)
        .eq('broker_filter', brokerFilter)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setMarketContext(data.market_context ?? '');
        setSystemFollowed(data.system_followed ?? '');
        setErrors(Array.isArray(data.errors) ? (data.errors as string[]) : []);
        setLesson(data.lesson ?? '');
        setPlanTomorrow(data.plan_tomorrow ?? '');
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user, reportDateStr, brokerFilter]);

  const toggleError = (opt: string) => {
    setErrors(prev => {
      if (opt === 'Ninguno') return prev.includes('Ninguno') ? [] : ['Ninguno'];
      const next = prev.filter(e => e !== 'Ninguno');
      return next.includes(opt) ? next.filter(e => e !== opt) : [...next, opt];
    });
  };

  const save = async () => {
    if (!user) { toast.error('Debes iniciar sesión'); return; }
    setSaving(true);
    const { error } = await supabase.from('daily_reports').upsert({
      user_id: user.id,
      report_date: reportDateStr,
      broker_filter: brokerFilter,
      market_context: marketContext,
      system_followed: systemFollowed,
      errors,
      lesson,
      plan_tomorrow: planTomorrow,
    }, { onConflict: 'user_id,report_date,broker_filter' });
    setSaving(false);
    if (error) toast.error('Error al guardar: ' + error.message);
    else toast.success('Informe diario guardado');
  };

  const totalPnl = closedToday.reduce((s, t) => s + t.netPnl, 0);
  const floating = openNow.reduce((s, p) => s + p.floatingPnl, 0);
  const vix = vixRow?.vix != null ? Number(vixRow.vix) : null;

  const onExport = async () => {
    await save();
    exportDailyReport({
      date: today,
      brokerFilter,
      closedToday,
      openNow,
      eliteNkis,
      eliteOctx,
      vix,
      marketContext,
      systemFollowed,
      errors,
      lesson,
      planTomorrow,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Informe Diario</h2>
          <p className="text-xs text-muted-foreground capitalize">
            {today.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !loaded}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <ExportButton onClick={onExport} />
        </div>
      </div>

      {/* Auto stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="P&L Cerrado" value={formatCurrency(totalPnl)} positive={totalPnl >= 0} />
        <MiniStat label="Trades cerrados" value={String(closedToday.length)} />
        <MiniStat label="Posiciones abiertas" value={String(openNow.length)} />
        <MiniStat label="P&L Flotante" value={formatCurrency(floating)} positive={floating >= 0} />
        <MiniStat label="VIX del día" value={vix != null ? vix.toFixed(2) : '—'} />
        <MiniStat label="ÉLITE NKIS" value={String(eliteNkis.length)} />
        <MiniStat label="ÉLITE OCTX" value={String(eliteOctx.length)} />
        <MiniStat label="Cuenta" value={brokerFilter === 'all' ? 'NKIS+OCTX' : brokerFilter.toUpperCase()} />
      </div>

      {/* Closed today */}
      <div>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Cerradas Hoy</h3>
        {closedToday.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin trades cerrados hoy.</p>
        ) : (
          <div className="space-y-1.5">
            {closedToday.map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-data font-bold ${t.direction === 'BUY' ? 'text-success' : 'text-destructive'}`}>{t.direction}</span>
                  <span className="font-medium">{t.symbol}</span>
                  <span className="text-xs text-muted-foreground capitalize">{t.broker}</span>
                </div>
                <span className={`font-data font-semibold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open now */}
      <div>
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Abiertas Ahora</h3>
        {openNow.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Sin posiciones abiertas.</p>
        ) : (
          <div className="space-y-1.5">
            {openNow.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-data font-bold ${p.direction === 'BUY' ? 'text-success' : 'text-destructive'}`}>{p.direction}</span>
                  <span className="font-medium">{p.symbol}</span>
                  <span className="text-xs text-muted-foreground">{p.lotSize.toFixed(2)} lotes</span>
                  <span className="text-xs text-muted-foreground">SL {p.slPrice ? p.slPrice.toFixed(2) : '—'}</span>
                </div>
                <span className={`font-data font-semibold ${p.floatingPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(p.floatingPnl)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Elite signals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EliteList title="★ ÉLITE NKIS" list={eliteNkis} />
        <EliteList title="★ ÉLITE OCTX" list={eliteOctx} />
      </div>

      {/* Manual section */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Contexto de Mercado del Día</h3>
          <textarea
            value={marketContext}
            onChange={e => setMarketContext(e.target.value)}
            className="w-full h-20 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="¿Qué tono tuvo el mercado hoy? Noticias, volatilidad, etc."
          />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">¿Seguiste el sistema hoy?</h3>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_FOLLOWED_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setSystemFollowed(opt)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  systemFollowed === opt
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">¿Cometiste algún error?</h3>
          <div className="flex flex-wrap gap-2">
            {ERROR_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => toggleError(opt)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  errors.includes(opt)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Lección del Día</h3>
          <textarea
            value={lesson}
            onChange={e => setLesson(e.target.value)}
            className="w-full h-20 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="¿Qué aprendiste hoy?"
          />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Plan para Mañana</h3>
          <textarea
            value={planTomorrow}
            onChange={e => setPlanTomorrow(e.target.value)}
            className="w-full h-20 bg-input border border-border rounded-md p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="¿Qué planeas para mañana?"
          />
        </div>
      </div>
    </div>
  );
}

function EliteList({ title, list }: { title: string; list: DailyEliteSignal[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">{title}</h3>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Sin señales ÉLITE hoy.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.symbol}</span>
                <span className="text-xs text-muted-foreground">{s.direction}</span>
              </div>
              <span className="font-data font-bold text-primary">{s.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
