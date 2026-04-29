import { useEffect, useState } from 'react';

export interface AnchorItem {
  id: string;
  label: string;
}

interface Props {
  items: AnchorItem[];
}

export function AnchorNav({ items }: Props) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that is most visible near the top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Trigger when section enters the area below the sticky nav
        rootMargin: '-120px 0px -60% 0px',
        threshold: 0,
      }
    );

    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    // Try scrolling the page first
    window.scrollTo({ top, behavior: 'smooth' });
    // Also try scrolling within main scroll container (used by AppLayout)
    const main = el.closest('main');
    if (main) {
      const mainTop = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - 80;
      main.scrollTo({ top: mainTop, behavior: 'smooth' });
    }
    setActiveId(id);
  };

  if (items.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {items.map((it) => {
          const active = activeId === it.id;
          return (
            <button
              key={it.id}
              onClick={() => handleClick(it.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ${
                active
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-secondary text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
