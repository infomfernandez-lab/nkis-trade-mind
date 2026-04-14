import type { BrokerFilter } from '@/lib/trade-utils';

const BROKER_OPTIONS: { value: BrokerFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'darwinex', label: 'Darwinex' },
  { value: 'fxpro', label: 'FXPro' },
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
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          } ${compact ? 'px-2 py-0.5' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
