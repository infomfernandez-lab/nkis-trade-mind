import { useMemo, useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TrendingUp, TrendingDown, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useRadarCollapsed } from './radar-collapse-context';
import type { BrokerFilter } from '@/lib/trade-utils';

function brokerToAssetBroker(b: string | null | undefined): string {
  const v = (b ?? '').toLowerCase();
  if (v === 'darwinex' || v === 'nkis') return 'nkis';
  return 'octx';
}
import {
  useUnifiedInstruments,
  type UnifiedInstrument,
  SymbolName,
  SymbolMeta,
  PriceCell,
  PriceTag,
  ScoreBadge,
  AdxCell,
  Pend50Cell,
  StochCell,
  AtrValueCell,
  estructuraMeta,
} from './EnTendenciaBlock';
import { classifyFamily, type Family } from '@/lib/instrument-family';
import { classifyInstrument } from '@/lib/instrument-classify';
import { RadarFiltersBar, EMPTY_FILTERS, tierOfScore, matchSearch, buildSubsList, type RadarFilterState, type Tier, type Suggestion } from './RadarFiltersBar';
import {
  AssetsStyleFiltersBar,
  EMPTY_SCANNER_FILTERS,
  aggregateTradesByKey,
  VOL_RANK,
  type ScannerFilterState,
} from './AssetsStyleFiltersBar';
import { useAssetMap } from '@/hooks/use-asset-map';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';


const TIER_META: Record<Tier, { label: string; accent: string }> = {
  elite:    { label: 'ÉLITE',    accent: 'border-l-primary text-primary' },
  solido:   { label: 'SÓLIDO',   accent: 'border-l-success text-success' },
  observar: { label: 'OBSERVAR', accent: 'border-l-muted-foreground text-muted-foreground' },
};

function isAlcistaDir(d: string) {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

/** Watchlist EA = lista CAP elite que el EA realmente vigila (sync-ea-watchlist). */
export function useEaWatchSet(brokerFilter: BrokerFilter = 'all') {
  const { data } = useWatchlist();
  return useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach(w => {
      if ((w.watch_reason ?? '') !== 'EA') return;
      const b = (w.broker ?? 'darwinex').toLowerCase();
      if (brokerFilter !== 'all' && b !== brokerFilter) return;
      s.add(`${w.symbol}::${b}`);
    });
    return s;
  }, [data, brokerFilter]);
}

export function useVigilanciaCount(brokerFilter: BrokerFilter = 'all') {
  return useEaWatchSet(brokerFilter).size;
}

interface Props { brokerFilter: BrokerFilter }

export function ScannerListView({ brokerFilter }: Props) {
  const all = useUnifiedInstruments(brokerFilter);
  const collapsed = useRadarCollapsed();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ScannerFilterState>(EMPTY_SCANNER_FILTERS);

  const assetMap = useAssetMap();
  const { openTrades, closedTrades } = useAllTrades();
  const tradeAgg = useMemo(
    () => aggregateTradesByKey([...openTrades, ...closedTrades]),
    [openTrades, closedTrades],
  );


  // Anota cada instrumento con mercado/sector compartido con Activos.
  const annotated = useMemo(() => {
    return all.map(it => {
      const c = assetMap.classify(it.symbol);
      return { ...it, _mercado: c.mercado, _sector: c.sector };
    });
  }, [all, assetMap]);

  type Row = (typeof annotated)[number];

  // Ranking global por score (sobre todo el escáner, antes de filtrar).
  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...annotated]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [annotated]);

  const mercados = useMemo(() => {
    const s = new Set<string>();
    annotated.forEach(a => { if (a._mercado) s.add(a._mercado); });
    return Array.from(s).sort();
  }, [annotated]);

  const sectores = useMemo(() => {
    const s = new Set<string>();
    annotated.forEach(a => {
      if (filters.mercado !== 'all' && a._mercado !== filters.mercado) return;
      if (a._sector) s.add(a._sector);
    });
    return Array.from(s).sort();
  }, [annotated, filters.mercado]);

  const aggFor = (r: Row) => tradeAgg.get(`${r.symbol}|${r.broker}`);

  const items = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    const filtered = annotated.filter(a => {
      if (filters.mercado !== 'all' && a._mercado !== filters.mercado) return false;
      if (filters.sector !== 'all' && a._sector !== filters.sector) return false;

      const dir = (a.direction ?? '').toLowerCase();
      const isAlc = dir === 'alcista' || dir === 'buy';
      const isBaj = dir === 'bajista' || dir === 'sell';
      if (filters.dir === 'ALCISTA' && !isAlc) return false;
      if (filters.dir === 'BAJISTA' && !isBaj) return false;

      if (q && !a.symbol.toUpperCase().includes(q)
            && !classifyInstrument(a.symbol).description.toUpperCase().includes(q)) return false;

      if (filters.strongTrend && !(Number(a.adx_value ?? 0) >= 25)) return false;

      if (filters.vol !== 'all') {
        const v = (a.atr_estado ?? '').toString().toUpperCase();
        if (filters.vol === 'high' && !(v === 'ELEVADA' || v === 'ANORMAL')) return false;
        if (filters.vol === 'normal' && !(v === 'BAJA' || v === 'COHERENTE')) return false;
      }

      if (filters.trade !== 'all') {
        const agg = aggFor(a);
        if (!agg) return false;
        if (filters.trade === 'open' && agg.openCount === 0) return false;
        if (filters.trade === 'recent_closed' && agg.recentClosedCount === 0) return false;
        if (filters.trade === 'winners' && !(agg.closedPnl > 0)) return false;
        if (filters.trade === 'losers' && !(agg.closedPnl < 0)) return false;
      }
      return true;
    });

    const num = (x: number | null | undefined) => (x == null ? -Infinity : Number(x));
    const cmp = (a: Row, b: Row): number => {
      const aAgg = aggFor(a);
      const bAgg = aggFor(b);
      switch (filters.sort) {
        case 'score_desc': return num(b.score) - num(a.score);
        case 'score_asc':  return num(a.score) - num(b.score);
        case 'adx_desc':   return num(b.adx_value) - num(a.adx_value);
        case 'vol_desc': {
          const av = VOL_RANK[(a.atr_estado ?? '').toString().toUpperCase()] ?? 0;
          const bv = VOL_RANK[(b.atr_estado ?? '').toString().toUpperCase()] ?? 0;
          return bv - av;
        }
        case 'pnl_desc':   return (bAgg?.closedPnl ?? -Infinity) - (aAgg?.closedPnl ?? -Infinity);
        case 'pnl_asc':    return (aAgg?.closedPnl ?? Infinity) - (bAgg?.closedPnl ?? Infinity);
        case 'recent_close': return (bAgg?.lastExit ?? 0) - (aAgg?.lastExit ?? 0);
      }
    };
    return [...filtered].sort(cmp);
  }, [annotated, filters, tradeAgg]);

  if (all.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Sin instrumentos en el escáner. Sincroniza desde MT5.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile toggle button — solo visible <md */}
      <button
        type="button"
        onClick={() => setMobileFiltersOpen(o => !o)}
        className="md:hidden inline-flex items-center gap-2 px-3 h-8 rounded-md border border-border bg-card text-xs font-medium hover:border-primary/40"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Filtros y búsqueda</span>
        {mobileFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Filtros — sticky para mantener acceso al hacer scroll. Oculto en móvil hasta tocar el botón. */}
      <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block sticky top-[44px] lg:top-[52px] z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b border-border overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out lg:!max-h-none lg:!opacity-100 lg:!py-2 ${collapsed ? 'max-h-0 opacity-0 py-0 border-transparent' : 'max-h-[500px] opacity-100'}`}>
        <AssetsStyleFiltersBar
          state={filters}
          onChange={setFilters}
          mercados={mercados}
          sectores={sectores}
          countLabel={`${items.length} de ${annotated.length}`}
        />
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Ningún instrumento coincide con los filtros.</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-muted/40 border-b border-border">
                  <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-center px-3 py-3 w-[50px]">#</th>
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
                  </tr>
                </thead>
                <tbody>
                  {items.map((inst) => {
                    const key = `${inst.symbol}::${inst.broker}`;
                    const rank = globalRanks.get(key) ?? 0;
                    return <DesktopRow key={key} inst={inst} rank={rank} />;
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border">
              {items.map((inst) => {
                const key = `${inst.symbol}::${inst.broker}`;
                const rank = globalRanks.get(key) ?? 0;
                return <MobileRow key={key} inst={inst} rank={rank} />;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}




function DesktopRow({ inst, rank }: { inst: UnifiedInstrument; rank: number }) {
  const navigate = useNavigate();
  const alcista = isAlcistaDir(inst.direction);
  const meta = classifyInstrument(inst.symbol);
  const div = inst.divergencia;
  const showDiv = div === 'BAJISTA' || div === 'ALCISTA';
  const rowBg = alcista
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';
  return (
    <tr
      className={`border-b border-border transition-colors cursor-pointer ${rowBg}`}
      onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: brokerToAssetBroker(inst.broker), symbol: inst.symbol } })}
    >
      <td className="px-3 py-3 font-data text-center text-muted-foreground font-bold">#{rank}</td>
      <td className="px-3 py-3 text-center"><ScoreBadge score={inst.score} /></td>
      <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">{inst.symbol}</td>
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
          {alcista ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
          inst.broker === 'darwinex' ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
        }`}>{inst.broker === 'darwinex' ? 'NK' : 'OX'}</span>
      </td>
      <td className="px-3 py-3 text-right"><PriceCell price={inst.current_price} /></td>
      <td className="px-3 py-3"><AtrValueCell inst={inst} /></td>
      <td className="px-3 py-3"><Pend50Cell inst={inst} /></td>
      <td className="px-3 py-3"><StochCell inst={inst} /></td>
      <td className="px-3 py-3"><AdxCell inst={inst} /></td>
      <td className="px-3 py-3">
        {showDiv ? (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            div === 'BAJISTA'
              ? 'bg-destructive/30 text-destructive'
              : 'bg-success/30 text-success'
          }`}>
            {div === 'BAJISTA' ? '↘ BAJ' : '↗ ALC'}
          </span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
    </tr>
  );
}

function MobileRow({ inst, rank }: { inst: UnifiedInstrument; rank: number }) {
  const navigate = useNavigate();
  const alcista = isAlcistaDir(inst.direction);
  const est = estructuraMeta(inst.estructura);
  return (
    <div
      className="p-3 cursor-pointer hover:bg-accent/30"
      onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: brokerToAssetBroker(inst.broker), symbol: inst.symbol } })}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-data font-bold text-sm text-muted-foreground">#{rank}</span>
        <span className="font-bold text-sm text-foreground inline-flex items-center gap-1.5"><SymbolName symbol={inst.symbol} /></span>
        <ScoreBadge score={inst.score} />
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {alcista ? 'BUY' : 'SELL'}
        </span>
        <PriceTag price={inst.current_price} compact />
      </div>
      <div className="mt-1"><SymbolMeta symbol={inst.symbol} compact /></div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <div className="flex justify-between"><span className="text-muted-foreground">ADX</span><span><AdxCell inst={inst} /></span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Pend50</span><span><Pend50Cell inst={inst} /></span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Estruct</span><span className={`font-bold ${est.color}`}>{est.icon} {est.label}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Stoch</span><span><StochCell inst={inst} /></span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">ATR</span><span><AtrValueCell inst={inst} /></span></div>
      </div>
    </div>
  );
}

/* ─────────────── Vigilancia view ─────────────── */

interface VigProps { brokerFilter: BrokerFilter; collapsible?: boolean; initialLimit?: number }

export function VigilanciaView({ brokerFilter, collapsible = false, initialLimit = 5 }: VigProps) {
  const scanner = useUnifiedInstruments(brokerFilter);
  const collapsed = useRadarCollapsed();
  const navigate = useNavigate();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { openTrades } = useAllTrades();
  const openSymbols = useMemo(() => new Set(openTrades.map(t => t.symbol)), [openTrades]);
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);

  // Fuente real de Vigilancia EA: watchlist con watch_reason='EA' (sincronizado
  // desde el EA — archivo CAP_ELITE.csv). No mostrar nada que el EA no vigile.
  const { data: watchRows = [] } = useWatchlist();

  const eaList = useMemo(() => {
    const scannerMap = new Map<string, UnifiedInstrument>();
    for (const i of scanner) scannerMap.set(`${i.symbol}::${i.broker}`, i);

    const seen = new Set<string>();
    const out: UnifiedInstrument[] = [];
    for (const w of watchRows) {
      if ((w.watch_reason ?? '') !== 'EA') continue;
      const broker = ((w.broker ?? 'darwinex').toLowerCase() === 'octx' ? 'octx' : 'darwinex') as 'darwinex' | 'octx';
      if (brokerFilter !== 'all' && broker !== brokerFilter) continue;
      const key = `${w.symbol}::${broker}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = scannerMap.get(key);
      if (hit) {
        out.push(hit);
      } else {
        // Activo vigilado por el EA pero sin datos del último escáner.
        out.push({
          symbol: w.symbol,
          direction: w.direction || 'alcista',
          score: w.scanner_score ?? 0,
          adx_value: w.adx_value,
          adx_state: w.adx_state,
          distance_to_ma50: w.distance_to_ma50,
          pend50_pct: null,
          estructura: null,
          divergencia: null,
          atr_estado: null,
          stoch_subiendo: null,
          pullback_active: false,
          pullback_bars: null,
          stoch_k: w.stochastic_level,
          stoch_estado: null,
          atr: null,
          structure: null,
          breakout: null,
          volume: null,
          current_price: null,
          broker,
        });
      }
    }
    return out;
  }, [watchRows, scanner, brokerFilter]);

  const annotated = useMemo(() => {
    return eaList.map(it => {
      const cls = classifyFamily(it.symbol);
      return { ...it, _family: cls?.family ?? null, _subfamily: cls?.subfamily ?? null };
    });
  }, [eaList]);

  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...scanner]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [scanner]);

  const familyFiltered = useMemo(() => annotated.filter(a => {
    if (filters.family && a._family !== filters.family) return false;
    if (filters.subfamily && a._subfamily !== filters.subfamily) return false;
    return true;
  }), [annotated, filters.family, filters.subfamily]);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { elite: 0, solido: 0, observar: 0 };
    for (const it of familyFiltered) c[tierOfScore(it.score)]++;
    return c;
  }, [familyFiltered]);

  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a._family) c[a._family] = (c[a._family] ?? 0) + 1;
    return c;
  }, [annotated]);

  const availableSubs = useMemo(() => buildSubsList(annotated, filters.family), [annotated, filters.family]);

  const suggestions: Suggestion[] = useMemo(
    () => annotated.map(it => ({ value: it.symbol, label: it.symbol, description: classifyInstrument(it.symbol).description })),
    [annotated],
  );

  const allItems = useMemo(() => {
    let arr = familyFiltered;
    if (filters.tier) arr = arr.filter(it => tierOfScore(it.score) === filters.tier);
    if (filters.search.trim()) {
      arr = arr.filter(it => matchSearch(filters.search, [it.symbol, classifyInstrument(it.symbol).description]));
    }
    return [...arr].sort((a, b) => b.score - a.score);
  }, [familyFiltered, filters.tier, filters.search]);

  const items = collapsible && !expanded ? allItems.slice(0, initialLimit) : allItems;
  const hiddenCount = allItems.length - items.length;

  const noScannerData = annotated.length === 0;

  return (
    <div className="space-y-3">
      {!collapsible && (
        <>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(o => !o)}
            className="md:hidden inline-flex items-center gap-2 px-3 h-8 rounded-md border border-border bg-card text-xs font-medium hover:border-primary/40"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros y búsqueda</span>
            {mobileFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block sticky top-[44px] lg:top-[52px] z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b border-border overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out lg:!max-h-none lg:!opacity-100 lg:!py-2 ${collapsed ? 'max-h-0 opacity-0 py-0 border-transparent' : 'max-h-[500px] opacity-100'}`}>
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
        </>
      )}

      {noScannerData ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">El EA no está vigilando ningún instrumento ahora mismo (sin scores ≥ 60 en el último escáner).</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Ningún instrumento coincide con los filtros.</p>
        </div>
      ) : (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Desktop — mismas columnas que Escaneado */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-center px-3 py-3 w-[50px]">#</th>
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
              <th className="text-center px-3 py-3 w-[110px]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inst) => {
              const key = `${inst.symbol}::${inst.broker}`;
              const rank = globalRanks.get(key) ?? 0;
              const isOpen = openSymbols.has(inst.symbol);
              const alcista = isAlcistaDir(inst.direction);
              const meta = classifyInstrument(inst.symbol);
              const div = inst.divergencia;
              const showDiv = div === 'BAJISTA' || div === 'ALCISTA';
              const rowBg = alcista
                ? 'bg-success/15 hover:bg-success/25'
                : 'bg-destructive/15 hover:bg-destructive/25';
              return (
                <tr
                  key={key}
                  onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: brokerToAssetBroker(inst.broker), symbol: inst.symbol } })}
                  className={`border-b border-border transition-colors cursor-pointer ${rowBg}`}
                >
                  <td className="px-3 py-3 font-data text-center text-muted-foreground font-bold">#{rank}</td>
                  <td className="px-3 py-3 text-center"><ScoreBadge score={inst.score} /></td>
                  <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">{inst.symbol}</td>
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
                      {alcista ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                      inst.broker === 'darwinex' ? 'bg-blue-500/20 text-blue-300 border-blue-400/40' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
                    }`}>{inst.broker === 'darwinex' ? 'NK' : 'OX'}</span>
                  </td>
                  <td className="px-3 py-3 text-right"><PriceCell price={inst.current_price} /></td>
                  <td className="px-3 py-3"><AtrValueCell inst={inst} /></td>
                  <td className="px-3 py-3"><Pend50Cell inst={inst} /></td>
                  <td className="px-3 py-3"><StochCell inst={inst} /></td>
                  <td className="px-3 py-3"><AdxCell inst={inst} /></td>
                  <td className="px-3 py-3">
                    {showDiv ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        div === 'BAJISTA' ? 'bg-destructive/30 text-destructive' : 'bg-success/30 text-success'
                      }`}>
                        {div === 'BAJISTA' ? '↘ BAJ' : '↗ ALC'}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {isOpen ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-success/30 text-success">ABIERTA</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-secondary text-muted-foreground border border-border">EN ESPERA</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {items.map((inst) => {
          const key = `${inst.symbol}::${inst.broker}`;
          const rank = globalRanks.get(key) ?? 0;
          const isOpen = openSymbols.has(inst.symbol);
          const alcista = isAlcistaDir(inst.direction);
          return (
            <div
              key={key}
              onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: brokerToAssetBroker(inst.broker), symbol: inst.symbol } })}
              className={`p-3 cursor-pointer hover:bg-accent/30 ${isOpen ? 'bg-success/5' : ''}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-data font-bold text-sm text-muted-foreground">#{rank}</span>
                <ScoreBadge score={inst.score} />
                <span className="font-bold text-sm inline-flex items-center gap-1.5"><SymbolName symbol={inst.symbol} /></span>
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
                }`}>
                  {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {alcista ? 'BUY' : 'SELL'}
                </span>
                <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  isOpen ? 'bg-success/20 text-success border-success/40' : 'bg-secondary text-muted-foreground border-border'
                }`}>{isOpen ? 'ABIERTA' : 'EN ESPERA'}</span>
              </div>
              <div className="mt-1"><SymbolMeta symbol={inst.symbol} compact /></div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Precio</span><PriceTag price={inst.current_price} compact /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ATR</span><span><AtrValueCell inst={inst} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pend50</span><span><Pend50Cell inst={inst} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stoch</span><span><StochCell inst={inst} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ADX</span><span><AdxCell inst={inst} /></span></div>
              </div>
            </div>
          );
        })}
      </div>

      {collapsible && allItems.length > initialLimit && (
        <div className="border-t border-border p-2 text-center">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs font-semibold text-primary hover:underline px-3 py-1"
          >
            {expanded ? 'Ver menos' : `Ver todos (${hiddenCount} más)`}
          </button>
        </div>
      )}
    </div>
      )}
    </div>
  );
}

