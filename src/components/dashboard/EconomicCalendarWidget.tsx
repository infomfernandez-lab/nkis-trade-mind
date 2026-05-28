import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';

type FFEvent = {
  title: string;
  country: string;
  date: string; // ISO
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  forecast: string;
  previous: string;
};

export function EconomicCalendarWidget() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['ff-calendar'],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const res = await fetch('/api/ff-calendar');
      if (!res.ok) throw new Error(`FF ${res.status}`);
      return (await res.json()) as FFEvent[];
    },
  });

  const today = new Date();
  const isSameDay = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const todayHigh = events
    .filter(e => e.impact === 'High' && isSameDay(new Date(e.date)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <CalendarClock className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm">CALENDARIO ECONÓMICO — HOY</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">Alta importancia</span>
      </header>
      <div className="p-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-4">Cargando…</div>
        ) : todayHigh.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-4">
            Sin eventos de alta importancia hoy.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {todayHigh.map((e, i) => {
              const d = new Date(e.date);
              const hhmm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
              return (
                <li key={i} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <span className="font-data text-foreground w-12 shrink-0">{hhmm}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-secondary border border-border w-10 text-center shrink-0">
                    {e.country}
                  </span>
                  <span className="truncate flex-1">{e.title}</span>
                  {e.forecast && (
                    <span className="font-data text-muted-foreground hidden md:inline shrink-0">
                      f: {e.forecast}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
