import { useMemo, useState } from 'react';
import { Plus, List, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActivities, type Activity, type ActivityStatus, type ActivityType } from '@/hooks/use-activities';
import { NewActivityDialog } from './NewActivityDialog';
import { ActivityRow } from './ActivityRow';
import { TYPE_OPTIONS, isSameDay } from './activity-utils';

type DateRange = 'today' | 'week' | 'month' | 'all';
type View = 'list' | 'calendar';

const DATE_LABEL: Record<DateRange, string> = { today: 'Hoy', week: 'Esta semana', month: 'Este mes', all: 'Todas' };
const STATUS_LABEL: Record<'all' | ActivityStatus, string> = { all: 'Todos', PENDIENTE: 'PENDIENTE', HECHO: 'HECHO', CANCELADO: 'CANCELADO' };

function inRange(due: string | null, range: DateRange): boolean {
  if (range === 'all') return true;
  if (!due) return false;
  const d = new Date(due);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (range === 'today') return isSameDay(d, today);
  if (range === 'week') {
    const start = new Date(today); start.setDate(today.getDate() - today.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }
  if (range === 'month') return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  return true;
}

export default function AgendaPage() {
  const { data: activities, isLoading } = useActivities();
  const [view, setView] = useState<View>('list');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ActivityStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const openEdit = (a: Activity) => { setEditing(a); setDialogOpen(true); };
  const openNew = () => { setEditing(null); setDialogOpen(true); };

  const filtered = useMemo(() => {
    const list = (activities ?? []).filter(a => {
      if (!inRange(a.due_date, dateRange)) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      return true;
    });
    return list.sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
  }, [activities, dateRange, statusFilter, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of filtered) {
      const key = a.due_date ?? 'Sin fecha';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tareas y recordatorios</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            <button onClick={() => setView('list')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <List className="w-3.5 h-3.5" /> Lista
            </button>
            <button onClick={() => setView('calendar')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1 ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
              <CalendarIcon className="w-3.5 h-3.5" /> Calendario
            </button>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="w-4 h-4" /> Nueva actividad
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <ToggleGroup
          options={(['today', 'week', 'month', 'all'] as DateRange[]).map(r => ({ value: r, label: DATE_LABEL[r] }))}
          value={dateRange} onChange={setDateRange}
        />
        <ToggleGroup
          options={(['all', 'PENDIENTE', 'HECHO', 'CANCELADO'] as const).map(s => ({ value: s, label: STATUS_LABEL[s] }))}
          value={statusFilter} onChange={setStatusFilter}
        />
        <ToggleGroup
          options={[{ value: 'all' as const, label: 'Todos' }, ...TYPE_OPTIONS.filter(t => t !== 'OTRO').map(t => ({ value: t, label: t }))]}
          value={typeFilter} onChange={setTypeFilter}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'list' ? (
        <ListView grouped={grouped} onEdit={openEdit} />
      ) : (
        <CalendarView activities={filtered} />
      )}

      <NewActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} activity={editing} />
    </div>
  );
}

function ToggleGroup<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
            value === o.value
              ? 'bg-primary/10 text-primary border-primary/40'
              : 'bg-card text-muted-foreground border-border hover:text-foreground'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ListView({ grouped, onEdit }: { grouped: [string, Activity[]][]; onEdit: (a: Activity) => void }) {
  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay actividades para los filtros seleccionados.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {grouped.map(([dateKey, items]) => {
        const label = dateKey === 'Sin fecha'
          ? 'Sin fecha'
          : new Date(dateKey).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        return (
          <div key={dateKey}>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{label}</div>
            <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
              {items.map(a => <ActivityRow key={a.id} activity={a} onEdit={onEdit} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ activities }: { activities: Activity[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // monday-first
  const totalDays = lastDay.getDate();
  const cells: (Date | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const byDay = new Map<string, Activity[]>();
  for (const a of activities) {
    if (!a.due_date) continue;
    const arr = byDay.get(a.due_date) ?? [];
    arr.push(a); byDay.set(a.due_date, arr);
  }

  const monthLabel = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <button className="px-2 py-1 text-sm rounded hover:bg-accent" onClick={() => setCursor(new Date(year, month - 1, 1))}>←</button>
        <div className="font-semibold capitalize">{monthLabel}</div>
        <button className="px-2 py-1 text-sm rounded hover:bg-accent" onClick={() => setCursor(new Date(year, month + 1, 1))}>→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase text-muted-foreground mb-1">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} className="px-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-20" />;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const items = byDay.get(key) ?? [];
          const isToday = isSameDay(d, new Date());
          return (
            <div key={i} className={`h-20 border border-border rounded p-1 overflow-hidden ${isToday ? 'border-primary bg-primary/5' : ''}`}>
              <div className="text-[10px] font-bold text-muted-foreground">{d.getDate()}</div>
              <div className="space-y-0.5 mt-0.5">
                {items.slice(0, 2).map(a => (
                  <div key={a.id} className="text-[10px] truncate px-1 rounded bg-primary/10 text-primary">{a.title}</div>
                ))}
                {items.length > 2 && <div className="text-[10px] text-muted-foreground">+{items.length - 2}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
