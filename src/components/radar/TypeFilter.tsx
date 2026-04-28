import { useState, useRef, useEffect } from 'react';
import { Filter, Check } from 'lucide-react';
import { ALL_TYPES, TYPE_LABEL, TYPE_ICON, type InstrumentType } from '@/lib/instrument-classify';

interface Props {
  selected: Set<InstrumentType>;
  onChange: (next: Set<InstrumentType>) => void;
  availableCounts?: Partial<Record<InstrumentType, number>>;
  label?: string;
}

export function TypeFilter({ selected, onChange, availableCounts, label = 'Tipo' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const allSelected = selected.size === 0; // vacío = todos
  const buttonLabel = allSelected
    ? `${label}: Todos`
    : `${label}: ${selected.size}`;

  const toggle = (t: InstrumentType) => {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onChange(next);
  };

  const selectAll = () => onChange(new Set());
  const visibleTypes = ALL_TYPES.filter(t => !availableCounts || (availableCounts[t] ?? 0) > 0);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
          allSelected
            ? 'border-border text-muted-foreground hover:bg-accent/30'
            : 'border-primary/50 text-primary bg-primary/10 hover:bg-primary/20'
        }`}
      >
        <Filter className="w-3 h-3" />
        {buttonLabel}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 w-56 rounded-md border border-border bg-popover shadow-lg p-1.5 text-popover-foreground">
          <button
            onClick={selectAll}
            className="w-full text-left px-2 py-1 rounded text-[11px] font-semibold hover:bg-accent/40 flex items-center justify-between"
          >
            <span>Mostrar todos</span>
            {allSelected && <Check className="w-3 h-3 text-primary" />}
          </button>
          <div className="my-1 h-px bg-border" />
          {visibleTypes.map(t => {
            const isOn = selected.has(t);
            const count = availableCounts?.[t];
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-accent/40 flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5">
                  <span>{TYPE_ICON[t]}</span>
                  <span className={isOn ? 'font-bold text-primary' : ''}>{TYPE_LABEL[t]}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {count != null && <span className="text-[10px] text-muted-foreground">{count}</span>}
                  {isOn && <Check className="w-3 h-3 text-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
