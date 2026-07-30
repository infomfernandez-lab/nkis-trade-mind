import { useState, useMemo, useEffect } from 'react';
import { CONTRACT_SPECS } from '@/lib/contract-specs';
import { useUnifiedInstruments } from '@/components/radar/EnTendenciaBlock';
import { RadarFiltersBar, EMPTY_FILTERS, tierOfScore, matchSearch, buildSubsList, type RadarFilterState, type Tier, type Suggestion } from '@/components/radar/RadarFiltersBar';
import { classifyFamily, type Family } from '@/lib/instrument-family';
import { classifyInstrument } from '@/lib/instrument-classify';

type BrokerKey = 'nkis' | 'octx';

export function RadarSymbolPicker({ broker, selected, onSelect }: {
  broker: BrokerKey;
  selected: string;
  onSelect: (s: string) => void;
}) {
  const brokerFilter = broker === 'nkis' ? 'darwinex' : 'octx';
  const scanner = useUnifiedInstruments(brokerFilter);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);

  // Todos los instrumentos del broker (no solo los del escáner).
  // Los que están en el escáner conservan su score/dirección; el resto se añade
  // al final con score 0 para que igualmente se puedan backtestear.
  const all = useMemo(() => {
    const bySymbol = new Map<string, (typeof scanner)[number]>();
    for (const it of scanner) bySymbol.set(it.symbol.toUpperCase(), it);
    const extra = CONTRACT_SPECS
      .filter(s => s.broker === broker)
      .filter(s => !bySymbol.has(s.symbol.toUpperCase()))
      .map(s => ({
        symbol: s.symbol,
        broker: brokerFilter,
        direction: null,
        score: 0,
      } as unknown as (typeof scanner)[number]));
    const seen = new Set<string>();
    return [...scanner, ...extra].filter(it => {
      const k = it.symbol.toUpperCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [scanner, broker, brokerFilter]);

  const annotated = useMemo(() => all.map(it => {
    const cls = classifyFamily(it.symbol);
    return { ...it, _family: cls?.family ?? null, _subfamily: cls?.subfamily ?? null };
  }), [all]);

  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a._family) c[a._family] = (c[a._family] ?? 0) + 1;
    return c;
  }, [annotated]);

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

  const items = useMemo(() => {
    let arr = familyFiltered;
    if (filters.tier) arr = arr.filter(it => tierOfScore(it.score) === filters.tier);
    if (filters.search.trim()) {
      arr = arr.filter(it => matchSearch(filters.search, [it.symbol, classifyInstrument(it.symbol).description]));
    }
    return [...arr].sort((a, b) => b.score - a.score);
  }, [familyFiltered, filters.tier, filters.search]);

  const availableSubs = useMemo(() => buildSubsList(annotated, filters.family), [annotated, filters.family]);

  const suggestions: Suggestion[] = useMemo(() => annotated.map(it => ({
    value: it.symbol,
    label: it.symbol,
    description: classifyInstrument(it.symbol).description,
  })), [annotated]);

  // Si el usuario teclea (o elige una sugerencia) un símbolo exacto del radar, lo seleccionamos
  useEffect(() => {
    const q = filters.search.trim().toUpperCase();
    if (!q) return;
    const exact = annotated.find(a => a.symbol.toUpperCase() === q);
    if (exact && exact.symbol !== selected) onSelect(exact.symbol);
  }, [filters.search, annotated, selected, onSelect]);

  return (
    <div className="space-y-2">
      <RadarFiltersBar
        state={filters}
        onChange={setFilters}
        totalCount={annotated.length}
        familyCounts={familyCounts}
        availableSubs={availableSubs}
        tierCounts={tierCounts}
        suggestions={suggestions}
      />
      <div className="rounded-md border border-border bg-card max-h-72 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {all.length === 0 ? 'Sin instrumentos del radar para esta cuenta.' : 'Sin resultados con los filtros actuales.'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(it => {
              const tier = tierOfScore(it.score);
              const tierCls = tier === 'elite'
                ? 'border-l-primary text-primary'
                : tier === 'solido'
                ? 'border-l-success text-success'
                : 'border-l-muted-foreground text-muted-foreground';
              const isSel = selected === it.symbol;
              const desc = classifyInstrument(it.symbol).description;
              return (
                <li key={`${it.symbol}::${it.broker}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(it.symbol)}
                    className={`w-full text-left px-3 py-2 border-l-2 ${tierCls} hover:bg-accent/40 transition-colors flex items-center justify-between gap-2 ${isSel ? 'bg-primary/10' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs">{it.symbol}</span>
                        {it.direction ? (
                          <span className={`text-[10px] font-bold ${
                            (it.direction ?? '').toLowerCase() === 'alcista' || (it.direction ?? '').toLowerCase() === 'buy'
                              ? 'text-success' : 'text-destructive'
                          }`}>
                            {(it.direction ?? '').toLowerCase() === 'alcista' || (it.direction ?? '').toLowerCase() === 'buy' ? '▲ BUY' : '▼ SELL'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">sin escáner</span>
                        )}
                      </div>
                      {desc && <div className="text-[10px] text-muted-foreground truncate">{desc}</div>}
                    </div>
                    <div className="text-xs font-data font-bold tabular-nums">{Math.round(it.score)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {items.length} de {annotated.length} instrumentos disponibles
      </div>
    </div>
  );
}
