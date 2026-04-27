import type { BrokerFilter } from '@/lib/trade-utils';

const BROKER_OPTIONS: { value: BrokerFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'darwinex', label: 'NKIS' },
  { value: 'octx', label: 'OCTX' },
];

export function BrokerSelector({
  value,
  onChange,
  compact,
}: {
  value: BrokerFilter;
  onChange: (v: BrokerFilter) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-1 p-0.5 rounded-md bg-secondary">
      {BROKER_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          } ${compact ? 'px-2 py-0.5' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
