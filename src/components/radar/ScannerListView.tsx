import { useMemo, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Eye, EyeOff, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useRadarCollapsed } from './radar-collapse-context';
import type { BrokerFilter } from '@/lib/trade-utils';
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
import { SortHeader, useSort } from './TableControls';
import { RadarFiltersBar, EMPTY_FILTERS, tierOfScore, matchSearch, buildSubsList, type RadarFilterState, type Tier, type Suggestion } from './RadarFiltersBar';
import { useWatchlist, useAddToWatchlist, useDeleteWatchlistItem } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';
import { toast } from 'sonner';

const TIER_META: Record<Tier, { label: string; accent: string }> = {
  elite:    { label: 'ÉLITE',    accent: 'border-l-primary text-primary' },
  solido:   { label: 'SÓLIDO',   accent: 'border-l-success text-success' },
  observar: { label: 'OBSERVAR', accent: 'border-l-muted-foreground text-muted-foreground' },
};

function isAlcistaDir(d: string) {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

const VIG_STATUS = 'Vigilancia';

export function useVigilanciaSet() {
  const { data } = useWatchlist();
  return useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach(w => {
      if ((w.status ?? '').toLowerCase() === VIG_STATUS.toLowerCase()) {
        s.add(`${w.symbol}::${w.broker ?? 'darwinex'}`);
      }
    });
    return s;
  }, [data]);
}

export function useVigilanciaCount(brokerFilter: BrokerFilter = 'all') {
  const all = useUnifiedInstruments(brokerFilter);
  return useMemo(() => all.filter(i => (i.score ?? 0) >= 60).length, [all]);
}

type SortKey = 'symbol' | 'name' | 'score' | 'direction' | 'broker' | 'price' | 'adx' | 'pend50' | 'stoch' | 'atr' | 'divergencia';

interface Props { brokerFilter: BrokerFilter }

export function ScannerListView({ brokerFilter }: Props) {
  const all = useUnifiedInstruments(brokerFilter);
  const collapsed = useRadarCollapsed();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);
  const sortApi = useSort<SortKey>({ key: null, dir: 'desc' });
  const vigSet = useVigilanciaSet();
  const { data: watchlist } = useWatchlist();
  const addWatch = useAddToWatchlist();
  const delWatch = useDeleteWatchlistItem();

  const annotated = useMemo(() => {
    return all.map(it => {
      const cls = classifyFamily(it.symbol);
      return { ...it, _family: cls?.family ?? null, _subfamily: cls?.subfamily ?? null };
    });
  }, [all]);

  // Global ranking by score (over ALL annotated, before any filter)
  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...annotated]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [annotated]);

  type Row = (typeof annotated)[number];

  const familyFiltered = useMemo(() => {
    return annotated.filter(a => {
      if (filters.family && a._family !== filters.family) return false;
      if (filters.subfamily && a._subfamily !== filters.subfamily) return false;
      return true;
    });
  }, [annotated, filters.family, filters.subfamily]);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { elite: 0, solido: 0, observar: 0 };
    for (const it of familyFiltered) c[tierOfScore(it.score)]++;
    return c;
  }, [familyFiltered]);

  const items = useMemo(() => {
    let arr = familyFiltered;
    if (filters.tier) arr = arr.filter(it => tierOfScore(it.score) === filters.tier);
    if (filters.search.trim()) {
      arr = arr.filter(it => matchSearch(filters.search, [it.symbol, classifyInstrument(it.symbol).description]));
    }
    const sort = sortApi.sort;
    if (sort.key) {
      const getters: Record<SortKey, (t: Row) => string | number | null | undefined> = {
        symbol: it => it.symbol,
        name: it => classifyInstrument(it.symbol).description,
        score: it => it.score,
        direction: it => it.direction,
        broker: it => it.broker,
        price: it => it.current_price,
        adx: it => it.adx_value,
        pend50: it => it.pend50_pct,
        stoch: it => it.stoch_k,
        atr: it => it.atr,
        divergencia: it => it.divergencia,
      };
      const g = getters[sort.key];
      const mult = sort.dir === 'asc' ? 1 : -1;
      arr = [...arr].sort((a, b) => {
        const va = g(a); const vb = g(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
        return String(va).localeCompare(String(vb)) * mult;
      });
    }
    return arr;
  }, [familyFiltered, filters.tier, filters.search, sortApi.sort]);

  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a._family) c[a._family] = (c[a._family] ?? 0) + 1;
    return c;
  }, [annotated]);

  const availableSubs = useMemo(() => buildSubsList(annotated, filters.family), [annotated, filters.family]);

  const suggestions: Suggestion[] = useMemo(() => {
    return annotated.map(it => ({
      value: it.symbol,
      label: it.symbol,
      description: classifyInstrument(it.symbol).description,
    }));
  }, [annotated]);

  const showTiers = sortApi.sort.key === null && !filters.tier;
  const sortedByScore = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items]);

  const groups: { tier: Tier; items: Row[] }[] = useMemo(() => {
    if (!showTiers) return [{ tier: (filters.tier ?? 'elite') as Tier, items }];
    const map: Record<Tier, Row[]> = { elite: [], solido: [], observar: [] };
    for (const it of sortedByScore) map[tierOfScore(it.score)].push(it);
    return (['elite', 'solido', 'observar'] as Tier[])
      .filter(t => map[t].length > 0)
      .map(t => ({ tier: t, items: map[t] }));
  }, [showTiers, items, sortedByScore, filters.tier]);

  const eliteRef = useRef<HTMLDivElement>(null);
  const solidoRef = useRef<HTMLDivElement>(null);
  const observarRef = useRef<HTMLDivElement>(null);

  const handleToggleWatch = (inst: UnifiedInstrument) => {
    const existing = (watchlist ?? []).find(
      w => w.symbol === inst.symbol && (w.broker ?? 'darwinex') === inst.broker
        && (w.status ?? '').toLowerCase() === VIG_STATUS.toLowerCase()
    );
    if (existing) {
      delWatch.mutate(existing.id, {
        onSuccess: () => toast.success(`${inst.symbol} retirado de Vigilancia`),
        onError: (e) => toast.error(`Error: ${(e as Error).message}`),
      });
    } else {
      addWatch.mutate({
        symbol: inst.symbol,
        broker: inst.broker,
        direction: inst.direction,
        watch_reason: null,
        stochastic_level: inst.stoch_k,
        scanner_score: inst.score,
        adx_value: inst.adx_value,
        adx_state: inst.adx_state,
        distance_to_ma50: inst.distance_to_ma50,
        status: VIG_STATUS,
        added_from_scanner: true,
        trade_id: null,
      }, {
        onSuccess: () => toast.success(`${inst.symbol} añadido a Vigilancia`),
        onError: (e) => toast.error(`Error: ${(e as Error).message}`),
      });
    }
  };

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

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-center px-3 py-3 w-[50px]">#</th>
                <SortHeader label="Score" sortKey="score" state={sortApi.sort} onToggle={sortApi.toggle} align="center" className="w-[80px]" />
                <SortHeader label="Ticker" sortKey="symbol" state={sortApi.sort} onToggle={sortApi.toggle} className="w-[120px]" />
                <SortHeader label="Nombre" sortKey="name" state={sortApi.sort} onToggle={sortApi.toggle} />
                <SortHeader label="Dir" sortKey="direction" state={sortApi.sort} onToggle={sortApi.toggle} className="w-[70px]" />
                <SortHeader label="Cuenta" sortKey="broker" state={sortApi.sort} onToggle={sortApi.toggle} align="center" className="w-[70px]" />
                <SortHeader label="Precio" sortKey="price" state={sortApi.sort} onToggle={sortApi.toggle} align="right" className="w-[90px]" />
                <SortHeader label="ATR" sortKey="atr" state={sortApi.sort} onToggle={sortApi.toggle} className="w-[80px]" />
                <SortHeader label="Pend50" sortKey="pend50" state={sortApi.sort} onToggle={sortApi.toggle} align="right" className="w-[80px]" />
                <SortHeader label="Stoch" sortKey="stoch" state={sortApi.sort} onToggle={sortApi.toggle} className="w-[90px]" />
                <SortHeader label="ADX" sortKey="adx" state={sortApi.sort} onToggle={sortApi.toggle} className="w-[90px]" />
                <SortHeader label="Div" sortKey="divergencia" state={sortApi.sort} onToggle={sortApi.toggle} className="w-[70px]" />
                <th className="text-center px-3 py-3 w-[50px]">👁</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const meta = TIER_META[g.tier];
                return (
                  <FragmentRows key={`g-${gi}-${g.tier}`}>
                    {showTiers && (
                      <tr ref={g.tier === 'elite' ? (eliteRef as unknown as React.Ref<HTMLTableRowElement>) : g.tier === 'solido' ? (solidoRef as unknown as React.Ref<HTMLTableRowElement>) : (observarRef as unknown as React.Ref<HTMLTableRowElement>)}
                          className="bg-secondary/20 scroll-mt-40">
                        <td colSpan={13} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold border-t border-l-4 border-border ${meta.accent}`}>
                          {meta.label} — {g.items.length} instrumento{g.items.length === 1 ? '' : 's'}
                        </td>
                      </tr>
                    )}
                    {g.items.map((inst) => {
                      const key = `${inst.symbol}::${inst.broker}`;
                      const rank = globalRanks.get(key) ?? 0;
                      const watched = vigSet.has(key);
                      return (
                        <DesktopRow
                          key={key}
                          inst={inst}
                          rank={rank}
                          watched={watched}
                          onToggleWatch={() => handleToggleWatch(inst)}
                        />
                      );
                    })}
                  </FragmentRows>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          {groups.map((g, gi) => {
            const meta = TIER_META[g.tier];
            return (
              <div key={`m-${gi}-${g.tier}`}>
                {showTiers && (
                  <div ref={g.tier === 'elite' ? eliteRef : g.tier === 'solido' ? solidoRef : observarRef}
                       className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold border-t border-l-4 bg-secondary/30 border-border scroll-mt-40 ${meta.accent}`}>
                    {meta.label} — {g.items.length}
                  </div>
                )}
                <div className="divide-y divide-border">
                  {g.items.map((inst) => {
                    const key = `${inst.symbol}::${inst.broker}`;
                    const rank = globalRanks.get(key) ?? 0;
                    const watched = vigSet.has(key);
                    return (
                      <MobileRow
                        key={key}
                        inst={inst}
                        rank={rank}
                        watched={watched}
                        onToggleWatch={() => handleToggleWatch(inst)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}


function WatchToggle({ watched, onClick }: { watched: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={watched ? 'Quitar de Vigilancia' : 'Añadir a Vigilancia'}
      className={`inline-flex items-center justify-center w-7 h-7 rounded border transition-colors ${
        watched
          ? 'bg-primary/20 text-primary border-primary/40 hover:bg-primary/30'
          : 'bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40'
      }`}
    >
      {watched ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
    </button>
  );
}

function DesktopRow({ inst, rank, watched, onToggleWatch }: { inst: UnifiedInstrument; rank: number; watched: boolean; onToggleWatch: () => void }) {
  const alcista = isAlcistaDir(inst.direction);
  const meta = classifyInstrument(inst.symbol);
  const div = inst.divergencia;
  const showDiv = div === 'BAJISTA' || div === 'ALCISTA';
  const rowBg = alcista
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';
  return (
    <tr className={`border-b border-border transition-colors ${rowBg}`}>
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
      <td className="px-3 py-3 text-center"><WatchToggle watched={watched} onClick={onToggleWatch} /></td>
    </tr>
  );
}

function MobileRow({ inst, rank, watched, onToggleWatch }: { inst: UnifiedInstrument; rank: number; watched: boolean; onToggleWatch: () => void }) {
  const alcista = isAlcistaDir(inst.direction);
  const est = estructuraMeta(inst.estructura);
  return (
    <div className={`p-3 ${watched ? 'bg-primary/5' : ''}`}>
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
        <span className="ml-auto"><WatchToggle watched={watched} onClick={onToggleWatch} /></span>
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
  const all = useUnifiedInstruments(brokerFilter);
  const collapsed = useRadarCollapsed();
  const { openTrades } = useAllTrades();
  const openSymbols = useMemo(() => new Set(openTrades.map(t => t.symbol)), [openTrades]);
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);

  const annotated = useMemo(() => {
    return all.filter(i => (i.score ?? 0) >= 60).map(it => {
      const cls = classifyFamily(it.symbol);
      return { ...it, _family: cls?.family ?? null, _subfamily: cls?.subfamily ?? null };
    });
  }, [all]);

  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...all]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [all]);

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
                <tr key={key} className={`border-b border-border transition-colors ${rowBg}`}>
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
            <div key={key} className={`p-3 ${isOpen ? 'bg-success/5' : ''}`}>
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

