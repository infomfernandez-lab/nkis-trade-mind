import { useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function InfoTip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex ${className ?? ''}`}
          aria-label="Más información"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        >
          <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="max-w-[260px] text-sm p-3 leading-snug"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
