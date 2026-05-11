import { useMemo, useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useWatchlist } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';
import type { BrokerFilter } from '@/lib/trade-utils';
import { TypeFilter } from './TypeFilter';
import { classifyInstrument, type InstrumentType, TYPE_ICON, TYPE_LABEL } from '@/lib/instrument-classify';
import { useQualificationMap, type QualificationRow } from '@/hooks/use-qualification';
import { QualificationChecklistTrigger, QualificationChecklistPanel, QualificationProgressBadge } from './QualificationChecklist';
import { useTableControls, useFiltered, SortHeader, TableSearchLimit } from './TableControls';

interface Raw {
  rank?: number;
  symbol: string;
  direction: string;
  score: number;
  adx?: number;
  adx_value?: number;
  adx_state?: string;
  // legacy / v17
  dist_ma50?: number;
  distance_to_ma50?: number;
  // v18 — pendiente MA50 en %
  pend50_pct?: number;
  pendiente_ma50?: number;
  pullback_active?: boolean;
  pullback_bars?: number;
  pullback_velas?: number;
  stoch_k?: number;
  stoch_d?: number;
  stoch_estado?: string;
  // v18 — dirección stoch
  stoch_subiendo?: boolean;
  // estructura
  structure?: string;
  estructura?: string;
  breakout?: string;
  ruptura?: string;
  // divergencia v18
  divergencia?: string; // 'ALCISTA' | 'BAJISTA' | 'NINGUNA'
  // ATR
  atr?: number;
  atr_value?: number;
  atr_estado?: string; // 'BAJA' | 'COHERENTE' | 'ELEVADA' | 'ANORMAL'
  vol_estado?: string;
  volume?: number;
  momentum?: number;
  current_price?: number;
  precio_actual?: number;
  price?: number;
}

export type StochEstado = 'ZONA_ENTRADA' | 'ZONA_MEDIA' | 'SOBRECOMPRADO' | null;
export type EstructuraTipo = 'CONFIRMADA' | 'PARCIAL' | 'ROTA' | null;
export type DivergenciaTipo = 'ALCISTA' | 'BAJISTA' | 'NINGUNA' | null;
export type AtrEstadoTipo = 'BAJA' | 'COHERENTE' | 'ELEVADA' | 'ANORMAL' | null;

export interface UnifiedInstrument {
  symbol: string;
  direction: string;
  score: number;
  adx_value: number | null;
  adx_state: string | null;
  // legacy
  distance_to_ma50: number | null;
  // v18
  pend50_pct: number | null;
  estructura: EstructuraTipo;
  divergencia: DivergenciaTipo;
  atr_estado: AtrEstadoTipo;
  stoch_subiendo: boolean | null;
  pullback_active: boolean;
  pullback_bars: number | null;
  stoch_k: number | null;
  stoch_estado: StochEstado;
  atr: number | null;
  structure: string | null;
  breakout: string | null;
  volume: number | null;
  current_price: number | null;
  broker: 'darwinex' | 'octx';
}

interface SessionRow {
  id: string;
  broker: string | null;
  top_instruments: unknown;
  created_at: string;
}

function normalizeEstructura(raw?: string): EstructuraTipo {
  if (!raw) return null;
  const r = raw.toUpperCase();
  if (r.includes('CONFIRM') || r.includes('LIMPIA')) return 'CONFIRMADA';
  if (r.includes('PARCIAL')) return 'PARCIAL';
  if (r.includes('ROTA') || r.includes('ROMPE')) return 'ROTA';
  return null;
}

function normalizeDivergencia(raw?: string): DivergenciaTipo {
  if (!raw) return null;
  const r = raw.toUpperCase();
  if (r.includes('ALCISTA')) return 'ALCISTA';
  if (r.includes('BAJISTA')) return 'BAJISTA';
  return 'NINGUNA';
}

function normalizeAtrEstado(raw?: string): AtrEstadoTipo {
  if (!raw) return null;
  const r = raw.toUpperCase();
  if (r.includes('BAJA') || r.includes('COMPRIMID')) return 'BAJA';
  if (r.includes('COHEREN') || r.includes('NORMAL')) return 'COHERENTE';
  if (r.includes('ELEVAD') || r.includes('ALTA')) return 'ELEVADA';
  if (r.includes('ANORMAL') || r.includes('EXPLOSIV')) return 'ANORMAL';
  return null;
}

export function useUnifiedInstruments(brokerFilter: BrokerFilter): UnifiedInstrument[] {
  const { data } = useQuery({
    queryKey: ['scanner-sessions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('id, broker, top_instruments, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  return useMemo(() => {
    if (!data) return [];
    const latestByBroker = new Map<'darwinex' | 'octx', SessionRow>();
    for (const row of data) {
      const v = (row.broker ?? '').toLowerCase();
      const key: 'darwinex' | 'octx' = (v.includes('octx') || v.includes('octx')) ? 'octx' : 'darwinex';
      if (!latestByBroker.has(key)) latestByBroker.set(key, row);
    }
    const out: UnifiedInstrument[] = [];
    for (const [broker, row] of latestByBroker.entries()) {
      if (brokerFilter !== 'all' && brokerFilter !== broker) continue;
      const arr = Array.isArray(row.top_instruments) ? (row.top_instruments as Raw[]) : [];
      for (const r of arr) {
        const stochK = r.stoch_k ?? null;
        let stochSub: boolean | null = null;
        if (typeof r.stoch_subiendo === 'boolean') stochSub = r.stoch_subiendo;
        else if (stochK != null && r.stoch_d != null) stochSub = stochK > r.stoch_d;
        out.push({
          symbol: r.symbol,
          direction: r.direction,
          score: Number(r.score ?? 0),
          adx_value: r.adx ?? r.adx_value ?? null,
          adx_state: r.adx_state ?? null,
          distance_to_ma50: r.dist_ma50 ?? r.distance_to_ma50 ?? null,
          pend50_pct: r.pend50_pct ?? r.pendiente_ma50 ?? null,
          estructura: normalizeEstructura(r.estructura ?? r.structure),
          divergencia: normalizeDivergencia(r.divergencia),
          atr_estado: normalizeAtrEstado(r.atr_estado ?? r.vol_estado),
          stoch_subiendo: stochSub,
          pullback_active: !!r.pullback_active,
          pullback_bars: r.pullback_velas ?? r.pullback_bars ?? null,
          stoch_k: stochK,
          stoch_estado: normalizeStochEstado(r.stoch_estado, stochK ?? undefined, r.direction),
          atr: r.atr_value ?? r.atr ?? null,
          structure: r.estructura ?? r.structure ?? null,
          breakout: r.ruptura ?? r.breakout ?? null,
          volume: r.volume ?? null,
          current_price: r.current_price ?? r.precio_actual ?? r.price ?? null,
          broker,
        });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }, [data, brokerFilter]);
}

interface Props { brokerFilter: BrokerFilter }

type Tier = 'elite' | 'solido' | 'observar';
function tierOf(score: number): Tier {
  if (score >= 75) return 'elite';
  if (score >= 60) return 'solido';
  return 'observar';
}
const TIER_LABEL: Record<Tier, string> = {
  elite: '★ ÉLITE — Score ≥ 75',
  solido: '● SÓLIDO — Score 60-74',
  observar: '◌ OBSERVAR — Score 40-59',
};

type SortKey =
  | 'symbol'
  | 'price'
  | 'direction'
  | 'score'
  | 'qualScore'
  | 'adx'
  | 'pend50'
  | 'estructura'
  | 'stoch'
  | 'atr';

export function EnTendenciaBlock({ brokerFilter }: Props) {
  const allItems = useUnifiedInstruments(brokerFilter);
  const { data: watchlist } = useWatchlist();
  const { openTrades } = useAllTrades();
  const qualMap = useQualificationMap();
  const watchedSymbols = new Set(
    (watchlist ?? [])
      .filter(w => (w.status ?? '').toUpperCase() !== 'SEGUIMIENTO')
      .map(w => `${w.symbol}::${(w.broker ?? 'darwinex')}`)
  );
  const seguimientoSymbols = new Set(
    (watchlist ?? [])
      .filter(w => (w.status ?? '').toUpperCase() === 'SEGUIMIENTO')
      .map(w => `${w.symbol}::${(w.broker ?? 'darwinex')}`)
  );
  const openSymbols = new Set(openTrades.map(t => t.symbol));

  const [typeFilter, setTypeFilter] = useState<Set<InstrumentType>>(new Set());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const controls = useTableControls<SortKey>({ key: null, dir: 'desc' });

  const counts = useMemo(() => {
    const c: Partial<Record<InstrumentType, number>> = {};
    for (const it of allItems) {
      const t = classifyInstrument(it.symbol).type;
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [allItems]);

  const typeFiltered = typeFilter.size === 0
    ? allItems
    : allItems.filter(it => typeFilter.has(classifyInstrument(it.symbol).type));

  const items = useFiltered<UnifiedInstrument, SortKey>(
    typeFiltered,
    { sort: controls.sort, search: controls.search, limit: controls.limit },
    {
      symbol: it => it.symbol,
      price: it => it.current_price,
      direction: it => it.direction,
      score: it => it.score,
      qualScore: it => qualMap.get(`${it.symbol}::${it.broker}`)?.score ?? (it.score >= 75 ? 2 : 0),
      adx: it => it.adx_value,
      pend50: it => it.pend50_pct,
      estructura: it => it.estructura,
      stoch: it => it.stoch_k,
      atr: it => it.atr,
    },
    it => [it.symbol, it.broker],
  );

  if (allItems.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Sin instrumentos en tendencia. Ejecuta el scanner.</p>
      </div>
    );
  }

  // Build a map symbol::broker → global rank (1..N) following sort order (over filtered items)
  const rankByKey = new Map<string, number>();
  items.forEach((it, idx) => rankByKey.set(`${it.symbol}::${it.broker}`, idx + 1));

  // Group by tier preserving sort — only when no explicit sort is active
  const showTiers = controls.sort.key === null;
  const grouped: { tier: Tier | null; items: UnifiedInstrument[] }[] = [];
  if (showTiers) {
    for (const it of items) {
      const t = tierOf(it.score);
      const last = grouped[grouped.length - 1];
      if (last && last.tier === t) last.items.push(it);
      else grouped.push({ tier: t, items: [it] });
    }
  } else {
    grouped.push({ tier: null, items });
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="sticky top-0 z-30 px-3 py-1.5 bg-secondary border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-3 flex-wrap">
        <span>Escáner v18</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-purple-400" /> Score ≥ 90</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-400" /> Top 20</span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <TableSearchLimit
            search={controls.search}
            onSearchChange={controls.setSearch}
            limit={controls.limit}
            onLimitChange={controls.setLimit}
            total={typeFiltered.length}
            shown={items.length}
            suggestions={typeFiltered.map(it => it.symbol)}
          />
          <TypeFilter selected={typeFilter} onChange={setTypeFilter} availableCounts={counts} />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-[34px] z-20">
            <tr className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-2 py-2 w-[50px]">#</th>
              <SortHeader label="Símbolo" sortKey="symbol" state={controls.sort} onToggle={controls.toggle} />
              <SortHeader label="Precio" sortKey="price" state={controls.sort} onToggle={controls.toggle} align="right" className="w-[90px]" />
              <SortHeader label="Dir" sortKey="direction" state={controls.sort} onToggle={controls.toggle} className="w-[70px]" />
              <SortHeader label="Score" sortKey="score" state={controls.sort} onToggle={controls.toggle} align="center" className="w-[80px]" />
              <SortHeader label="Embudo" sortKey="qualScore" state={controls.sort} onToggle={controls.toggle} align="center" className="w-[90px]" />
              <SortHeader label="ADX" sortKey="adx" state={controls.sort} onToggle={controls.toggle} className="w-[100px]" />
              <SortHeader label="Pend50" sortKey="pend50" state={controls.sort} onToggle={controls.toggle} align="right" className="w-[80px]" />
              <SortHeader label="Estruct" sortKey="estructura" state={controls.sort} onToggle={controls.toggle} className="w-[110px]" />
              <SortHeader label="Stoch(14)" sortKey="stoch" state={controls.sort} onToggle={controls.toggle} className="w-[110px]" />
              <SortHeader label="ATR" sortKey="atr" state={controls.sort} onToggle={controls.toggle} className="w-[100px]" />
              <th className="text-right px-2 py-2 w-[260px]">Acción</th>
            </tr>
          </thead>
          <tbody className="[&>tr:first-child>td]:pt-5">
            {grouped.map((g, gi) => (
              <Fragment key={`${g.tier ?? 'flat'}-${gi}`}>
                {g.tier && (
                  <tr className="bg-secondary/20">
                    <td colSpan={12} className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-t border-border">
                      {TIER_LABEL[g.tier]}
                    </td>
                  </tr>
                )}
                {g.items.map((inst, i) => {
                  const key = `${inst.symbol}::${inst.broker}`;
                  const rank = rankByKey.get(key) ?? 0;
                  const tier: HighlightTier = rank <= 20 ? 'top' : inst.score >= 90 ? 'gold' : 'none';
                  const isExpanded = expandedKey === key;
                  return (
                    <Fragment key={`${inst.symbol}-${inst.broker}-${i}`}>
                      <DesktopRow
                        inst={inst}
                        rank={rank}
                        hl={tier}
                        isWatched={watchedSymbols.has(key)}
                        isInSeguimiento={seguimientoSymbols.has(key)}
                        isOpen={openSymbols.has(inst.symbol)}
                        qual={qualMap.get(key)}
                        expanded={isExpanded}
                        onToggleExpand={() => setExpandedKey(isExpanded ? null : key)}
                      />
                      {isExpanded && (
                        <tr className="bg-secondary/10">
                          <td colSpan={12} className="p-0">
                            <QualificationChecklistPanel
                              symbol={inst.symbol}
                              broker={inst.broker}
                              direction={inst.direction}
                              scannerScore={inst.score}
                              existing={qualMap.get(key)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {grouped.map((g, gi) => (
          <div key={`m-${g.tier ?? 'flat'}-${gi}`}>
            {g.tier && (
              <div className="px-3 py-1 bg-secondary/30 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-t border-border">
                {TIER_LABEL[g.tier]}
              </div>
            )}
            <div className="divide-y divide-border">
              {g.items.map((inst, i) => {
                const key = `${inst.symbol}::${inst.broker}`;
                const rank = rankByKey.get(key) ?? 0;
                const tier: HighlightTier = rank <= 20 ? 'top' : inst.score >= 90 ? 'gold' : 'none';
                return (
                  <MobileCard
                    key={`${inst.symbol}-${inst.broker}-${i}`}
                    inst={inst}
                    rank={rank}
                    hl={tier}
                    isWatched={watchedSymbols.has(key)}
                    isInSeguimiento={seguimientoSymbols.has(key)}
                    isOpen={openSymbols.has(inst.symbol)}
                    qual={qualMap.get(key)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === Coloring helpers ===

function adxAbbr(state: string | null): string {
  const s = (state ?? '').toUpperCase();
  if (s.startsWith('ACEL')) return 'ACEL';
  if (s.startsWith('SUBI') || s.startsWith('BUEN')) return 'SUBI';
  if (s.startsWith('ESTA') || s.startsWith('LATE')) return 'ESTA';
  if (s.startsWith('AGOT') || s.startsWith('DEBI')) return 'AGOT';
  return s.slice(0, 4);
}

function adxColor(value: number | null): string {
  if (value == null) return 'text-muted-foreground';
  if (value > 30) return 'text-success';
  if (value < 20) return 'text-primary';
  return 'text-foreground';
}

function pend50Color(p: number | null): string {
  if (p == null) return 'text-muted-foreground';
  const a = Math.abs(p);
  if (a > 0.3) return 'text-success';
  if (a >= 0.05) return 'text-primary';
  return 'text-destructive';
}

export function estructuraMeta(e: EstructuraTipo): { icon: string; label: string; color: string; bg: string } {
  if (e === 'CONFIRMADA') return { icon: '✓', label: 'CONFIRMADA', color: 'text-success', bg: 'bg-success/10 border-success/30' };
  if (e === 'PARCIAL') return { icon: '~', label: 'PARCIAL', color: 'text-primary', bg: 'bg-primary/10 border-primary/30' };
  if (e === 'ROTA') return { icon: '✗', label: 'ROTA', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30' };
  return { icon: '—', label: '—', color: 'text-muted-foreground', bg: '' };
}

function divMeta(d: DivergenciaTipo): { label: string; color: string } {
  if (d === 'BAJISTA') return { label: '↘ BAJ', color: 'text-destructive' };
  if (d === 'ALCISTA') return { label: '↗ ALC', color: 'text-success' };
  return { label: '—', color: 'text-muted-foreground' };
}

function atrMeta(a: AtrEstadoTipo): { label: string; color: string } {
  if (a === 'BAJA') return { label: 'BAJA', color: 'text-success' };
  if (a === 'COHERENTE') return { label: 'COHERENTE', color: 'text-foreground' };
  if (a === 'ELEVADA') return { label: 'ELEVADA', color: 'text-primary' };
  if (a === 'ANORMAL') return { label: 'ANORMAL', color: 'text-destructive' };
  return { label: '—', color: 'text-muted-foreground' };
}

function scoreIcon(score: number): string {
  if (score >= 75) return '★';
  if (score >= 60) return '●';
  return '◌';
}

export function ScoreBadge({ score }: { score: number }) {
  if (score >= 75) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-primary text-black border border-primary">
        ★ {score}
      </span>
    );
  }
  if (score >= 60) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-success/30 text-success border border-success/50">
        ● {score}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-primary/30 text-primary border border-primary/50">
      ◌ {score}
    </span>
  );
}

function isAlcistaDir(d: string) {
  const v = d.toLowerCase();
  return v === 'alcista' || v === 'buy';
}

export function StochCell({ inst }: { inst: UnifiedInstrument }) {
  const k = inst.stoch_k;
  if (k == null) return <span className="text-xs text-muted-foreground">—</span>;
  const alcista = isAlcistaDir(inst.direction);
  const sub = inst.stoch_subiendo;
  // Apoya tendencia: alcista subiendo / bajista bajando
  const apoya = sub == null ? null : (alcista ? sub : !sub);
  const color = apoya == null ? 'text-foreground' : apoya ? 'text-success' : 'text-primary';
  const arrow = sub == null ? '' : sub ? '↑' : '↓';
  return (
    <span className={`font-data text-xs font-semibold ${color}`}>
      {k.toFixed(1)} {arrow}
    </span>
  );
}

export function AtrValueCell({ inst }: { inst: UnifiedInstrument }) {
  if (inst.atr == null) return <span className="text-xs text-muted-foreground">—</span>;
  const v = inst.atr;
  const decimals = v >= 100 ? 2 : v >= 1 ? 4 : 5;
  return <span className="font-data text-xs font-semibold text-foreground">{v.toFixed(decimals)}</span>;
}

export function AdxCell({ inst }: { inst: UnifiedInstrument }) {
  if (inst.adx_value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const v = inst.adx_value;
  const low = v < 15;
  return (
    <div className="flex items-center gap-1 leading-tight">
      <div>
        <div className={`font-data text-xs font-semibold ${adxColor(v)}`}>{v}</div>
        <div className="text-[9px] font-bold text-muted-foreground">{adxAbbr(inst.adx_state)}</div>
      </div>
      {low && (
        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-destructive/20 text-destructive border border-destructive/40">⚠</span>
      )}
    </div>
  );
}

export function Pend50Cell({ inst }: { inst: UnifiedInstrument }) {
  // Prefer v18 pend50_pct; fallback to legacy distance to give some context
  const p = inst.pend50_pct;
  if (p == null) {
    if (inst.distance_to_ma50 == null) return <span className="text-xs text-muted-foreground text-right block">—</span>;
    return <span className="text-xs text-muted-foreground font-data text-right block">d{inst.distance_to_ma50}%</span>;
  }
  return <span className={`text-xs font-data font-semibold ${pend50Color(p)} text-right block`}>{p.toFixed(2)}%</span>;
}

export function normalizeStochEstado(raw: string | undefined, value: number | undefined, direction: string | undefined): StochEstado {
  const r = (raw ?? '').toUpperCase().replace(/\s+/g, '_');
  if (r === 'ZONA_ENTRADA' || r === 'ZONA_MEDIA' || r === 'SOBRECOMPRADO') return r;
  if (value == null) return null;
  const alcista = isAlcistaDir(direction ?? '');
  if (alcista) {
    if (value < 30) return 'ZONA_ENTRADA';
    if (value > 70) return 'SOBRECOMPRADO';
    return 'ZONA_MEDIA';
  }
  if (value > 70) return 'ZONA_ENTRADA';
  if (value < 30) return 'SOBRECOMPRADO';
  return 'ZONA_MEDIA';
}

export function stochEstadoMeta(estado: StochEstado): { dot: string; label: string; color: string } {
  if (estado === 'ZONA_ENTRADA') return { dot: '🟢', label: 'ZONA ENTRADA', color: 'text-success' };
  if (estado === 'SOBRECOMPRADO') return { dot: '🔴', label: 'SOBRECOMPRADO', color: 'text-destructive' };
  if (estado === 'ZONA_MEDIA') return { dot: '🟡', label: 'ZONA MEDIA', color: 'text-primary' };
  return { dot: '—', label: '—', color: 'text-muted-foreground' };
}


function ActionCell({ inst, isOpen, qual, expanded, onToggleExpand }: { inst: UnifiedInstrument; isWatched: boolean; isInSeguimiento: boolean; isOpen: boolean; qual?: QualificationRow; expanded: boolean; onToggleExpand: () => void }) {
  return (
    <div className="relative flex items-center justify-end gap-1.5 flex-wrap">
      {isOpen && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/40">EN POS</span>
      )}
      <QualificationChecklistTrigger
        symbol={inst.symbol}
        broker={inst.broker}
        direction={inst.direction}
        scannerScore={inst.score}
        existing={qual}
        expanded={expanded}
        onToggle={onToggleExpand}
      />
    </div>
  );
}

export type HighlightTier = 'gold' | 'top' | 'none';

export function SymbolMeta({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const meta = classifyInstrument(symbol);
  return (
    <div className={`flex flex-col leading-tight ${compact ? 'text-[10px]' : 'text-[11px]'} text-muted-foreground font-normal`}>
      <span className="truncate max-w-[220px]" title={meta.description}>{meta.description}</span>
      <span className="text-[10px] flex items-center gap-1">
        <span>{meta.flag}</span><span>{meta.country}</span>
      </span>
    </div>
  );
}

export function TypeIcon({ symbol, className = '' }: { symbol: string; className?: string }) {
  const meta = classifyInstrument(symbol);
  return (
    <span
      className={`inline-flex items-center justify-center text-[12px] leading-none ${className}`}
      title={TYPE_LABEL[meta.type]}
      aria-label={TYPE_LABEL[meta.type]}
    >
      {TYPE_ICON[meta.type]}
    </span>
  );
}

export function SymbolName({ symbol }: { symbol: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <TypeIcon symbol={symbol} />
      <span>{symbol}</span>
    </span>
  );
}

export function formatPrice(p: number | null | undefined): string | null {
  if (p == null || !isFinite(p)) return null;
  const a = Math.abs(p);
  const decimals = a >= 1000 ? 2 : a >= 100 ? 2 : a >= 1 ? 4 : 5;
  return p.toFixed(decimals);
}

export function PriceCell({ price }: { price: number | null | undefined }) {
  const f = formatPrice(price);
  if (!f) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className="font-data text-xs font-semibold text-foreground">{f}</span>;
}

export function PriceTag({ price, compact = false }: { price: number | null | undefined; compact?: boolean }) {
  const f = formatPrice(price);
  if (!f) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-data font-semibold border border-border bg-secondary/60 text-foreground ${compact ? 'text-[10px]' : 'text-[11px]'}`}
      title="Precio actual"
    >
      {f}
    </span>
  );
}

function highlightClasses(hl: HighlightTier): string {
  if (hl === 'gold') return 'bg-purple-500/[0.10] border-l-[4px] border-l-purple-400';
  if (hl === 'top') return 'bg-blue-500/[0.08] border-l-[4px] border-l-blue-400';
  return '';
}

function rankColor(hl: HighlightTier): string {
  if (hl === 'gold') return 'text-purple-300';
  if (hl === 'top') return 'text-blue-300';
  return 'text-muted-foreground';
}

function DesktopRow({ inst, rank, hl, isWatched, isInSeguimiento, isOpen, qual, expanded, onToggleExpand }: { inst: UnifiedInstrument; rank: number; hl: HighlightTier; isWatched: boolean; isInSeguimiento: boolean; isOpen: boolean; qual?: QualificationRow; expanded: boolean; onToggleExpand: () => void }) {
  const alcista = isAlcistaDir(inst.direction);
  const est = estructuraMeta(inst.estructura);

  const highlightCls = highlightClasses(hl);
  const isHl = hl !== 'none';
  const qualScore = qual?.score ?? (inst.score >= 75 ? 2 : 0);

  return (
    <tr
      className={`border-t border-border text-sm cursor-pointer hover:bg-accent/20 transition-colors ${highlightCls} ${expanded ? 'bg-accent/10' : ''}`}
      onClick={onToggleExpand}
    >
      <td className="px-2 py-2 font-data text-center">
        <span className={`font-bold ${isHl ? 'text-base' : 'text-sm'} ${rankColor(hl)}`}>#{rank}</span>
      </td>
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
      <td className="px-2 py-2 text-right"><PriceCell price={inst.current_price} /></td>
      <td className="px-2 py-2">
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {alcista ? 'BUY' : 'SELL'}
        </span>
      </td>
      <td className="px-2 py-2 text-center">
        <ScoreBadge score={inst.score} />
      </td>
      <td className="px-2 py-2 text-center">
        <QualificationProgressBadge score={qualScore} />
      </td>
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
      <td className="px-2 py-2"><ActionCell inst={inst} isWatched={isWatched} isInSeguimiento={isInSeguimiento} isOpen={isOpen} qual={qual} expanded={expanded} onToggleExpand={onToggleExpand} /></td>
    </tr>
  );
}

function MobileCard({ inst, rank, hl, isWatched, isInSeguimiento, isOpen, qual }: { inst: UnifiedInstrument; rank: number; hl: HighlightTier; isWatched: boolean; isInSeguimiento: boolean; isOpen: boolean; qual?: QualificationRow }) {
  const [open, setOpen] = useState(false);
  const [qualOpen, setQualOpen] = useState(false);
  const alcista = isAlcistaDir(inst.direction);
  const est = estructuraMeta(inst.estructura);

  const highlightCls = highlightClasses(hl);
  const isHl = hl !== 'none';
  const qualScore = qual?.score ?? (inst.score >= 75 ? 2 : 0);

  return (
    <div className={`p-3 ${highlightCls}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 flex-wrap">
        <span className={`font-data font-bold ${isHl ? 'text-base' : 'text-sm'} ${rankColor(hl)}`}>#{rank}</span>
        <span className="font-bold text-sm text-foreground inline-flex items-center gap-1.5"><TypeIcon symbol={inst.symbol} />{inst.symbol}</span>
        <PriceTag price={inst.current_price} compact />
        <ScoreBadge score={inst.score} />
        <QualificationProgressBadge score={qualScore} />
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {alcista ? 'BUY' : 'SELL'}
        </span>
        {open ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
      </button>
      <div className="mt-1"><SymbolMeta symbol={inst.symbol} compact /></div>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <div className="flex justify-between"><span className="text-muted-foreground">ADX</span><span className={`font-data font-semibold ${adxColor(inst.adx_value)}`}>{inst.adx_value ?? '—'} {adxAbbr(inst.adx_state)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pend50</span><span className={`font-data ${pend50Color(inst.pend50_pct)}`}>{inst.pend50_pct != null ? `${inst.pend50_pct.toFixed(2)}%` : (inst.distance_to_ma50 != null ? `d${inst.distance_to_ma50}%` : '—')}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Estruct</span><span className={`font-bold ${est.color}`}>{est.icon} {est.label}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Stoch</span><span><StochCell inst={inst} /></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">ATR</span><span><AtrValueCell inst={inst} /></span></div>
          <div className="col-span-2 pt-1.5 flex justify-end">
            <ActionCell inst={inst} isWatched={isWatched} isInSeguimiento={isInSeguimiento} isOpen={isOpen} qual={qual} expanded={qualOpen} onToggleExpand={() => setQualOpen(v => !v)} />
          </div>
          {qualOpen && (
            <div className="col-span-2">
              <QualificationChecklistPanel
                symbol={inst.symbol}
                broker={inst.broker}
                direction={inst.direction}
                scannerScore={inst.score}
                existing={qual}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function useEnTendenciaCount(brokerFilter: BrokerFilter) {
  const items = useUnifiedInstruments(brokerFilter);
  return items.length;
}
