import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
import { classifyInstrument } from '@/lib/instrument-classify';
import {
  type ScannerFilterState,
  type TradeAgg,
  VOL_RANK,
} from './AssetsStyleFiltersBar';
import type { useAssetMap } from '@/hooks/use-asset-map';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';

type AssetMap = ReturnType<typeof useAssetMap>;

function brokerToAssetBroker(b: string | null | undefined): string {
  const v = (b ?? '').toLowerCase();
  if (v === 'darwinex' || v === 'nkis') return 'nkis';
  return 'octx';
}

function isAlcistaDir(d: string) {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

/** Vigilancia EA = aproximación CAP elite (heurística: score ≥ 75 en último escaneo). */
export function useEaWatchSet(brokerFilter: BrokerFilter = 'all') {
  const all = useUnifiedInstruments(brokerFilter);
  return useMemo(() => {
    const s = new Set<string>();
    for (const it of all) {
      if (Number(it.score ?? 0) >= 75) s.add(`${it.symbol}::${it.broker}`);
    }
    return s;
  }, [all]);
}

export function useVigilanciaCount(brokerFilter: BrokerFilter = 'all') {
  return useEaWatchSet(brokerFilter).size;
}

interface CommonProps {
  brokerFilter: BrokerFilter;
  filters: ScannerFilterState;
  tradeAgg: Map<string, TradeAgg>;
  assetMap: AssetMap;
}

type AnnotatedRow = UnifiedInstrument & { _mercado: string | null; _sector: string | null };

function applyScannerFilters(
  rows: AnnotatedRow[],
  filters: ScannerFilterState,
  tradeAgg: Map<string, TradeAgg>,
): AnnotatedRow[] {
  const q = filters.search.trim().toUpperCase();
  const aggFor = (r: AnnotatedRow) => tradeAgg.get(`${r.symbol}|${r.broker}`);
  const filtered = rows.filter(a => {
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
  const cmp = (a: AnnotatedRow, b: AnnotatedRow): number => {
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
}

/* ─────────────── Escaneado ─────────────── */

export function ScannerListView({ brokerFilter, filters, tradeAgg, assetMap }: CommonProps) {
  const all = useUnifiedInstruments(brokerFilter);

  const annotated = useMemo<AnnotatedRow[]>(() => {
    return all.map(it => {
      const c = assetMap.classify(it.symbol);
      return { ...it, _mercado: c.mercado, _sector: c.sector };
    });
  }, [all, assetMap]);

  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...annotated]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [annotated]);

  const items = useMemo(
    () => applyScannerFilters(annotated, filters, tradeAgg),
    [annotated, filters, tradeAgg],
  );

  if (all.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Sin instrumentos en el escáner. Sincroniza desde MT5.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Ningún instrumento coincide con los filtros.</div>
      ) : (
        <ScannerTable items={items} globalRanks={globalRanks} />
      )}
    </div>
  );
}

/* ─────────────── Vigilancia EA ─────────────── */

export function VigilanciaView({ brokerFilter, filters, tradeAgg, assetMap }: CommonProps) {
  const scanner = useUnifiedInstruments(brokerFilter);
  const { data: watchRows = [] } = useWatchlist();

  // Fuente: watchlist con watch_reason='EA' (sincronizado por el EA — CAP_ELITE.csv).
  const eaList = useMemo<UnifiedInstrument[]>(() => {
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

  const annotated = useMemo<AnnotatedRow[]>(() => {
    return eaList.map(it => {
      const c = assetMap.classify(it.symbol);
      return { ...it, _mercado: c.mercado, _sector: c.sector };
    });
  }, [eaList, assetMap]);

  const globalRanks = useMemo(() => {
    const m = new Map<string, number>();
    [...scanner]
      .sort((a, b) => b.score - a.score)
      .forEach((it, idx) => m.set(`${it.symbol}::${it.broker}`, idx + 1));
    return m;
  }, [scanner]);

  const items = useMemo(
    () => applyScannerFilters(annotated, filters, tradeAgg),
    [annotated, filters, tradeAgg],
  );

  if (eaList.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center space-y-1">
        <p className="text-sm text-muted-foreground">El EA aún no ha sincronizado su lista de vigilancia.</p>
        <p className="text-xs text-muted-foreground/70">El EA envía CAP_ELITE.csv vía <code className="font-mono">/api/sync-ea-watchlist</code>. Cuando lo haga, los instrumentos aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Ningún instrumento coincide con los filtros.</div>
      ) : (
        <ScannerTable items={items} globalRanks={globalRanks} />
      )}
    </div>
  );
}

/* ─────────────── Tabla compartida ─────────────── */

function ScannerTable({ items, globalRanks }: { items: AnnotatedRow[]; globalRanks: Map<string, number> }) {
  return (
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
