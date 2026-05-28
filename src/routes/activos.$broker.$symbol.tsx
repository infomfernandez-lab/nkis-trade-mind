import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUp, ArrowDown, Loader2, TrendingUp, TrendingDown, Activity, ListChecks, BarChart3, Info } from 'lucide-react';
import { assetsSupabase } from '@/components/activos/assets-supabase-client';
import { supabase } from '@/integrations/supabase/client';
import { getContractSpec } from '@/lib/contract-specs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { rowToTrade, formatCurrency, type Trade } from '@/lib/trade-utils';
import type { Activity as Act } from '@/hooks/use-activities';

export const Route = createFileRoute('/activos/$broker/$symbol')({
  component: AssetDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.symbol} — Activos` }],
  }),
});

// Map asset broker (nkis/octx) to trade broker (darwinex/octx)
function assetBrokerToTradeBroker(b: string): string {
  const v = b.toLowerCase();
  if (v === 'nkis' || v === 'darwinex') return 'darwinex';
  return 'octx';
}

function AssetDetailPage() {
  const { broker, symbol } = Route.useParams();
  const navigate = useNavigate();

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset-detail', symbol, broker],
    queryFn: async () => {
      const { data, error } = await assetsSupabase
        .from('assets')
        .select('*')
        .eq('symbol', symbol)
        .eq('broker', broker)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tradeBroker = assetBrokerToTradeBroker(broker);

  const { data: trades = [] } = useQuery({
    queryKey: ['asset-trades', symbol, tradeBroker],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('symbol', symbol)
        .eq('broker', tradeBroker)
        .order('entry_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(rowToTrade);
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['asset-activities', symbol],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('symbol', symbol)
        .order('due_date', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Act[];
    },
  });

  const { data: scannerHits = [] } = useQuery({
    queryKey: ['asset-scanner-hits', symbol, tradeBroker],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('momentum_sessions')
        .select('id, created_at, score, direccion, evento')
        .eq('symbol', symbol)
        .eq('broker', tradeBroker)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const spec = getContractSpec(symbol);
  const stats = useMemo(() => computeStats(trades), [trades]);
  const openTrade = useMemo(() => trades.find(t => t.status === 'open') ?? null, [trades]);
  const lastClosed = useMemo(() => trades.find(t => t.status === 'closed') ?? null, [trades]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <button
        onClick={() => navigate({ to: '/activos' })}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Activos
      </button>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive p-4 border border-destructive/40 rounded-md bg-destructive/5">
          Error al cargar: {(error as Error).message}
        </div>
      ) : !asset ? (
        <div className="text-sm text-muted-foreground italic p-8">
          No se encontró el instrumento {symbol} ({broker}).
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                {asset.symbol}
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  {asset.broker}
                </span>
              </h1>
              {(asset.description || spec?.description) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {asset.description ?? spec?.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs">
                {asset.familia && <Pill>{asset.familia}</Pill>}
                {asset.sector && <Pill muted>{asset.sector}</Pill>}
                <ScannerStatusPill active={asset.is_active_scanner} lastSeen={asset.last_seen_scanner} />
              </div>
            </div>
            <ScoreBadge score={asset.last_score} />
          </div>

          {/* Quick state row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StateCard
              label="Posición"
              value={openTrade
                ? <Link to="/trade/$tradeId" params={{ tradeId: openTrade.id }} className="text-primary hover:underline inline-flex items-center gap-1">
                    {openTrade.direction === 'BUY' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    Abierta · {formatCurrency(openTrade.netPnl)}
                  </Link>
                : <span className="text-muted-foreground italic">Sin posición</span>}
            />
            <StateCard
              label="Última operación"
              value={lastClosed
                ? <Link to="/trade/$tradeId" params={{ tradeId: lastClosed.id }} className={`hover:underline inline-flex items-center gap-1 ${lastClosed.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(lastClosed.netPnl)} · {new Date(lastClosed.exitDate ?? lastClosed.entryDate).toLocaleDateString('es-ES')}
                  </Link>
                : <span className="text-muted-foreground italic">Sin trades cerrados</span>}
            />
            <StateCard
              label="Dirección actual"
              value={<DirectionCell value={asset.last_direction} />}
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="timeline"><Activity className="w-3.5 h-3.5 mr-1.5" /> Timeline</TabsTrigger>
              <TabsTrigger value="trades"><ListChecks className="w-3.5 h-3.5 mr-1.5" /> Trades ({trades.length})</TabsTrigger>
              <TabsTrigger value="stats"><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Estadísticas</TabsTrigger>
              <TabsTrigger value="info"><Info className="w-3.5 h-3.5 mr-1.5" /> Información</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <TimelineTab trades={trades} activities={activities} scannerHits={scannerHits} />
            </TabsContent>

            <TabsContent value="trades" className="mt-4">
              <TradesTab trades={trades} />
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <StatsTab stats={stats} />
            </TabsContent>

            <TabsContent value="info" className="mt-4">
              <InfoTab asset={asset} spec={spec} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

/* ────── Timeline ────── */

type TimelineEvent =
  | { kind: 'trade'; date: string; trade: Trade }
  | { kind: 'activity'; date: string; activity: Act }
  | { kind: 'scanner'; date: string; hit: { id: string; score: number; direccion: string; evento: string | null } };

function TimelineTab({ trades, activities, scannerHits }: {
  trades: Trade[];
  activities: Act[];
  scannerHits: Array<{ id: string; created_at: string | null; score: number; direccion: string; evento: string | null }>;
}) {
  const events: TimelineEvent[] = useMemo(() => {
    const out: TimelineEvent[] = [];
    for (const t of trades) out.push({ kind: 'trade', date: t.exitDate ?? t.entryDate, trade: t });
    for (const a of activities) {
      const d = a.done_at ?? a.due_date ?? a.created_at;
      if (d) out.push({ kind: 'activity', date: d, activity: a });
    }
    for (const h of scannerHits) {
      if (h.created_at) out.push({ kind: 'scanner', date: h.created_at, hit: { id: h.id, score: h.score, direccion: h.direccion, evento: h.evento } });
    }
    out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    return out;
  }, [trades, activities, scannerHits]);

  if (events.length === 0) {
    return <div className="text-sm text-muted-foreground italic p-8 text-center border border-border bg-card rounded-md">Sin eventos registrados para este activo.</div>;
  }

  return (
    <div className="rounded-md border border-border bg-card divide-y divide-border">
      {events.map((ev, idx) => (
        <div key={idx} className="p-3 flex items-start gap-3 hover:bg-secondary/30 transition-colors">
          <div className="w-32 shrink-0 text-[11px] text-muted-foreground font-data">
            {new Date(ev.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex-1 min-w-0">
            <TimelineRow ev={ev} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineRow({ ev }: { ev: TimelineEvent }) {
  if (ev.kind === 'trade') {
    const t = ev.trade;
    return (
      <Link to="/trade/$tradeId" params={{ tradeId: t.id }} className="block hover:text-primary">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">Trade</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.direction === 'BUY' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>{t.direction}</span>
          <span className="text-xs">{t.status === 'open' ? 'Abierto' : 'Cerrado'}</span>
          {t.status === 'closed' && (
            <span className={`text-xs font-data font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">#{t.ticket}</span>
        </div>
      </Link>
    );
  }
  if (ev.kind === 'activity') {
    const a = ev.activity;
    const statusColor = a.status === 'HECHO' ? 'text-success' : a.status === 'CANCELADO' ? 'text-muted-foreground' : 'text-yellow-500';
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/40 text-foreground">{a.type}</span>
        <span className="text-xs">{a.title}</span>
        <span className={`text-[10px] font-bold ml-auto ${statusColor}`}>{a.status}</span>
      </div>
    );
  }
  // scanner
  const h = ev.hit;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">Escáner</span>
      <span className="text-xs">Score <span className="font-data font-bold">{Number(h.score).toFixed(0)}</span></span>
      <span className={`text-[10px] font-bold ${(h.direccion ?? '').toUpperCase() === 'ALCISTA' ? 'text-success' : 'text-destructive'}`}>{h.direccion}</span>
      {h.evento && <span className="text-[11px] text-muted-foreground ml-auto">{h.evento}</span>}
    </div>
  );
}

/* ────── Trades tab ────── */

function TradesTab({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <div className="text-sm text-muted-foreground italic p-8 text-center border border-border bg-card rounded-md">Aún no hay trades para este activo.</div>;
  }
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Dir</TableHead>
            <TableHead className="text-right">Entrada</TableHead>
            <TableHead className="text-right">Salida</TableHead>
            <TableHead className="text-right">Lote</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map(t => (
            <TableRow key={t.id} className="cursor-pointer hover:bg-secondary/40">
              <TableCell className="text-xs">
                <Link to="/trade/$tradeId" params={{ tradeId: t.id }} className="hover:text-primary">
                  {new Date(t.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </Link>
              </TableCell>
              <TableCell>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.direction === 'BUY' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>{t.direction}</span>
              </TableCell>
              <TableCell className="text-right font-data text-xs">{t.entryPrice.toFixed(4)}</TableCell>
              <TableCell className="text-right font-data text-xs">{t.exitPrice != null ? t.exitPrice.toFixed(4) : '—'}</TableCell>
              <TableCell className="text-right font-data text-xs">{t.lotSize}</TableCell>
              <TableCell className={`text-right font-data text-xs font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{t.status === 'closed' ? formatCurrency(t.netPnl) : '—'}</TableCell>
              <TableCell className="text-xs">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.status === 'open' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {t.status === 'open' ? 'ABIERTO' : 'CERRADO'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ────── Stats tab ────── */

interface Stats {
  total: number; open: number; closed: number;
  wins: number; losses: number;
  winRate: number; totalPnl: number;
  avgWin: number; avgLoss: number;
  best: number; worst: number;
  profitFactor: number | null;
}

function computeStats(trades: Trade[]): Stats {
  const closed = trades.filter(t => t.status === 'closed');
  const wins = closed.filter(t => t.netPnl > 0);
  const losses = closed.filter(t => t.netPnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  return {
    total: trades.length,
    open: trades.filter(t => t.status === 'open').length,
    closed: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    totalPnl: closed.reduce((s, t) => s + t.netPnl, 0),
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? -grossLoss / losses.length : 0,
    best: closed.length ? Math.max(...closed.map(t => t.netPnl)) : 0,
    worst: closed.length ? Math.min(...closed.map(t => t.netPnl)) : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? null : 0),
  };
}

function StatsTab({ stats }: { stats: Stats }) {
  if (stats.total === 0) {
    return <div className="text-sm text-muted-foreground italic p-8 text-center border border-border bg-card rounded-md">Sin trades para calcular estadísticas.</div>;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Trades totales" value={stats.total} />
      <Stat label="Cerrados" value={stats.closed} />
      <Stat label="Abiertos" value={stats.open} />
      <Stat label="Win rate" value={`${(stats.winRate * 100).toFixed(1)}%`} />
      <Stat label="P&L total" value={<span className={stats.totalPnl >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(stats.totalPnl)}</span>} />
      <Stat label="Profit factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '∞'} />
      <Stat label="Ganados / Perdidos" value={`${stats.wins} / ${stats.losses}`} />
      <Stat label="Trade promedio +" value={<span className="text-success">{formatCurrency(stats.avgWin)}</span>} />
      <Stat label="Trade promedio –" value={<span className="text-destructive">{formatCurrency(stats.avgLoss)}</span>} />
      <Stat label="Mejor trade" value={<span className="text-success">{formatCurrency(stats.best)}</span>} />
      <Stat label="Peor trade" value={<span className="text-destructive">{formatCurrency(stats.worst)}</span>} />
    </div>
  );
}

/* ────── Info tab ────── */

function InfoTab({ asset, spec }: { asset: any; spec: ReturnType<typeof getContractSpec> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Mercado" value={asset.familia} />
        <Stat label="Sector" value={asset.sector} />
        <Stat label="ADX" value={asset.last_adx != null ? Number(asset.last_adx).toFixed(2) : null} />
        <Stat label="Stoch" value={asset.last_stoch != null ? Number(asset.last_stoch).toFixed(2) : null} />
        <Stat label="Precio último scan" value={asset.last_price != null ? Number(asset.last_price).toFixed(4) : null} />
        <Stat label="ATR estado" value={<AtrBadge value={asset.last_atr_state} />} />
        <Stat label="En escáner ahora" value={asset.is_active_scanner ? 'Sí' : 'No'} />
        <Stat label="Última vez visto" value={asset.last_seen_scanner ? new Date(asset.last_seen_scanner).toLocaleString('es-ES') : null} />
      </div>

      {spec && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Especificación del contrato</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Tick size" value={spec.tickSize} />
            <Stat label="Tick value" value={`${spec.tickValue} ${spec.profitCurrency}`} />
            <Stat label="Contract size" value={spec.contractSize} />
            <Stat label="Volume min" value={spec.volumeMin} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────── helpers ────── */

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-data text-sm mt-1">{value != null && value !== '' ? value : '—'}</div>
    </div>
  );
}

function StateCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function Pill({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${muted ? 'bg-secondary text-muted-foreground border-border' : 'bg-primary/10 text-primary border-primary/30'}`}>
      {children}
    </span>
  );
}

function ScannerStatusPill({ active, lastSeen }: { active: boolean | null; lastSeen: string | null }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${active ? 'bg-success/15 text-success border-success/40' : 'bg-muted text-muted-foreground border-border'}`}>
      {active ? '● En escáner' : '○ Fuera del escáner'}
      {lastSeen && <span className="opacity-70 ml-1">· {new Date(lastSeen).toLocaleDateString('es-ES')}</span>}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const s = Number(score);
  const cls =
    s >= 75 ? 'bg-yellow-500/15 text-yellow-500 border-yellow-500/40' :
    s >= 60 ? 'bg-success/15 text-success border-success/40' :
    'bg-muted text-muted-foreground border-border';
  const icon = s >= 75 ? '★' : s >= 60 ? '●' : '◌';
  return (
    <div className={`px-3 py-2 rounded-md border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">Score</div>
      <div className="text-2xl font-bold font-data">{icon} {s.toFixed(0)}</div>
    </div>
  );
}

function DirectionCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toUpperCase();
  if (v === 'ALCISTA') return <span className="inline-flex items-center gap-1 text-success font-semibold"><ArrowUp className="w-3.5 h-3.5" /> ALCISTA</span>;
  if (v === 'BAJISTA') return <span className="inline-flex items-center gap-1 text-destructive font-semibold"><ArrowDown className="w-3.5 h-3.5" /> BAJISTA</span>;
  return <span>{value}</span>;
}

function AtrBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toUpperCase();
  const style =
    v === 'BAJA' ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' :
    v === 'COHERENTE' ? 'bg-muted text-muted-foreground border-border' :
    v === 'ELEVADA' ? 'bg-orange-500/15 text-orange-500 border-orange-500/40' :
    v === 'ANORMAL' ? 'bg-destructive/15 text-destructive border-destructive/40' :
    'bg-muted text-muted-foreground border-border';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${style}`}>{v}</span>;
}
