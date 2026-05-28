import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TrendingUp, TrendingDown, BookCheck, Circle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAllTrades } from '@/hooks/use-trades';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { SymbolMeta, useUnifiedInstruments } from './EnTendenciaBlock';
import { classifyInstrument } from '@/lib/instrument-classify';
import { classifyFamily, type Family } from '@/lib/instrument-family';
import {
  RadarFiltersBar,
  EMPTY_FILTERS,
  tierOfScore,
  matchSearch,
  buildSubsList,
  type RadarFilterState,
  type Tier,
  type Suggestion,
} from './RadarFiltersBar';
import { useRadarCollapsed } from './radar-collapse-context';
import { TradeJournal } from '@/components/TradeJournal';
import { lookupScannerRank, hasJournal } from '@/lib/trade-derived';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  brokerFilter: BrokerFilter;
  compact?: boolean;
  viewSwitcher?: React.ReactNode;
}

function formatPrice(price: number): string {
  if (!price) return '—';
  return price > 100 ? price.toFixed(2) : price.toFixed(5);
}

function tradeStatus(t: Trade): string {
  if (t.netPnl > 0) return 'En beneficio';
  if (t.netPnl < 0) return 'En pérdida — SL protege';
  return 'Dejar correr';
}

interface ScannerSessionLite {
  session_date: string;
  broker: string;
  top_instruments: any;
}

function useScannerSessions() {
  return useQuery<ScannerSessionLite[]>({
    queryKey: ['scanner_sessions', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('session_date, broker, top_instruments')
        .order('session_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ScannerSessionLite[];
    },
    staleTime: 60_000,
  });
}

export function OpenPositionsTable({ brokerFilter, compact = false }: Props) {
  const { openTrades, isLoading } = useAllTrades();
  const collapsed = useRadarCollapsed();
  const filteredAll = filterByBroker(openTrades, brokerFilter);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: scannerSessions } = useScannerSessions();

  const scannerAll = useUnifiedInstruments(brokerFilter);
  const scoreMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of scannerAll) m.set(`${it.symbol}::${it.broker}`, it.score ?? 0);
    return m;
  }, [scannerAll]);

  const annotated = useMemo(() => filteredAll.map(t => {
    const cls = classifyFamily(t.symbol);
    const score = scoreMap.get(`${t.symbol}::${t.broker}`);
    return {
      trade: t,
      _family: cls?.family ?? null,
      _subfamily: cls?.subfamily ?? null,
      _score: score,
      _tier: score != null ? tierOfScore(score) : null,
    };
  }), [filteredAll, scoreMap]);

  const familyFiltered = useMemo(() => annotated.filter(a => {
    if (filters.family && a._family !== filters.family) return false;
    if (filters.subfamily && a._subfamily !== filters.subfamily) return false;
    return true;
  }), [annotated, filters.family, filters.subfamily]);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { elite: 0, solido: 0, observar: 0 };
    for (const it of familyFiltered) if (it._tier) c[it._tier]++;
    return c;
  }, [familyFiltered]);

  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a._family) c[a._family] = (c[a._family] ?? 0) + 1;
    return c;
  }, [annotated]);

  const availableSubs = useMemo(() => buildSubsList(annotated, filters.family), [annotated, filters.family]);

  const suggestions: Suggestion[] = useMemo(
    () => annotated.map(a => ({ value: a.trade.symbol, label: a.trade.symbol, description: classifyInstrument(a.trade.symbol).description })),
    [annotated],
  );

  const filtered = useMemo(() => {
    let arr = familyFiltered;
    if (filters.tier) arr = arr.filter(a => a._tier === filters.tier);
    if (filters.search.trim()) {
      arr = arr.filter(a => matchSearch(filters.search, [a.trade.symbol, classifyInstrument(a.trade.symbol).description]));
    }
    return arr.map(a => a.trade);
  }, [familyFiltered, filters.tier, filters.search]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-6">Cargando posiciones...</div>;
  }

  if (filteredAll.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No hay posiciones abiertas</p>
        <p className="text-xs text-muted-foreground/60 mt-1">El EA abrirá posiciones automáticamente cuando se cumplan las condiciones del sistema.</p>
      </div>
    );
  }

  const dwTrades = filtered.filter(t => t.broker === 'darwinex');
  const fxTrades = filtered.filter(t => t.broker === 'octx');
  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-4">
      {!compact && (
        <div className={`sticky top-[44px] lg:top-[52px] z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b border-border overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out lg:!max-h-none lg:!opacity-100 lg:!py-2 ${collapsed ? 'max-h-0 opacity-0 py-0 border-transparent' : 'max-h-[500px] opacity-100'}`}>
          <RadarFiltersBar
            state={filters}
            onChange={setFilters}
            totalCount={annotated.length}
            familyCounts={familyCounts}
            availableSubs={availableSubs}
            tierCounts={tierCounts}
            suggestions={suggestions}
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Ninguna posición coincide con los filtros.</p>
        </div>
      ) : (
        <>
          {dwTrades.length > 0 && (
            <BrokerSubsection
              broker="darwinex"
              trades={dwTrades}
              expandedId={expandedId}
              onToggleExpand={toggle}
              scannerSessions={scannerSessions ?? []}
            />
          )}
          {fxTrades.length > 0 && (
            <BrokerSubsection
              broker="octx"
              trades={fxTrades}
              expandedId={expandedId}
              onToggleExpand={toggle}
              scannerSessions={scannerSessions ?? []}
            />
          )}
        </>
      )}
      <p className="text-[11px] italic text-muted-foreground/70 leading-snug px-1">
        Las posiciones abiertas solo las cierra el SL. El scanner no tiene autoridad sobre trades ya abiertos.
      </p>
    </div>
  );
}

function BrokerSubsection({
  broker, trades, expandedId, onToggleExpand, scannerSessions,
}: {
  broker: 'darwinex' | 'octx';
  trades: Trade[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  scannerSessions: ScannerSessionLite[];
}) {
  const total = trades.reduce((s, t) => s + t.netPnl, 0);
  const headerColor = broker === 'darwinex'
    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
    : 'bg-orange-900/40 text-orange-300 border-orange-700/50';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${headerColor}`}>
          {broker === 'darwinex' ? 'NK' : 'OX'}
        </span>
        <span className="text-xs text-muted-foreground">{trades.length} pos</span>
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="px-3 py-3 w-[40px]"></th>
              <th className="text-left px-3 py-3">Symbol</th>
              <th className="text-left px-3 py-3 w-[80px]">Dir</th>
              <th className="text-left px-3 py-3 w-[90px]">Fecha</th>
              <th className="text-right px-3 py-3 w-[100px]">Entrada</th>
              <th className="text-right px-3 py-3 w-[100px]">SL</th>
              <th className="text-right px-3 py-3 w-[100px]">TP</th>
              <th className="text-right px-3 py-3 w-[110px]">P&L</th>
              <th className="text-left px-3 py-3 w-[200px]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <PositionRow
                key={t.id}
                trade={t}
                expanded={expandedId === t.id}
                onToggle={() => onToggleExpand(t.id)}
                scannerSessions={scannerSessions}
              />
            ))}
            <tr className="border-t-2 border-border bg-secondary/30">
              <td colSpan={7} className="px-3 py-3 text-sm font-semibold text-muted-foreground text-right">
                Total {broker === 'darwinex' ? 'NK' : 'OX'}
              </td>
              <td className={`px-3 py-3 text-right font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(total)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {trades.map(t => (
          <MobileRow
            key={t.id}
            trade={t}
            expanded={expandedId === t.id}
            onToggle={() => onToggleExpand(t.id)}
            scannerSessions={scannerSessions}
          />
        ))}
        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 text-xs">
          <span className="text-muted-foreground font-semibold">Total {broker === 'darwinex' ? 'NK' : 'OX'}</span>
          <span className={`font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ trade: t, scannerSessions: _ }: {
  trade: Trade;
  expanded?: boolean;
  onToggle?: () => void;
  scannerSessions: ScannerSessionLite[];
}) {
  const navigate = useNavigate();
  const journalDone = hasJournal(t);
  const alcista = t.direction === 'BUY';
  const rowBg = alcista
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';
  const meta = classifyInstrument(t.symbol);
  const assetBroker = t.broker === 'darwinex' || t.broker === 'nkis' ? 'nkis' : 'octx';

  return (
    <tr
      className={`border-b border-border transition-colors cursor-pointer ${rowBg}`}
      onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: assetBroker, symbol: t.symbol } })}
    >
      <td className="px-3 py-3 text-center">
        {journalDone
          ? <BookCheck className="w-4 h-4 text-success inline" />
          : <Circle className="w-4 h-4 text-muted-foreground inline" />}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-foreground">{t.symbol}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[260px]" title={meta.description}>{meta.description}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold ${
          alcista ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive'
        }`}>
          {alcista ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {t.direction}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {new Date(t.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
      </td>
      <td className="px-3 py-3 text-right font-data">{formatPrice(t.entryPrice)}</td>
      <td className="px-3 py-3 text-right font-data text-destructive/80">{formatPrice(t.slPrice)}</td>
      <td className="px-3 py-3 text-right font-data text-success/80">{formatPrice(t.tpPrice)}</td>
      <td className={`px-3 py-3 text-right font-data font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
        {formatCurrency(t.netPnl)}
      </td>
      <td className="px-3 py-3 text-sm text-muted-foreground">{tradeStatus(t)}</td>
    </tr>
  );
}

function InfoField({ label, value, mono, pnl }: { label: string; value: string; mono?: boolean; pnl?: number }) {
  const color = pnl !== undefined ? (pnl >= 0 ? 'text-success' : 'text-destructive') : 'text-foreground';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color} ${mono ? 'font-data' : ''}`}>{value}</span>
    </div>
  );
}

function MobileRow({ trade: t, scannerSessions: _ }: {
  trade: Trade;
  expanded?: boolean;
  onToggle?: () => void;
  scannerSessions: ScannerSessionLite[];
}) {
  const navigate = useNavigate();
  const journalDone = hasJournal(t);
  const alcista = t.direction === 'BUY';
  const assetBroker = t.broker === 'darwinex' || t.broker === 'nkis' ? 'nkis' : 'octx';

  return (
    <div
      className={`p-3 cursor-pointer ${alcista ? 'bg-success/10' : 'bg-destructive/10'}`}
      onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: assetBroker, symbol: t.symbol } })}
    >
      <div className="w-full flex items-center gap-2 flex-wrap text-left">
        {journalDone
          ? <BookCheck className="w-4 h-4 text-success shrink-0" />
          : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="font-bold text-sm">{t.symbol}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
          alcista ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {t.direction}
        </span>
        <span className={`ml-auto font-data font-bold text-sm ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
          {formatCurrency(t.netPnl)}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{tradeStatus(t)}</div>
      <div className="mt-1"><SymbolMeta symbol={t.symbol} compact /></div>
    </div>
  );
}
