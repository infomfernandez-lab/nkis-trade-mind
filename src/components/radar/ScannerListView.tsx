import { useMemo, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
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
import { classifyFamily, FAMILIES, SUBFAMILIES, type Family } from '@/lib/instrument-family';
import { SortHeader, useTableControls, useFiltered } from './TableControls';
import { useWatchlist, useAddToWatchlist, useDeleteWatchlistItem } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';
import { toast } from 'sonner';

type Tier = 'elite' | 'solido' | 'observar';
const TIER_META: Record<Tier, { label: string; min: number; max: number; accent: string }> = {
  elite:    { label: 'ÉLITE',    min: 75, max: 9999, accent: 'border-l-primary text-primary' },
  solido:   { label: 'SÓLIDO',   min: 60, max: 74,   accent: 'border-l-success text-success' },
  observar: { label: 'OBSERVAR', min: 0,  max: 59,   accent: 'border-l-muted-foreground text-muted-foreground' },
};
function tierOf(score: number): Tier {
  if (score >= 75) return 'elite';
  if (score >= 60) return 'solido';
  return 'observar';
}

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

type SortKey = 'symbol' | 'score' | 'direction' | 'price' | 'adx' | 'pend50' | 'estructura' | 'stoch' | 'atr';

interface Props { brokerFilter: BrokerFilter }

export function ScannerListView({ brokerFilter }: Props) {
  const all = useUnifiedInstruments(brokerFilter);
  const [family, setFamily] = useState<Family | null>(null);
  const [subfamily, setSubfamily] = useState<string | null>(null);
  const controls = useTableControls<SortKey>({ key: null, dir: 'desc' });
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

  const familyFiltered = useMemo(() => {
    return annotated.filter(a => {
      if (family && a._family !== family) return false;
      if (subfamily && a._subfamily !== subfamily) return false;
      return true;
    });
  }, [annotated, family, subfamily]);

  type Row = (typeof familyFiltered)[number];

  const items = useFiltered<Row, SortKey>(
    familyFiltered,
    { sort: controls.sort, search: controls.search, limit: controls.limit },
    {
      symbol: it => it.symbol,
      score: it => it.score,
      direction: it => it.direction,
      price: it => it.current_price,
      adx: it => it.adx_value,
      pend50: it => it.pend50_pct,
      estructura: it => it.estructura,
      stoch: it => it.stoch_k,
      atr: it => it.atr,
    },
    it => [it.symbol, it.broker],
  );

  const availableSubs = useMemo(() => {
    if (!family) return [] as string[];
    const present = new Set(
      annotated.filter(a => a._family === family && a._subfamily).map(a => a._subfamily as string),
    );
    return SUBFAMILIES[family].filter(s => present.has(s));
  }, [annotated, family]);

  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a._family) c[a._family] = (c[a._family] ?? 0) + 1;
    return c;
  }, [annotated]);

  const showTiers = controls.sort.key === null;
  const sortedByScore = useMemo(() => [...items].sort((a, b) => b.score - a.score), [items]);

  const groups: { tier: Tier; items: Row[] }[] = useMemo(() => {
    if (!showTiers) return [{ tier: 'elite', items }];
    const map: Record<Tier, Row[]> = { elite: [], solido: [], observar: [] };
    for (const it of sortedByScore) map[tierOf(it.score)].push(it);
    return (['elite', 'solido', 'observar'] as Tier[])
      .filter(t => map[t].length > 0)
      .map(t => ({ tier: t, items: map[t] }));
  }, [showTiers, items, sortedByScore]);

  const eliteRef = useRef<HTMLDivElement>(null);
  const solidoRef = useRef<HTMLDivElement>(null);
  const observarRef = useRef<HTMLDivElement>(null);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { elite: 0, solido: 0, observar: 0 };
    for (const it of familyFiltered) c[tierOf(it.score)]++;
    return c;
  }, [familyFiltered]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest('main');
    if (main) {
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 160;
      main.scrollTo({ top, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'smooth' });
    }
  };

  const handleToggleWatch = (inst: UnifiedInstrument) => {
    const key = `${inst.symbol}::${inst.broker}`;
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
      {/* Filtros — sticky para mantener acceso al hacer scroll */}
      <div className="sticky top-[52px] z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b border-border">
        <div className="rounded-lg border border-border bg-card p-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={family === null}
              onClick={() => { setFamily(null); setSubfamily(null); }}
              label={`Todos (${annotated.length})`}
            />
            {FAMILIES.map(f => {
              const n = familyCounts[f] ?? 0;
              if (n === 0) return null;
              return (
                <FilterChip
                  key={f}
                  active={family === f}
                  onClick={() => { setFamily(family === f ? null : f); setSubfamily(null); }}
                  label={`${f} (${n})`}
                />
              );
            })}
          </div>

          {family && availableSubs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
              <FilterChip active={subfamily === null} onClick={() => setSubfamily(null)} label="Todas" size="sm" />
              {availableSubs.map(s => (
                <FilterChip
                  key={s}
                  active={subfamily === s}
                  onClick={() => setSubfamily(subfamily === s ? null : s)}
                  label={s}
                  size="sm"
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
            <button
              onClick={() => scrollTo(eliteRef)}
              className="px-2.5 py-1 rounded text-xs font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              ★ Élite ({tierCounts.elite})
            </button>
            <button
              onClick={() => scrollTo(solidoRef)}
              className="px-2.5 py-1 rounded text-xs font-bold border border-success/40 bg-success/10 text-success hover:bg-success/20 transition-colors"
            >
              ● Sólido ({tierCounts.solido})
            </button>
            <button
              onClick={() => scrollTo(observarRef)}
              className="px-2.5 py-1 rounded text-xs font-bold border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              ◌ Observar ({tierCounts.observar})
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-2 py-2 w-[60px]">#</th>
                <SortHeader label="Score" sortKey="score" state={controls.sort} onToggle={controls.toggle} align="center" className="w-[80px]" />
                <SortHeader label="Símbolo" sortKey="symbol" state={controls.sort} onToggle={controls.toggle} />
                <SortHeader label="Dir" sortKey="direction" state={controls.sort} onToggle={controls.toggle} className="w-[70px]" />
                <SortHeader label="Precio" sortKey="price" state={controls.sort} onToggle={controls.toggle} align="right" className="w-[90px]" />
                <SortHeader label="ADX" sortKey="adx" state={controls.sort} onToggle={controls.toggle} className="w-[100px]" />
                <SortHeader label="Pend50" sortKey="pend50" state={controls.sort} onToggle={controls.toggle} align="right" className="w-[80px]" />
                <SortHeader label="Estruct" sortKey="estructura" state={controls.sort} onToggle={controls.toggle} className="w-[110px]" />
                <SortHeader label="Stoch" sortKey="stoch" state={controls.sort} onToggle={controls.toggle} className="w-[100px]" />
                <SortHeader label="ATR" sortKey="atr" state={controls.sort} onToggle={controls.toggle} className="w-[100px]" />
                <th className="text-center px-2 py-2 w-[50px]">👁</th>
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
                        <td colSpan={11} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold border-t border-l-4 border-border ${meta.accent}`}>
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

function FilterChip({ label, active, onClick, size = 'md' }: { label: string; active: boolean; onClick: () => void; size?: 'sm' | 'md' }) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <button
      onClick={onClick}
      className={`${pad} rounded font-medium border transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
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
  const est = estructuraMeta(inst.estructura);
  return (
    <tr className={`border-t border-border text-sm ${watched ? 'bg-primary/5' : ''}`}>
      <td className="px-2 py-2 font-data text-center text-muted-foreground font-bold text-sm">#{rank}</td>
      <td className="px-2 py-2 text-center"><ScoreBadge score={inst.score} /></td>
      <td className="px-3 py-2 font-bold text-foreground">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SymbolName symbol={inst.symbol} />
            <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${
              inst.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
            }`}>{inst.broker === 'darwinex' ? 'NK' : 'OX'}</span>
          </div>
          <SymbolMeta symbol={inst.symbol} />
        </div>
      </td>
      <td className="px-2 py-2">
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {alcista ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className="px-2 py-2 text-right"><PriceCell price={inst.current_price} /></td>
      <td className="px-2 py-2"><AdxCell inst={inst} /></td>
      <td className="px-2 py-2"><Pend50Cell inst={inst} /></td>
      <td className="px-2 py-2">
        {inst.estructura ? (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${est.bg} ${est.color}`}>
            {est.icon} {est.label}
          </span>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-2 py-2"><StochCell inst={inst} /></td>
      <td className="px-2 py-2"><AtrValueCell inst={inst} /></td>
      <td className="px-2 py-2 text-center"><WatchToggle watched={watched} onClick={onToggleWatch} /></td>
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

interface VigProps { brokerFilter: BrokerFilter }

export function VigilanciaView({ brokerFilter }: VigProps) {
  const all = useUnifiedInstruments(brokerFilter);
  const { openTrades } = useAllTrades();
  const openSymbols = useMemo(() => new Set(openTrades.map(t => t.symbol)), [openTrades]);

  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...all]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [all]);

  const items = useMemo(
    () => all.filter(i => (i.score ?? 0) >= 60).sort((a, b) => b.score - a.score),
    [all],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">El EA no está vigilando ningún instrumento ahora mismo (sin scores ≥ 60 en el último escáner).</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-2 py-2 w-[60px]">#</th>
              <th className="text-center px-2 py-2 w-[80px]">Score</th>
              <th className="text-left px-3 py-2">Símbolo</th>
              <th className="text-left px-2 py-2 w-[70px]">Dir</th>
              <th className="text-right px-2 py-2 w-[90px]">Precio</th>
              <th className="text-left px-2 py-2 w-[100px]">ADX</th>
              <th className="text-right px-2 py-2 w-[80px]">Pend50</th>
              <th className="text-left px-2 py-2 w-[110px]">Estruct</th>
              <th className="text-left px-2 py-2 w-[100px]">Stoch</th>
              <th className="text-left px-2 py-2 w-[100px]">ATR</th>
              <th className="text-center px-2 py-2 w-[110px]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inst) => {
              const key = `${inst.symbol}::${inst.broker}`;
              const rank = globalRanks.get(key) ?? 0;
              const isOpen = openSymbols.has(inst.symbol);
              const alcista = isAlcistaDir(inst.direction);
              const est = estructuraMeta(inst.estructura);
              return (
                <tr key={key} className={`border-t border-border text-sm ${isOpen ? 'bg-success/5' : ''}`}>
                  <td className="px-2 py-2 font-data text-center text-muted-foreground font-bold">#{rank}</td>
                  <td className="px-2 py-2 text-center"><ScoreBadge score={inst.score} /></td>
                  <td className="px-3 py-2 font-bold">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <SymbolName symbol={inst.symbol} />
                        <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${
                          inst.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
                        }`}>{inst.broker === 'darwinex' ? 'NK' : 'OX'}</span>
                      </div>
                      <SymbolMeta symbol={inst.symbol} />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
                    }`}>
                      {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {alcista ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right"><PriceCell price={inst.current_price} /></td>
                  <td className="px-2 py-2"><AdxCell inst={inst} /></td>
                  <td className="px-2 py-2"><Pend50Cell inst={inst} /></td>
                  <td className="px-2 py-2">
                    {inst.estructura ? (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${est.bg} ${est.color}`}>
                        {est.icon} {est.label}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-2 py-2"><StochCell inst={inst} /></td>
                  <td className="px-2 py-2"><AtrValueCell inst={inst} /></td>
                  <td className="px-2 py-2 text-center">
                    {isOpen ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/40">ABIERTA</span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground border border-border">EN ESPERA</span>
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
          const est = estructuraMeta(inst.estructura);
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
                <div className="flex justify-between"><span className="text-muted-foreground">ADX</span><span><AdxCell inst={inst} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pend50</span><span><Pend50Cell inst={inst} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estruct</span><span className={`font-bold ${est.color}`}>{est.icon} {est.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stoch</span><span><StochCell inst={inst} /></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ATR</span><span><AtrValueCell inst={inst} /></span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

