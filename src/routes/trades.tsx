import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { Loader2, BookCheck, Circle, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClosedTrades } from '@/hooks/use-trades';
import { filterByBroker, type Trade } from '@/lib/trade-utils';
import { detectCloseType, computeRR, hasJournal, lookupScannerRank } from '@/lib/trade-derived';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { TradeJournal } from '@/components/TradeJournal';
import { supabase } from '@/integrations/supabase/client';
import { classifyInstrument } from '@/lib/instrument-classify';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRightPanel } from '@/contexts/RightPanelContext';

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
type DirFilter = 'all' | 'BUY' | 'SELL';
type AccFilter = 'all' | 'darwinex' | 'octx';
type PnlFilter = 'all' | 'win' | 'loss';

function TradeLog() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { broker } = useBrokerFilter();
  const { data: closedTrades, isLoading, error } = useClosedTrades();
  const { data: scannerSessions } = useScannerSessions();

  // Filter / search / sort state
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dirFilter, setDirFilter] = useState<DirFilter>('all');
  const [accFilter, setAccFilter] = useState<AccFilter>('all');
  const [pnlFilter, setPnlFilter] = useState<PnlFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('num');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const baseFiltered = useMemo(() => filterByBroker(closedTrades ?? [], broker), [closedTrades, broker]);

  // Number trades by chronological order (oldest = 1)
  const numbered = useMemo(
    () => baseFiltered.map((t, i) => ({ trade: t, num: i + 1, name: classifyInstrument(t.symbol).description })),
    [baseFiltered]
  );

  // Predictive suggestions (top 8 unique)
  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const seen = new Set<string>();
    const out: { symbol: string; name: string }[] = [];
    for (const { trade, name } of numbered) {
      const key = trade.symbol;
      if (seen.has(key)) continue;
      if (trade.symbol.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
        seen.add(key);
        out.push({ symbol: trade.symbol, name });
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [search, numbered]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return numbered.filter(({ trade, name }) => {
      if (q && !(trade.symbol.toLowerCase().includes(q) || name.toLowerCase().includes(q))) return false;
      if (dirFilter !== 'all' && trade.direction !== dirFilter) return false;
      if (accFilter !== 'all' && trade.broker !== accFilter) return false;
      if (pnlFilter === 'win' && trade.netPnl < 0) return false;
      if (pnlFilter === 'loss' && trade.netPnl >= 0) return false;
      if (dateFrom && trade.entryDate.slice(0, 10) < dateFrom) return false;
      if (dateTo && trade.entryDate.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [numbered, search, dirFilter, accFilter, pnlFilter, dateFrom, dateTo]);

  // Apply sorting
  const display = useMemo(() => {
    const arr = [...filtered];
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
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'num' || key === 'entryDate' || key === 'netPnl' ? 'desc' : 'asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setDirFilter('all');
    setAccFilter('all');
    setPnlFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  const hasActiveFilters = search || dirFilter !== 'all' || accFilter !== 'all' || pnlFilter !== 'all' || dateFrom || dateTo;

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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Registro de Trades{brokerLabel}</h1>
        <p className="text-base text-muted-foreground mt-1">
          {display.length} de {numbered.length} trades — click en una fila para ver el detalle
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Predictive search */}
          <Popover open={searchOpen && suggestions.length > 0} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ticker o nombre…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  className="pl-8 pr-8 h-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <div className="max-h-64 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => { setSearch(s.symbol); setSearchOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-accent text-sm flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold font-data">{s.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Direction */}
          <FilterGroup
            label="Dir"
            value={dirFilter}
            options={[{ v: 'all', l: 'Todas' }, { v: 'BUY', l: 'BUY' }, { v: 'SELL', l: 'SELL' }]}
            onChange={(v) => setDirFilter(v as DirFilter)}
          />

          {/* Account */}
          <FilterGroup
            label="Cuenta"
            value={accFilter}
            options={[{ v: 'all', l: 'Todas' }, { v: 'darwinex', l: 'NK' }, { v: 'octx', l: 'OX' }]}
            onChange={(v) => setAccFilter(v as AccFilter)}
          />

          {/* P&L */}
          <FilterGroup
            label="P&L"
            value={pnlFilter}
            options={[{ v: 'all', l: 'Todos' }, { v: 'win', l: 'Ganadores' }, { v: 'loss', l: 'Perdedores' }]}
            onChange={(v) => setPnlFilter(v as PnlFilter)}
          />

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Desde</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-[140px] text-sm"
            />
            <span className="text-xs text-muted-foreground font-medium">Hasta</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-[140px] text-sm"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
              <X className="w-3.5 h-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

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
                scannerSessions={scannerSessions ?? []}
                expanded={expandedId === trade.id}
                onToggle={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
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

function FilterGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="inline-flex rounded-md border border-border overflow-hidden">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              value === o.v ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-accent'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
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
  scannerSessions: any[];
  expanded: boolean;
  onToggle: () => void;
}

function TradeRow({ trade, num, fullName, scannerSessions, expanded, onToggle }: TradeRowProps) {
  const queryClient = useQueryClient();
  const close = detectCloseType(trade);
  const rr = computeRR(trade);
  const journalDone = hasJournal(trade);
  const scanner = lookupScannerRank(trade, scannerSessions);

  const rowBg = trade.netPnl >= 0
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';

  const brokerLabel = trade.broker === 'darwinex' ? 'NK' : trade.broker === 'octx' ? 'OX' : trade.broker;
  const pnlColor = trade.netPnl >= 0 ? 'text-success' : 'text-destructive';
  const dirBg = trade.direction === 'BUY' ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive';

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-border cursor-pointer transition-colors ${rowBg}`}
      >
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
          <div className="inline-flex items-center gap-2">
            {journalDone ? (
              <BookCheck className="w-4 h-4 text-primary" aria-label="Bitácora rellenada" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground/50" aria-label="Bitácora vacía" />
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={14} className="border-b border-border bg-card p-4 lg:p-6">
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
          </td>
        </tr>
      )}
    </>
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
