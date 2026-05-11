import { useMemo, useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import type { BrokerFilter } from '@/lib/trade-utils';
import { useUnifiedInstruments, type UnifiedInstrument } from './EnTendenciaBlock';
import { classifyFamily, FAMILIES, SUBFAMILIES, type Family } from '@/lib/instrument-family';
import { useQualificationMap } from '@/hooks/use-qualification';
import { QualificationChecklistPanel, QualificationProgressBadge } from './QualificationChecklist';

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

interface Props { brokerFilter: BrokerFilter }

export function ScannerListView({ brokerFilter }: Props) {
  const all = useUnifiedInstruments(brokerFilter);
  const qualMap = useQualificationMap();
  const [family, setFamily] = useState<Family | null>(null);
  const [subfamily, setSubfamily] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Anotamos cada item con familia/subfamilia
  const annotated = useMemo(() => {
    return all.map(it => {
      const cls = classifyFamily(it.symbol);
      return { it, family: cls?.family ?? null, subfamily: cls?.subfamily ?? null };
    });
  }, [all]);

  // Filtrado por familia/subfamilia
  const filtered = useMemo(() => {
    return annotated.filter(a => {
      if (family && a.family !== family) return false;
      if (subfamily && a.subfamily !== subfamily) return false;
      return true;
    });
  }, [annotated, family, subfamily]);

  // Subfamilias disponibles (solo las que tienen instrumentos en el conjunto filtrado por familia)
  const availableSubs = useMemo(() => {
    if (!family) return [] as string[];
    const present = new Set(
      annotated.filter(a => a.family === family && a.subfamily).map(a => a.subfamily as string)
    );
    return SUBFAMILIES[family].filter(s => present.has(s));
  }, [annotated, family]);

  // Conteos por familia (sobre todo el dataset, ignorando filtro de familia)
  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a.family) c[a.family] = (c[a.family] ?? 0) + 1;
    return c;
  }, [annotated]);

  // Agrupar por tier (mantiene orden por score desc dentro de cada tier)
  const groups = useMemo(() => {
    const map: Record<Tier, typeof filtered> = { elite: [], solido: [], observar: [] };
    for (const a of [...filtered].sort((x, y) => y.it.score - x.it.score)) {
      map[tierOf(a.it.score)].push(a);
    }
    return map;
  }, [filtered]);

  const eliteRef = useRef<HTMLDivElement>(null);
  const solidoRef = useRef<HTMLDivElement>(null);
  const observarRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    const main = el.closest('main');
    if (main) {
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 100;
      main.scrollTo({ top, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
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
      {/* Filtros */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        {/* Fila 1 — Familia */}
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

        {/* Fila 2 — Subfamilia */}
        {family && availableSubs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
            <FilterChip
              active={subfamily === null}
              onClick={() => setSubfamily(null)}
              label="Todas"
              size="sm"
            />
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

        {/* Fila 3 — Anclajes Score */}
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
          <button
            onClick={() => scrollTo(eliteRef)}
            className="px-2.5 py-1 rounded text-xs font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            ★ Élite ({groups.elite.length})
          </button>
          <button
            onClick={() => scrollTo(solidoRef)}
            className="px-2.5 py-1 rounded text-xs font-bold border border-success/40 bg-success/10 text-success hover:bg-success/20 transition-colors"
          >
            ● Sólido ({groups.solido.length})
          </button>
          <button
            onClick={() => scrollTo(observarRef)}
            className="px-2.5 py-1 rounded text-xs font-bold border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            ◌ Observar ({groups.observar.length})
          </button>
        </div>
      </div>

      {/* Secciones */}
      <TierSection
        innerRef={eliteRef}
        tier="elite"
        items={groups.elite}
        qualMap={qualMap}
        expandedKey={expandedKey}
        onToggleExpand={setExpandedKey}
      />
      <TierSection
        innerRef={solidoRef}
        tier="solido"
        items={groups.solido}
        qualMap={qualMap}
        expandedKey={expandedKey}
        onToggleExpand={setExpandedKey}
      />
      <TierSection
        innerRef={observarRef}
        tier="observar"
        items={groups.observar}
        qualMap={qualMap}
        expandedKey={expandedKey}
        onToggleExpand={setExpandedKey}
      />
    </div>
  );
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

interface TierProps {
  innerRef: React.RefObject<HTMLDivElement | null>;
  tier: Tier;
  items: { it: UnifiedInstrument; family: Family | null; subfamily: string | null }[];
  qualMap: ReturnType<typeof useQualificationMap>;
  expandedKey: string | null;
  onToggleExpand: (k: string | null) => void;
}

function TierSection({ innerRef, tier, items, qualMap, expandedKey, onToggleExpand }: TierProps) {
  const meta = TIER_META[tier];
  if (items.length === 0) {
    return <div ref={innerRef} className="scroll-mt-24" />;
  }
  return (
    <div ref={innerRef} className="scroll-mt-24 rounded-lg border border-border bg-card overflow-hidden">
      <div className={`px-3 py-2 border-b border-border bg-secondary/30 flex items-center gap-2 border-l-4 ${meta.accent}`}>
        <span className="font-display font-bold text-sm uppercase tracking-wider">{meta.label}</span>
        <span className="text-xs text-muted-foreground">— {items.length} instrumento{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2">
        {items.map(({ it, family, subfamily }) => {
          const key = `${it.symbol}::${it.broker}`;
          const expanded = expandedKey === key;
          return (
            <InstrumentCard
              key={key}
              inst={it}
              family={family}
              subfamily={subfamily}
              qualScore={qualMap.get(key)?.score ?? (it.score >= 75 ? 2 : 0)}
              expanded={expanded}
              onToggle={() => onToggleExpand(expanded ? null : key)}
              qualExisting={qualMap.get(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CardProps {
  inst: UnifiedInstrument;
  family: Family | null;
  subfamily: string | null;
  qualScore: number;
  expanded: boolean;
  onToggle: () => void;
  qualExisting: ReturnType<ReturnType<typeof useQualificationMap>['get']>;
}

function InstrumentCard({ inst, family, subfamily, qualScore, expanded, onToggle, qualExisting }: CardProps) {
  const alcista = isAlcistaDir(inst.direction);
  const stoch = inst.stoch_k;
  const stochArrow = inst.stoch_subiendo == null ? '' : inst.stoch_subiendo ? '↑' : '↓';
  return (
    <div className={`rounded-md border border-border bg-card hover:border-primary/40 transition-colors ${expanded ? 'border-primary/60' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-2.5 flex flex-col gap-1.5">
        {/* Línea 1: símbolo + broker + dirección + score */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-sm text-foreground">{inst.symbol}</span>
          <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${
            inst.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
          }`}>{inst.broker === 'darwinex' ? 'NK' : 'OX'}</span>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
            alcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
          }`}>
            {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {alcista ? 'BUY' : 'SELL'}
          </span>
          <span className="ml-auto font-data text-xs font-bold text-foreground">{inst.score}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>

        {/* Línea 2: familia / subfamilia */}
        <div className="text-[11px] text-muted-foreground truncate">
          {family ?? '—'}{subfamily && subfamily !== '—' ? ` › ${subfamily}` : ''}
        </div>

        {/* Línea 3: stoch / adx / qual badge */}
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          <span className="text-muted-foreground">Stoch <span className="font-data font-semibold text-foreground">{stoch != null ? stoch.toFixed(1) : '—'}{stochArrow}</span></span>
          <span className="text-muted-foreground">ADX <span className="font-data font-semibold text-foreground">{inst.adx_value ?? '—'}</span></span>
          <span className="ml-auto"><QualificationProgressBadge score={qualScore} /></span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border bg-secondary/20">
          <QualificationChecklistPanel
            symbol={inst.symbol}
            broker={inst.broker}
            direction={inst.direction}
            scannerScore={inst.score}
            existing={qualExisting}
          />
        </div>
      )}
    </div>
  );
}

// Suprime warning import no usado (useEffect podría usarse a futuro)
void useEffect;
