import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, X } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string = string> {
  key: K | null;
  dir: SortDir;
}

export function useSort<K extends string>(initial: SortState<K> = { key: null, dir: 'desc' }) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K) => {
    setSort(prev => {
      if (prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return { key: null, dir: 'desc' };
    });
  };
  return { sort, setSort, toggle };
}

export function applySort<T, K extends string>(
  items: T[],
  sort: SortState<K>,
  getters: Partial<Record<K, (t: T) => string | number | null | undefined>>,
): T[] {
  if (!sort.key) return items;
  const get = getters[sort.key];
  if (!get) return items;
  const mult = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    const aNull = va == null;
    const bNull = vb == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
    return String(va).localeCompare(String(vb)) * mult;
  });
}

export function SortHeader<K extends string>({
  label,
  sortKey,
  state,
  onToggle,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: K;
  state: SortState<K>;
  onToggle: (k: K) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}) {
  const active = state.key === sortKey;
  const Icon = !active ? ArrowUpDown : state.dir === 'asc' ? ArrowUp : ArrowDown;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={`px-2 py-2 text-${align} ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 w-full ${justify} hover:text-foreground transition-colors ${
          active ? 'text-primary' : ''
        }`}
      >
        <span>{label}</span>
        <Icon className="w-3 h-3 opacity-70" />
      </button>
    </th>
  );
}

/** Search + limit controls, used in the section toolbar */
export function TableSearchLimit({
  search,
  onSearchChange,
  limit,
  onLimitChange,
  total,
  shown,
  limitOptions = [10, 25, 50, 100, 0],
  suggestions = [],
}: {
  search: string;
  onSearchChange: (v: string) => void;
  limit: number;
  onLimitChange: (n: number) => void;
  total: number;
  shown: number;
  limitOptions?: number[];
  /** Lista de sugerencias (símbolos del radar) para el autocompletado. */
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
      if (r) setPos({ top: r.bottom + 4, left: r.left });
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
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const uniq = Array.from(new Set(suggestions));
    const starts = uniq.filter(s => s.toLowerCase().startsWith(q));
    const incl = uniq.filter(s => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    return [...starts, ...incl].slice(0, 8);
  }, [search, suggestions]);

  const choose = (val: string) => {
    onSearchChange(val);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative" ref={wrapRef}>
        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => { onSearchChange(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (!open || matches.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % matches.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + matches.length) % matches.length); }
            else if (e.key === 'Enter') { e.preventDefault(); choose(matches[active]); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
          placeholder="Buscar…"
          className="pl-6 pr-6 py-0.5 h-6 w-36 rounded text-[11px] bg-background border border-border focus:outline-none focus:border-primary/50"
        />
        {search && (
          <button
            onClick={() => { onSearchChange(''); setOpen(false); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpiar"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {open && matches.length > 0 && pos && (
          <div
            className="fixed z-[200] w-48 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-lg p-1 text-popover-foreground"
            style={{ top: pos.top, left: pos.left }}
          >
            {matches.map((s, i) => (
              <button
                key={s}
                type="button"
                onMouseDown={e => { e.preventDefault(); choose(s); }}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-2 py-1 rounded text-[11px] font-data ${
                  i === active ? 'bg-accent/60 text-foreground' : 'hover:bg-accent/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <LimitDropdown limit={limit} onChange={onLimitChange} options={limitOptions} />
      <span className="text-[10px] text-muted-foreground">{shown} de {total}</span>
    </div>
  );
}

function LimitDropdown({ limit, onChange, options }: { limit: number; onChange: (n: number) => void; options: number[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);
  const label = limit === 0 ? 'Todos' : `Top ${limit}`;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2 h-6 rounded text-[11px] border border-border hover:border-primary/40 hover:text-foreground"
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 w-28 rounded-md border border-border bg-popover shadow-lg p-1 text-popover-foreground">
          {options.map(n => (
            <button
              key={n}
              onClick={() => { onChange(n); setOpen(false); }}
              className={`w-full text-left px-2 py-1 rounded text-[11px] hover:bg-accent/40 ${
                limit === n ? 'text-primary font-semibold' : ''
              }`}
            >
              {n === 0 ? 'Todos' : `Top ${n}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function applyLimit<T>(items: T[], limit: number): T[] {
  if (!limit || limit <= 0) return items;
  return items.slice(0, limit);
}

export function applySearch<T>(items: T[], q: string, fields: (t: T) => string[]): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter(it => fields(it).some(f => (f ?? '').toLowerCase().includes(s)));
}

export function useTableControls<K extends string>(initial?: SortState<K>) {
  const sortApi = useSort<K>(initial);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(0);
  return { ...sortApi, search, setSearch, limit, setLimit };
}

export function useFiltered<T, K extends string>(
  items: T[],
  controls: { sort: SortState<K>; search: string; limit: number },
  getters: Partial<Record<K, (t: T) => string | number | null | undefined>>,
  searchFields: (t: T) => string[],
) {
  return useMemo(() => {
    const s = applySearch(items, controls.search, searchFields);
    const so = applySort(s, controls.sort, getters);
    return applyLimit(so, controls.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, controls.sort, controls.search, controls.limit]);
}
