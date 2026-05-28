import { Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Checkbox } from '@/components/ui/checkbox';
import { useDeleteActivity, useToggleActivityDone, type Activity } from '@/hooks/use-activities';
import { TYPE_ICON, TYPE_COLOR, PRIORITY_BADGE, isOverdue } from './activity-utils';

interface Props {
  activity: Activity;
  onEdit?: (a: Activity) => void;
}

export function ActivityRow({ activity, onEdit }: Props) {
  const toggle = useToggleActivityDone();
  const del = useDeleteActivity();
  const navigate = useNavigate();
  const Icon = TYPE_ICON[activity.type];
  const overdue = isOverdue(activity.due_date, activity.status);
  const done = activity.status === 'HECHO';
  const cancelled = activity.status === 'CANCELADO';

  const onSymbolClick = () => {
    if (!activity.symbol) return;
    const broker = activity.broker === 'darwinex' ? 'nkis' : (activity.broker || 'octx');
    navigate({ to: '/activos/$broker/$symbol', params: { broker, symbol: activity.symbol } });
  };

  const due = activity.due_date ? new Date(activity.due_date) : null;
  const dueStr = due
    ? due.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })
    : 'Sin fecha';

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 ${overdue ? 'bg-destructive/5 border-l-2 border-destructive' : ''}`}>
      <div className="pt-0.5">
        <Checkbox checked={done} onCheckedChange={() => toggle(activity)} />
      </div>
      <Icon className={`w-4 h-4 shrink-0 mt-1 ${TYPE_COLOR[activity.type]}`} />
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 mt-0.5 ${PRIORITY_BADGE[activity.priority]}`}>
        {activity.priority}
      </span>
      <div className={`flex-1 min-w-0 ${done || cancelled ? 'opacity-50 line-through' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{activity.title}</span>
          {activity.symbol && (
            <button
              onClick={onSymbolClick}
              className="px-2 py-0.5 rounded text-[11px] font-data font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
              title="Ver info del activo"
            >
              {activity.symbol}
            </button>
          )}
        </div>
        {activity.description && (
          <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
            {activity.description}
          </div>
        )}
      </div>
      <span className={`text-xs font-data shrink-0 text-right mt-0.5 ${overdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
        {dueStr}
      </span>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {onEdit && (
          <button
            onClick={() => onEdit(activity)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Editar"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => { if (confirm('¿Eliminar esta actividad?')) del.mutate(activity.id); }}
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Eliminar"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
