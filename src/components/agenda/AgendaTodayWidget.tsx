import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import { useActivities } from '@/hooks/use-activities';
import { ActivityRow } from './ActivityRow';
import { PRIORITY_RANK, todayISO } from './activity-utils';

export function AgendaTodayWidget() {
  const { data } = useActivities();
  const today = todayISO();
  const items = useMemo(() => {
    return (data ?? [])
      .filter(a => a.due_date === today && a.status === 'PENDIENTE')
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }, [data, today]);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card border-border">
        <CalendarCheck className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm text-foreground">AGENDA DE HOY</h2>
        <Link
          to="/agenda"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
        >
          Ver agenda <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No tienes actividades pendientes para hoy.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {items.map(a => <ActivityRow key={a.id} activity={a} />)}
        </div>
      )}
    </section>
  );
}
