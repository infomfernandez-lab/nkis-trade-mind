import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowRight, TrendingUp, TrendingDown, Flame, Snowflake } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, computeStatsFromTrades, filterByBroker, type Trade } from '@/lib/trade-utils';
import { computeDashboardKpis } from '@/lib/analytics';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { StatusBar } from '@/components/radar/StatusBar';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { VigilanciaView } from '@/components/radar/ScannerListView';
import { PnlCalendarSection } from '@/components/statistics/PnlCalendarSection';
import { MarketBriefing } from '@/components/dashboard/MarketBriefing';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/')({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: 'Panel — CAP Trading' },
      { name: 'description', content: 'Panel resumido: briefing, rendimiento, escáner, posiciones abiertas y últimas operaciones.' },
    ],
  }),
});

function Dashboard() {
  const { closedTrades: allClosed, openTrades: allOpen, isLoading, error } = useAllTrades();
  const { data: settings } = useSettings();
  const { broker } = useBrokerFilter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando panel...</span>
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

  const closedTrades = filterByBroker(allClosed, broker);
  const openTrades = filterByBroker(allOpen, broker);
  const startingBalance = Number(settings?.balance ?? 10000);

  // Initial reference balances per account
  const INITIAL_NKIS = 953000;
  const INITIAL_OCTX = 100000;
  const balanceNkis = Number((settings as any)?.balance_nkis ?? 0);
  const balanceOctx = Number((settings as any)?.balance_octx ?? 0);
  const initialBalance =
    broker === 'darwinex' ? INITIAL_NKIS :
    broker === 'octx' ? INITIAL_OCTX :
    INITIAL_NKIS + INITIAL_OCTX;
  const currentBalance =
    broker === 'darwinex' ? balanceNkis :
    broker === 'octx' ? balanceOctx :
    balanceNkis + balanceOctx;
  const brokerLabel = broker === 'all' ? '' : ` — ${broker === 'darwinex' ? 'NK' : 'OX'}`;

  return (
    <div className="space-y-4">
      <StatusBar brokerFilter={broker} />

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Panel{brokerLabel}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">CAP Trend Following — Vista resumida</p>
      </div>

      {/* 1. Briefing */}
      <MarketBriefing openTrades={openTrades} />

      {/* 2. Rendimiento del sistema */}
      <SystemPerformance
        closed={closedTrades}
        open={openTrades}
        startingBalance={startingBalance}
        initialBalance={initialBalance}
        currentBalance={currentBalance}
      />

      {/* 3. Escáner */}
      <ScannerSummary />

      {/* 3.5 En Vigilancia */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
          <h2 className="font-display font-bold text-sm text-foreground">EN VIGILANCIA</h2>
          <Link
            to="/radar"
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
          >
            Ver Radar <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <VigilanciaView brokerFilter={broker} />
      </section>

      {/* 4. Posiciones abiertas */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
          <h2 className="font-display font-bold text-sm text-foreground">POSICIONES ABIERTAS</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
            {openTrades.length}
          </span>
          <span className={`ml-auto font-data font-bold text-sm ${
            openTrades.reduce((s, t) => s + t.netPnl, 0) >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {formatCurrency(openTrades.reduce((s, t) => s + t.netPnl, 0))} flotante
          </span>
        </div>
        <OpenPositionsTable brokerFilter={broker} compact />
      </section>

      {/* Calendario PnL */}
      <PnlCalendarSection closedTrades={closedTrades} />


      {/* 5. Últimas cerradas */}
      <RecentClosed closed={closedTrades} />

      {closedTrades.length === 0 && openTrades.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground text-sm">Aún no hay trades. Conecta tu script de sincronización MT5 para empezar.</p>
        </div>
      )}
    </div>
  );
}

/* ─────────── Rendimiento del sistema ─────────── */
function SystemPerformance({ closed, open, startingBalance, initialBalance, currentBalance }: { closed: Trade[]; open: Trade[]; startingBalance: number; initialBalance: number; currentBalance: number }) {
  const stats = computeStatsFromTrades(closed, open);
  const kpis = computeDashboardKpis(closed, startingBalance);
  const totalPnlPct = startingBalance > 0 ? (stats.totalPnl / startingBalance) * 100 : 0;

  // Drawdown sobre el balance real de la cuenta
  // peak = max(balance inicial, balance actual). Sin histórico de picos, usamos el inicial como suelo.
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
        <MetricCard
          label="P&L Total"
          value={formatCurrency(stats.totalPnl)}
          sub={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
          tone={stats.totalPnl >= 0 ? 'good' : 'bad'}
        />
        <MetricCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`mín 40% · ${stats.wins}W / ${stats.losses}L`}
          tone={winRateOk ? 'good' : 'bad'}
        />
        <MetricCard
          label="Profit Factor"
          value={kpis.profitFactor === Infinity ? '∞' : kpis.profitFactor.toFixed(2)}
          sub={pfTone === 'good' ? '≥ 1.5 ✓' : pfTone === 'bad' ? '< 1 ✗' : '1 – 1.5'}
          tone={pfTone}
        />
        <MetricCard
          label="Drawdown Máx"
          value={`${drawdownPct.toFixed(2)}%`}
          sub={currentBalance > 0
            ? `${formatCurrency(currentBalance)} / pico ${formatCurrency(peak)}`
            : 'Sin balance sincronizado'}
          tone={ddBad ? 'bad' : 'good'}
        />
        <MetricCard
          label="Posiciones Abiertas"
          value={String(open.length)}
          tone="neutral"
        />
        <MetricCard
          label="Racha Actual"
          value={`${stats.currentStreak} ${stats.streakType}`}
          icon={stats.streakType === 'W'
            ? <Flame className="w-4 h-4 text-success" />
            : <Snowflake className="w-4 h-4 text-destructive" />}
          tone={stats.currentStreak === 0 ? 'neutral' : stats.streakType === 'W' ? 'good' : 'bad'}
        />
      </div>
    </section>
  );
}

function MetricCard({
  label, value, sub, tone = 'neutral', icon,
}: {
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

/* ─────────── Escáner ─────────── */
interface ScannerSessionRow {
  id: string;
  broker: string | null;
  session_date: string;
  created_at: string;
  top_instruments: unknown;
}

function useLatestScannerSummary() {
  return useQuery({
    queryKey: ['dashboard-scanner-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('id, broker, session_date, created_at, top_instruments')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ScannerSessionRow[];
    },
    refetchOnWindowFocus: true,
  });
}

function summarizeSession(row: ScannerSessionRow | null) {
  if (!row) return { elite: 0, solido: 0, observar: 0, total: 0, when: null as string | null };
  const arr = Array.isArray(row.top_instruments) ? (row.top_instruments as Array<{ score?: number }>) : [];
  let elite = 0, solido = 0, observar = 0;
  for (const r of arr) {
    const s = Number(r?.score ?? 0);
    if (s >= 75) elite++;
    else if (s >= 60) solido++;
    else observar++;
  }
  return { elite, solido, observar, total: arr.length, when: row.session_date ?? row.created_at };
}

function ScannerSummary() {
  const { data: rows, isLoading } = useLatestScannerSummary();

  const { nk, ox } = useMemo(() => {
    const list = rows ?? [];
    const findFirst = (pred: (b: string) => boolean) =>
      list.find(r => pred((r.broker ?? '').toLowerCase())) ?? null;
    return {
      nk: findFirst(b => b.includes('darwinex') || b.includes('nkis') || b === ''),
      ox: findFirst(b => b.includes('octx')),
    };
  }, [rows]);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
        <h2 className="font-display font-bold text-sm text-foreground">ESCÁNER</h2>
        <Link
          to="/radar"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
        >
          Ver Radar <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-4">Cargando escáner…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ScannerAccountCard label="NK" badgeClass="bg-blue-950 text-blue-300 border-blue-800" summary={summarizeSession(nk)} />
          <ScannerAccountCard label="OX" badgeClass="bg-orange-900/40 text-orange-300 border-orange-700/50" summary={summarizeSession(ox)} />
        </div>
      )}
    </section>
  );
}

function ScannerAccountCard({
  label, badgeClass, summary,
}: { label: string; badgeClass: string; summary: ReturnType<typeof summarizeSession> }) {
  const when = summary.when ? new Date(summary.when) : null;
  const whenStr = when ? `${when.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} ${when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : '—';
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>{label}</span>
        <span className="text-xs text-muted-foreground">Último scan: <span className="font-data text-foreground">{whenStr}</span></span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <TierBadge label="Élite" value={summary.elite} cls="bg-primary/15 text-primary border-primary/40" />
        <TierBadge label="Sólido" value={summary.solido} cls="bg-success/15 text-success border-success/40" />
        <TierBadge label="Observar" value={summary.observar} cls="bg-secondary text-muted-foreground border-border" />
      </div>
    </div>
  );
}

function TierBadge({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-base font-data font-bold">{value}</div>
    </div>
  );
}

/* ─────────── Últimas cerradas ─────────── */
function RecentClosed({ closed }: { closed: Trade[] }) {
  const recent = useMemo(() => {
    return [...closed]
      .sort((a, b) => new Date(b.exitDate ?? b.entryDate).getTime() - new Date(a.exitDate ?? a.entryDate).getTime())
      .slice(0, 5);
  }, [closed]);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
        <h2 className="font-display font-bold text-sm text-foreground">ÚLTIMAS OPERACIONES CERRADAS</h2>
        <Link
          to="/trades"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
        >
          Ver todas <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aún no hay operaciones cerradas.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {recent.map(t => {
            const dt = new Date(t.exitDate ?? t.entryDate);
            return (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="font-bold text-sm w-24 truncate">{t.symbol}</span>
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  t.direction === 'BUY' ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
                }`}>
                  {t.direction === 'BUY' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {t.direction}
                </span>
                <span className={`ml-auto font-data font-bold text-sm ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(t.netPnl)}
                </span>
                <span className="text-xs text-muted-foreground font-data w-20 text-right">
                  {dt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─────────── En Vigilancia (compact) ─────────── */
function VigilanciaCompact({ brokerFilter }: { brokerFilter: BrokerFilter }) {
  const { data: watchlist } = useWatchlist();
  const { openTrades } = useAllTrades();
  const openSymbols = useMemo(() => new Set(openTrades.map(t => t.symbol)), [openTrades]);

  const items = useMemo(() => {
    return (watchlist ?? []).filter(w => {
      if ((w.status ?? '').toLowerCase() !== 'vigilancia') return false;
      const broker = (w.broker ?? 'darwinex') as 'darwinex' | 'octx';
      if (brokerFilter !== 'all' && brokerFilter !== broker) return false;
      return true;
    });
  }, [watchlist, brokerFilter]);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
        <h2 className="font-display font-bold text-sm text-foreground">EN VIGILANCIA</h2>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
          {items.length}
        </span>
        <Link
          to="/radar"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
        >
          Ver Radar <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay instrumentos en vigilancia. Añádelos desde el Radar.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {items.map(w => {
            const broker = (w.broker ?? 'darwinex') as 'darwinex' | 'octx';
            const isOpen = openSymbols.has(w.symbol);
            const dir = (w.direction ?? '').toLowerCase();
            const alcista = dir === 'alcista' || dir === 'buy';
            return (
              <div key={w.id} className={`flex items-center gap-3 px-3 py-2.5 ${isOpen ? 'bg-success/5' : ''}`}>
                <span className="font-bold text-sm w-28 truncate">{w.symbol}</span>
                <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${
                  broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
                }`}>{broker === 'darwinex' ? 'NK' : 'OX'}</span>
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
                }`}>
                  {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {alcista ? 'BUY' : 'SELL'}
                </span>
                {w.scanner_score != null && (
                  <span className="font-data text-xs text-muted-foreground">Score <span className="font-bold text-foreground">{Number(w.scanner_score).toFixed(0)}</span></span>
                )}
                <span className="ml-auto">
                  {isOpen ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/40">ABIERTA</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">VIGILANDO</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
