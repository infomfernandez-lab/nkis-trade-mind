import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { FAMILIES, SUBFAMILIES, type Family } from '@/lib/instrument-family';

export type Tier = 'elite' | 'solido' | 'observar';

export interface RadarFilterState {
  family: Family | null;
  subfamily: string | null;
  tier: Tier | null;
  search: string;
}

export const EMPTY_FILTERS: RadarFilterState = {
  family: null,
  subfamily: null,
  tier: null,
  search: '',
};

export function tierOfScore(score: number): Tier {
  if (score >= 75) return 'elite';
  if (score >= 60) return 'solido';
  return 'observar';
}

export interface Suggestion {
  value: string;       // ticker (what we set in search)
  label: string;       // "TICKER" main
  description?: string; // full name
}

interface Props {
  state: RadarFilterState;
  onChange: (s: RadarFilterState) => void;
  totalCount: number;
  familyCounts: Partial<Record<Family, number>>;
  availableSubs?: string[];
  tierCounts: Record<Tier, number>;
  suggestions: Suggestion[];
  /** ocultar tier (p. ej. si no aplica) */
  hideTier?: boolean;
  /** Slot opcional debajo del buscador (p.ej. selector de vista). */
  viewSwitcher?: React.ReactNode;
}

export function RadarFiltersBar({
  state,
  onChange,
  totalCount,
  familyCounts,
  availableSubs = [],
  tierCounts,
  suggestions,
  hideTier = false,
}: Props) {
  const set = (patch: Partial<RadarFilterState>) => onChange({ ...state, ...patch });

  return (
    <div className="rounded-lg border border-border bg-card p-2 space-y-2">
      {/* Buscador */}
      <SearchBox
        value={state.search}
        onChange={v => set({ search: v })}
        suggestions={suggestions}
      />

      {/* Mercados */}
      <div className="flex flex-wrap gap-1.5">
        <Chip
          active={state.family === null}
          onClick={() => set({ family: null, subfamily: null })}
          label={`Todos (${totalCount})`}
        />
        {FAMILIES.map(f => {
          const n = familyCounts[f] ?? 0;
          if (n === 0) return null;
          return (
            <Chip
              key={f}
              active={state.family === f}
              onClick={() => set({ family: state.family === f ? null : f, subfamily: null })}
              label={`${f} (${n})`}
            />
          );
        })}
      </div>

      {/* Sectores */}
      {state.family && availableSubs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
          <Chip active={state.subfamily === null} onClick={() => set({ subfamily: null })} label="Todas" size="sm" />
          {availableSubs.map(s => (
            <Chip
              key={s}
              active={state.subfamily === s}
              onClick={() => set({ subfamily: state.subfamily === s ? null : s })}
              label={s}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Tiers como filtro */}
      {!hideTier && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/50">
          <button
            onClick={() => set({ tier: null })}
            className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
              state.tier === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            Todos ({tierCounts.elite + tierCounts.solido + tierCounts.observar})
          </button>
          <TierButton
            active={state.tier === 'elite'}
            onClick={() => set({ tier: state.tier === 'elite' ? null : 'elite' })}
            label={`★ Élite (${tierCounts.elite})`}
            cls="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            activeCls="bg-primary text-primary-foreground border-primary"
          />
          <TierButton
            active={state.tier === 'solido'}
            onClick={() => set({ tier: state.tier === 'solido' ? null : 'solido' })}
            label={`● Sólido (${tierCounts.solido})`}
            cls="border-success/40 bg-success/10 text-success hover:bg-success/20"
            activeCls="bg-success text-success-foreground border-success"
          />
          <TierButton
            active={state.tier === 'observar'}
            onClick={() => set({ tier: state.tier === 'observar' ? null : 'observar' })}
            label={`◌ Observar (${tierCounts.observar})`}
            cls="border-border bg-secondary text-muted-foreground hover:text-foreground"
            activeCls="bg-muted-foreground text-background border-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick, size = 'md' }: { label: string; active: boolean; onClick: () => void; size?: 'sm' | 'md' }) {
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

function TierButton({ label, active, onClick, cls, activeCls }: { label: string; active: boolean; onClick: () => void; cls: string; activeCls: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${active ? activeCls : cls}`}
    >
      {label}
    </button>
  );
}

function SearchBox({ value, onChange, suggestions }: { value: string; onChange: (v: string) => void; suggestions: Suggestion[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 260) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    // ticker startsWith
    for (const s of suggestions) {
      if (seen.has(s.value)) continue;
      if (s.value.toLowerCase().startsWith(q)) { out.push(s); seen.add(s.value); }
    }
    // ticker includes
    for (const s of suggestions) {
      if (seen.has(s.value)) continue;
      if (s.value.toLowerCase().includes(q)) { out.push(s); seen.add(s.value); }
    }
    // description includes
    for (const s of suggestions) {
      if (seen.has(s.value)) continue;
      if ((s.description ?? '').toLowerCase().includes(q)) { out.push(s); seen.add(s.value); }
    }
    return out.slice(0, 10);
  }, [value, suggestions]);

  const choose = (s: Suggestion) => {
    onChange(s.value);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || matches.length === 0) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % matches.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + matches.length) % matches.length); }
          else if (e.key === 'Enter') { e.preventDefault(); choose(matches[active]); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        placeholder="Buscar por ticker o nombre…"
        className="pl-7 pr-7 py-1 h-8 w-full rounded text-xs bg-background border border-border focus:outline-none focus:border-primary/50"
      />
      {value && (
        <button
          onClick={() => { onChange(''); setOpen(false); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && matches.length > 0 && pos && (
        <div
          className="fixed z-[200] max-h-72 overflow-auto rounded-md border border-border bg-popover shadow-lg p-1 text-popover-foreground"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {matches.map((s, i) => (
            <button
              key={s.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                i === active ? 'bg-accent/60 text-foreground' : 'hover:bg-accent/40'
              }`}
            >
              <div className="font-data font-bold">{s.label}</div>
              {s.description && (
                <div className="text-[10px] text-muted-foreground truncate">{s.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function matchSearch(q: string, fields: (string | null | undefined)[]): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return fields.some(f => (f ?? '').toLowerCase().includes(s));
}

export function buildSubsList(items: { _family: Family | null; _subfamily: string | null }[], family: Family | null): string[] {
  if (!family) return [];
  const present = new Set(items.filter(a => a._family === family && a._subfamily).map(a => a._subfamily as string));
  return SUBFAMILIES[family].filter(s => present.has(s));
}
