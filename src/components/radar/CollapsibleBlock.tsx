import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { STAGE_META, type QualificationStage } from '@/hooks/use-qualification';

interface Props {
  id: string;
  title: string;
  countLabel?: string;
  tone?: 'alert';
  /** Optional qualification stage to color-code the header. */
  stage?: QualificationStage;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleBlock({ id, title, countLabel, tone, stage, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const isAlert = tone === 'alert';
  const stageMeta = stage ? STAGE_META[stage] : null;

  const headerCls = isAlert
    ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/15'
    : stageMeta
      ? `${stageMeta.header} hover:brightness-110`
      : 'bg-card border-border hover:bg-accent/30';

  const titleCls = isAlert
    ? 'text-destructive'
    : stageMeta
      ? '' // stage header already sets text color
      : 'text-foreground';

  const countCls = isAlert
    ? 'bg-destructive/20 text-destructive border border-destructive/40'
    : stageMeta
      ? `border ${stageMeta.badge}`
      : 'bg-secondary text-muted-foreground border border-border';

  return (
    <section id={id} className="space-y-2 scroll-mt-20">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${headerCls}`}
      >
        {isAlert && <Zap className="w-4 h-4 animate-pulse" />}
        <h2 className={`font-display font-bold text-sm ${titleCls}`}>{title}</h2>
        {countLabel && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${countCls}`}>{countLabel}</span>
        )}
        <span className="ml-auto opacity-70">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
