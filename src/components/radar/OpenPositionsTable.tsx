import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import {
  SymbolMeta,
  useUnifiedInstruments,
  type UnifiedInstrument,
  ScoreBadge,
  PriceCell,
  PriceTag,
  AdxCell,
  Pend50Cell,
  StochCell,
  AtrValueCell,
} from './EnTendenciaBlock';
import { classifyInstrument } from '@/lib/instrument-classify';
import { classifyFamily, type Family } from '@/lib/instrument-family';
import { RadarFiltersBar, EMPTY_FILTERS, tierOfScore, matchSearch, buildSubsList, type RadarFilterState, type Tier, type Suggestion } from './RadarFiltersBar';
import { useRadarCollapsed } from './radar-collapse-context';

interface Props {
  brokerFilter: BrokerFilter;
  compact?: boolean;
}

export function OpenPositionsTable({ brokerFilter, compact = false }: Props) {
  const { openTrades, isLoading } = useAllTrades();
  const collapsed = useRadarCollapsed();
  const filteredAll = filterByBroker(openTrades, brokerFilter);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);

  // Scanner instruments para enriquecer las filas con las mismas columnas que Escaneado
  const scannerAll = useUnifiedInstruments(brokerFilter);
  const scannerMap = useMemo(() => {
    const m = new Map<string, UnifiedInstrument>();
    for (const it of scannerAll) m.set(`${it.symbol}::${it.broker}`, it);
    return m;
  }, [scannerAll]);

  // Anotar cada trade con su instrumento de scanner (si existe) + familia + tier
  const annotated = useMemo(() => filteredAll.map(t => {
    const cls = classifyFamily(t.symbol);
    const inst = scannerMap.get(`${t.symbol}::${t.broker}`) ?? null;
    return {
      trade: t,
      inst,
      _family: cls?.family ?? null,
      _subfamily: cls?.subfamily ?? null,
      _score: inst?.score ?? null,
      _tier: inst?.score != null ? tierOfScore(inst.score) : null,
    };
  }), [filteredAll, scannerMap]);

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
    return arr;
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

  const dwRows = filtered.filter(a => a.trade.broker === 'darwinex');
  const fxRows = filtered.filter(a => a.trade.broker === 'octx');

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
          {dwRows.length > 0 && <BrokerSubsection broker="darwinex" rows={dwRows} />}
          {fxRows.length > 0 && <BrokerSubsection broker="octx" rows={fxRows} />}
        </>
      )}
      <p className="text-[11px] italic text-muted-foreground/70 leading-snug px-1">
        Las posiciones abiertas solo las cierra el SL. El scanner no tiene autoridad sobre trades ya abiertos.
      </p>
    </div>
  );
}

type Row = { trade: Trade; inst: UnifiedInstrument | null };

function BrokerSubsection({ broker, rows }: { broker: 'darwinex' | 'octx'; rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r.trade.netPnl, 0);
  const headerColor = broker === 'darwinex'
    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
    : 'bg-orange-900/40 text-orange-300 border-orange-700/50';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${headerColor}`}>
          {broker === 'darwinex' ? 'NK' : 'OX'}
        </span>
        <span className="text-xs text-muted-foreground">{rows.length} pos</span>
      </div>

      {/* Desktop — mismas columnas que Escaneado */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-center px-3 py-3 w-[80px]">Score</th>
              <th className="text-left px-3 py-3 w-[120px]">Ticker</th>
              <th className="text-left px-3 py-3">Nombre</th>
              <th className="text-left px-3 py-3 w-[70px]">Dir</th>
              <th className="text-center px-3 py-3 w-[70px]">Cuenta</th>
              <th className="text-right px-3 py-3 w-[90px]">Precio</th>
              <th className="text-left px-3 py-3 w-[80px]">ATR</th>
              <th className="text-right px-3 py-3 w-[80px]">Pend50</th>
              <th className="text-left px-3 py-3 w-[90px]">Stoch</th>
              <th className="text-left px-3 py-3 w-[90px]">ADX</th>
              <th className="text-left px-3 py-3 w-[70px]">Div</th>
              <th className="text-right px-3 py-3 w-[100px]">P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ trade: t, inst }) => {
              const alcista = t.direction === 'BUY';
              const meta = classifyInstrument(t.symbol);
              const div = inst?.divergencia;
              const showDiv = div === 'BAJISTA' || div === 'ALCISTA';
              const rowBg = alcista
                ? 'bg-success/15 hover:bg-success/25'
                : 'bg-destructive/15 hover:bg-destructive/25';
              const price = inst?.current_price ?? t.entryPrice;
              return (
                <tr key={t.id} className={`border-b border-border transition-colors ${rowBg}`}>
                  <td className="px-3 py-3 text-center">
                    {inst ? <ScoreBadge score={inst.score} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">{t.symbol}</td>
                  <td className="px-3 py-3 text-foreground">
                    <div className="flex flex-col leading-tight">
                      <span className="truncate max-w-[260px]" title={meta.description}>{meta.description}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>{meta.flag}</span><span>{meta.country}</span>
                      </span>
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
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                      t.broker === 'darwinex' ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
                    }`}>{t.broker === 'darwinex' ? 'NK' : 'OX'}</span>
                  </td>
                  <td className="px-3 py-3 text-right"><PriceCell price={price} /></td>
                  <td className="px-3 py-3">{inst ? <AtrValueCell inst={inst} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">{inst ? <Pend50Cell inst={inst} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">{inst ? <StochCell inst={inst} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">{inst ? <AdxCell inst={inst} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">
                    {showDiv ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        div === 'BAJISTA' ? 'bg-destructive/30 text-destructive' : 'bg-success/30 text-success'
                      }`}>
                        {div === 'BAJISTA' ? '↘ BAJ' : '↗ ALC'}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className={`px-3 py-3 text-right font-data font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(t.netPnl)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-border bg-secondary/30">
              <td colSpan={11} className="px-3 py-3 text-sm font-semibold text-muted-foreground text-right">Total {broker === 'darwinex' ? 'NK' : 'OX'}</td>
              <td className={`px-3 py-3 text-right font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {rows.map(({ trade: t, inst }) => <MobileRow key={t.id} trade={t} inst={inst} />)}
        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 text-xs">
          <span className="text-muted-foreground font-semibold">Total {broker === 'darwinex' ? 'NK' : 'OX'}</span>
          <span className={`font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

function MobileRow({ trade: t, inst }: { trade: Trade; inst: UnifiedInstrument | null }) {
  const [open, setOpen] = useState(false);
  const alcista = t.direction === 'BUY';
  return (
    <div className={`p-3 ${alcista ? 'bg-success/10' : 'bg-destructive/10'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 flex-wrap">
        {inst && <ScoreBadge score={inst.score} />}
        <span className="font-bold text-sm">{t.symbol}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
          alcista ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {t.direction}
        </span>
        <span className={`ml-auto font-data font-bold text-sm ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className="mt-1"><SymbolMeta symbol={t.symbol} compact /></div>
      {open && inst && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Precio</span><PriceTag price={inst.current_price} compact /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">ATR</span><span><AtrValueCell inst={inst} /></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pend50</span><span><Pend50Cell inst={inst} /></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stoch</span><span><StochCell inst={inst} /></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">ADX</span><span><AdxCell inst={inst} /></span></div>
        </div>
      )}
    </div>
  );
}
