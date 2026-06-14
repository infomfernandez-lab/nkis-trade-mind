import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { Loader2, BookCheck, Circle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClosedTrades, useAllTrades } from '@/hooks/use-trades';
import { filterByBroker, type Trade } from '@/lib/trade-utils';
import { detectCloseType, computeRR, hasJournal, lookupScannerRank } from '@/lib/trade-derived';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { TradeJournal } from '@/components/TradeJournal';
import { supabase } from '@/integrations/supabase/client';
import { classifyInstrument } from '@/lib/instrument-classify';
import { useNavigate } from '@tanstack/react-router';
import {
  AssetsStyleFiltersBar,
  EMPTY_SCANNER_FILTERS,
  aggregateTradesByKey,
  type ScannerFilterState,
} from '@/components/radar/AssetsStyleFiltersBar';
import { useAssetMap } from '@/hooks/use-asset-map';

export const Route = createFileRoute('/trades')({
  component: TradeLog,
  head: () => ({
    meta: [
      { title: 'Registro de Trades — CAP Trading' },
      { name: 'description', content: 'Historial completo de trades con análisis psicológico.' },
    ],
  }),
});

function formatEur(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}€${Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function useScannerSessions() {
  return useQuery({
    queryKey: ['scanner_sessions', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('session_date, broker, top_instruments')
        .order('session_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

type SortKey = 'num' | 'symbol' | 'name' | 'direction' | 'broker' | 'entryDate' | 'entryPrice' | 'exitPrice' | 'slPrice' | 'tpPrice' | 'lotSize' | 'durationHours' | 'netPnl';
type SortDir = 'asc' | 'desc';

interface EnrichedTrade {
  trade: Trade;
  num: number;
  name: string;
  mercado: string | null;
  sector: string | null;
  score: number | null;
}

function TradeLog() {
  const { broker } = useBrokerFilter();
  const { data: closedTrades, isLoading, error } = useClosedTrades();
  const { data: scannerSessions } = useScannerSessions();
  const { closedTrades: allClosed, openTrades: allOpen } = useAllTrades();
  const assetMap = useAssetMap();

  const [filters, setFilters] = useState<ScannerFilterState>(EMPTY_SCANNER_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('num');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const baseFiltered = useMemo(() => filterByBroker(closedTrades ?? [], broker), [closedTrades, broker]);

  const tradeAgg = useMemo(
    () => aggregateTradesByKey([...allClosed, ...allOpen]),
    [allClosed, allOpen],
  );

  // Enrich each trade with mercado/sector/score (lookup once)
  const enriched = useMemo<EnrichedTrade[]>(() => {
    return baseFiltered.map((t, i) => {
      const c = assetMap.classify(t.symbol);
      const lk = lookupScannerRank(t, scannerSessions ?? []);
      return {
        trade: t,
        num: i + 1,
        name: classifyInstrument(t.symbol).description,
        mercado: c.mercado,
        sector: c.sector,
        score: lk.score,
      };
    });
  }, [baseFiltered, assetMap, scannerSessions]);

  const mercados = useMemo(() => {
    const s = new Set<string>();
    enriched.forEach(e => { if (e.mercado) s.add(e.mercado); });
    return Array.from(s).sort();
  }, [enriched]);

  const sectores = useMemo(() => {
    const s = new Set<string>();
    enriched.forEach(e => {
      if (filters.mercado !== 'all' && e.mercado !== filters.mercado) return;
      if (e.sector) s.add(e.sector);
    });
    return Array.from(s).sort();
  }, [enriched, filters.mercado]);

  // Apply scanner-style filters
  const filtered = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return enriched.filter(e => {
      const t = e.trade;
      if (filters.mercado !== 'all' && e.mercado !== filters.mercado) return false;
      if (filters.sector !== 'all' && e.sector !== filters.sector) return false;
      if (filters.dir === 'ALCISTA' && t.direction !== 'BUY') return false;
      if (filters.dir === 'BAJISTA' && t.direction !== 'SELL') return false;
      if (q && !t.symbol.toUpperCase().includes(q) && !e.name.toUpperCase().includes(q)) return false;
      if (filters.strongTrend && !(Number(t.adxValue ?? 0) >= 25)) return false;
      if (filters.trade === 'open' && t.status !== 'open') return false;
      if (filters.trade === 'recent_closed') {
        const ts = t.exitDate ? new Date(t.exitDate).getTime() : 0;
        if (ts < weekAgo) return false;
      }
      if (filters.trade === 'winners' && !(t.netPnl > 0)) return false;
      if (filters.trade === 'losers' && !(t.netPnl < 0)) return false;
      return true;
    });
  }, [enriched, filters]);

  // Sort: respect column sort if user clicked a column, otherwise filter sort
  const display = useMemo(() => {
    const arr = [...filtered];
    if (sortKey !== 'num' || sortDir !== 'desc') {
      const mul = sortDir === 'asc' ? 1 : -1;
      arr.sort((a, b) => {
        const ta = a.trade, tb = b.trade;
        let va: any, vb: any;
        switch (sortKey) {
          case 'num': va = a.num; vb = b.num; break;
          case 'name': va = a.name; vb = b.name; break;
          case 'symbol': va = ta.symbol; vb = tb.symbol; break;
          case 'direction': va = ta.direction; vb = tb.direction; break;
          case 'broker': va = ta.broker; vb = tb.broker; break;
          case 'entryDate': va = ta.entryDate; vb = tb.entryDate; break;
          case 'entryPrice': va = ta.entryPrice; vb = tb.entryPrice; break;
          case 'exitPrice': va = ta.exitPrice ?? 0; vb = tb.exitPrice ?? 0; break;
          case 'slPrice': va = ta.slPrice; vb = tb.slPrice; break;
          case 'tpPrice': va = ta.tpPrice; vb = tb.tpPrice; break;
          case 'lotSize': va = ta.lotSize; vb = tb.lotSize; break;
          case 'durationHours': va = ta.durationHours; vb = tb.durationHours; break;
          case 'netPnl': va = ta.netPnl; vb = tb.netPnl; break;
        }
        if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * mul;
        return (va < vb ? -1 : va > vb ? 1 : 0) * mul;
      });
      return arr;
    }
    // Use scanner-style sort
    const num = (x: number | null | undefined) => (x == null ? -Infinity : Number(x));
    arr.sort((a, b) => {
      switch (filters.sort) {
        case 'score_desc': return num(b.score) - num(a.score);
        case 'score_asc':  return num(a.score) - num(b.score);
        case 'adx_desc':   return num(b.trade.adxValue) - num(a.trade.adxValue);
        case 'vol_desc':   return 0;
        case 'pnl_desc':   return b.trade.netPnl - a.trade.netPnl;
        case 'pnl_asc':    return a.trade.netPnl - b.trade.netPnl;
        case 'recent_close': {
          const at = a.trade.exitDate ? new Date(a.trade.exitDate).getTime() : 0;
          const bt = b.trade.exitDate ? new Date(b.trade.exitDate).getTime() : 0;
          return bt - at;
        }
        default: return b.num - a.num;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, filters.sort]);

  // ── Stats over the currently filtered set ─────────────────────────────
  const stats = useMemo(() => {
    const list = display.map(d => d.trade);
    const n = list.length;
    const winsArr = list.filter(t => t.netPnl > 0);
    const lossArr = list.filter(t => t.netPnl < 0);
    const wins = winsArr.length;
    const losses = lossArr.length;
    const totalPnl = list.reduce((s, t) => s + t.netPnl, 0);
    const grossWin = winsArr.reduce((s, t) => s + t.netPnl, 0);
    const grossLoss = Math.abs(lossArr.reduce((s, t) => s + t.netPnl, 0));
    const winRate = n > 0 ? (wins / n) * 100 : 0;
    const avgWin = wins > 0 ? grossWin / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const expectancy = n > 0 ? totalPnl / n : 0;
    const best = list.reduce((m, t) => t.netPnl > m ? t.netPnl : m, -Infinity);
    const worst = list.reduce((m, t) => t.netPnl < m ? t.netPnl : m, Infinity);
    const avgDuration = n > 0 ? list.reduce((s, t) => s + (t.durationHours ?? 0), 0) / n : 0;
    return {
      n, wins, losses, winRate, totalPnl, avgWin, avgLoss, pf, expectancy,
      best: n > 0 ? best : 0,
      worst: n > 0 ? worst : 0,
      avgDuration,
    };
  }, [display]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'num' || key === 'entryDate' || key === 'netPnl' ? 'desc' : 'asc');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando trades...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Error al cargar trades: {error.message}</p>
      </div>
    );
  }

  if ((closedTrades ?? []).length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Registro de Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">Aún no hay trades cerrados</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm">Tu historial de trades aparecerá aquí cuando tu script de sincronización MT5 envíe datos.</p>
          <p className="text-xs text-muted-foreground mt-2">Configura el script en Ajustes → Clave API de Sincronización MT5</p>
        </div>
      </div>
    );
  }

  const brokerLabel = broker === 'all' ? '' : ` — ${broker === 'darwinex' ? 'NK' : 'OX'}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Registro de Trades{brokerLabel}</h1>
        <p className="text-base text-muted-foreground mt-1">
          {display.length} de {enriched.length} trades — click en una fila para ver el detalle
        </p>
      </div>

      <AssetsStyleFiltersBar
        state={filters}
        onChange={setFilters}
        mercados={mercados}
        sectores={sectores}
        countLabel={`${display.length} de ${enriched.length}`}
      />

      <StatsPanel stats={stats} />

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <SortableTh label="#" sortKey="num" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Ticker" sortKey="symbol" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Nombre" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Dir" sortKey="direction" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Cuenta" sortKey="broker" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Fecha" sortKey="entryDate" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableTh label="Entrada" sortKey="entryPrice" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label="Salida" sortKey="exitPrice" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label="SL" sortKey="slPrice" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label="TP" sortKey="tpPrice" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label="Lotes" sortKey="lotSize" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label="Duración" sortKey="durationHours" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableTh label="P&L" sortKey="netPnl" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {display.map(({ trade, num, name }) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                num={num}
                fullName={name}
              />
            ))}
            {display.length === 0 && (
              <tr><td colSpan={14} className="p-12 text-center text-muted-foreground text-sm">No hay trades que coincidan con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsPanel({ stats }: { stats: {
  n: number; wins: number; losses: number; winRate: number; totalPnl: number;
  avgWin: number; avgLoss: number; pf: number; expectancy: number;
  best: number; worst: number; avgDuration: number;
} }) {
  const pnlColor = stats.totalPnl >= 0 ? 'text-success' : 'text-destructive';
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
        Estadísticas del filtro actual
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-3">
        <Stat label="Trades" value={String(stats.n)} />
        <Stat label="Ganadores" value={String(stats.wins)} valueClass="text-success" />
        <Stat label="Perdedores" value={String(stats.losses)} valueClass="text-destructive" />
        <Stat label="Win rate" value={`${stats.winRate.toFixed(1)}%`} />
        <Stat label="P&L neto" value={formatEur(stats.totalPnl)} valueClass={pnlColor} />
        <Stat label="Expectativa" value={formatEur(stats.expectancy)} />
        <Stat label="Avg win" value={formatEur(stats.avgWin)} valueClass="text-success" />
        <Stat label="Avg loss" value={formatEur(-stats.avgLoss)} valueClass="text-destructive" />
        <Stat
          label="Profit factor"
          value={stats.pf === Infinity ? '∞' : stats.pf.toFixed(2)}
          valueClass={stats.pf >= 1 ? 'text-success' : 'text-destructive'}
        />
        <Stat label="Mejor" value={formatEur(stats.best)} valueClass="text-success" />
        <Stat label="Peor" value={formatEur(stats.worst)} valueClass="text-destructive" />
        <Stat label="Duración media" value={`${stats.avgDuration.toFixed(1)}h`} />
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
      <div className={`text-sm font-data font-semibold truncate ${valueClass ?? 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function SortableTh({
  label, sortKey, current, dir, onClick, align,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: 'right';
}) {
  const active = current === sortKey;
  return (
    <th className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? 'text-foreground' : ''}`}
      >
        {label}
        {active ? (
          dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

interface TradeRowProps {
  trade: Trade;
  num: number;
  fullName: string;
}

function TradeRow({ trade, num, fullName }: TradeRowProps) {
  const navigate = useNavigate();
  const journalDone = hasJournal(trade);

  const rowBg = trade.netPnl >= 0
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';

  const brokerLabel = trade.broker === 'darwinex' ? 'NK' : trade.broker === 'octx' ? 'OX' : trade.broker;
  const pnlColor = trade.netPnl >= 0 ? 'text-success' : 'text-destructive';
  const dirBg = trade.direction === 'BUY' ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive';

  const handleOpen = () => {
    navigate({ to: '/trade/$tradeId', params: { tradeId: trade.id } });
  };

  return (
    <tr onClick={handleOpen} className={`border-b border-border cursor-pointer transition-colors ${rowBg}`}>
      <td className="px-3 py-3 font-data text-muted-foreground">{num}</td>
      <td className="px-3 py-3 font-semibold">{trade.symbol}</td>
      <td className="px-3 py-3 text-muted-foreground">{fullName}</td>
      <td className="px-3 py-3">
        <span className={`px-2 py-0.5 rounded text-sm font-data font-bold ${dirBg}`}>{trade.direction}</span>
      </td>
      <td className="px-3 py-3 font-data">{brokerLabel}</td>
      <td className="px-3 py-3 font-data">{formatShortDate(trade.entryDate)}</td>
      <td className="px-3 py-3 font-data text-right">{trade.entryPrice}</td>
      <td className="px-3 py-3 font-data text-right">{trade.exitPrice ?? '—'}</td>
      <td className="px-3 py-3 font-data text-right">{trade.slPrice}</td>
      <td className="px-3 py-3 font-data text-right">{trade.tpPrice}</td>
      <td className="px-3 py-3 font-data text-right">{trade.lotSize}</td>
      <td className="px-3 py-3 font-data text-right">{trade.durationHours}h</td>
      <td className={`px-3 py-3 font-data font-bold text-right ${pnlColor}`}>{formatEur(trade.netPnl)}</td>
      <td className="px-3 py-3 text-right">
        {journalDone ? (
          <BookCheck className="w-4 h-4 text-primary inline" aria-label="Bitácora rellenada" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/50 inline" aria-label="Bitácora vacía" />
        )}
      </td>
    </tr>
  );
}

export function TradeDetail({ trade, scannerSessions }: { trade: Trade; scannerSessions: any[] }) {
  const queryClient = useQueryClient();
  const close = detectCloseType(trade);
  const rr = computeRR(trade);
  const scanner = lookupScannerRank(trade, scannerSessions);
  const brokerLabel = trade.broker === 'darwinex' ? 'NK' : trade.broker === 'octx' ? 'OX' : trade.broker;

  return (
    <div className="space-y-6 text-sm">
      <Section title="Datos del Trade">
        <Grid>
          <Field label="Ticket" value={`#${trade.ticket}`} />
          <Field label="Broker" value={brokerLabel} />
          <Field label="Precio Entrada" value={String(trade.entryPrice)} mono />
          <Field label="Precio Salida" value={String(trade.exitPrice ?? '—')} mono />
          <Field label="SL" value={String(trade.slPrice)} mono />
          <Field label="TP" value={String(trade.tpPrice)} mono />
          <Field label="Lotaje" value={String(trade.lotSize)} mono />
          <Field label="P&L Bruto" value={formatEur(trade.grossPnl)} pnl={trade.grossPnl} />
          <Field label="Comisión" value={`€${trade.commission}`} />
          <Field label="Swap" value={`€${trade.swap}`} />
          <Field label="P&L Neto" value={formatEur(trade.netPnl)} pnl={trade.netPnl} />
          <Field label="Duración" value={`${trade.durationHours}h`} />
          <Field label="RR Real" value={rr != null ? rr.toFixed(2) : '—'} mono />
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Tipo de Cierre</div>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-data font-bold ${close.bg} ${close.color}`}>
              {close.label}
            </span>
          </div>
        </Grid>
      </Section>

      <Section title="Indicadores al Momento de Entrada">
        <Grid>
          <Field label="ADX" value={`${trade.adxValue} (${trade.adxState})`} mono />
          <Field label="Dist. a MA50" value={`${trade.distanceToMA50}% (${trade.distanceToMA50Label})`} mono />
          <Field label="Momentum 20d" value={`${trade.momentum20d}% ${trade.momentumAligned ? '✓ Alineado' : '✗ No alineado'}`} mono />
          <Field label="Stochastic K" value={String(trade.stochasticK)} mono />
          <Field
            label="Ranking Scanner"
            value={
              scanner.rank != null
                ? `#${scanner.rank} de ${scanner.total} — Score: ${scanner.score ?? '—'}`
                : 'No estaba en el radar'
            }
          />
          <Field label="VIX al Entrar" value={trade.vixAtEntry != null ? `VIX: ${trade.vixAtEntry}` : 'VIX: —'} />
        </Grid>
      </Section>

      <TradeJournal
        trade={trade}
        scannerInfo={scanner}
        vixValue={trade.vixAtEntry}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['trades'] })}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>;
}

function Field({ label, value, mono, pnl }: { label: string; value: string; mono?: boolean; pnl?: number }) {
  const color = pnl !== undefined ? (pnl >= 0 ? 'text-success' : 'text-destructive') : 'text-foreground';
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${mono ? 'font-data' : ''} ${color}`}>{value}</div>
    </div>
  );
}
