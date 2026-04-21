import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  countLabel?: string;
  tone?: 'alert';
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleBlock({ id, title, countLabel, tone, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isAlert = tone === 'alert';

  return (
    <section id={id} className="space-y-2 scroll-mt-20">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
          isAlert
            ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/15'
            : 'bg-card border-border hover:bg-accent/30'
        }`}
      >
        {isAlert && <Zap className="w-4 h-4 animate-pulse" />}
        <h2 className={`font-display font-bold text-sm ${isAlert ? 'text-destructive' : 'text-foreground'}`}>{title}</h2>
        {countLabel && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isAlert ? 'bg-destructive/20 text-destructive border border-destructive/40' : 'bg-secondary text-muted-foreground border border-border'
          }`}>{countLabel}</span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
