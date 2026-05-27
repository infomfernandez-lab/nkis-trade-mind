import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useDeleteActivity, useToggleActivityDone, type Activity } from '@/hooks/use-activities';
import { TYPE_ICON, TYPE_COLOR, PRIORITY_BADGE, isOverdue } from './activity-utils';
import { useRightPanel } from '@/contexts/RightPanelContext';
import { getContractSpec } from '@/lib/contract-specs';

export function ActivityRow({ activity }: { activity: Activity }) {
  const toggle = useToggleActivityDone();
  const del = useDeleteActivity();
  const { openPanel } = useRightPanel();
  const Icon = TYPE_ICON[activity.type];
  const overdue = isOverdue(activity.due_date, activity.status);
  const done = activity.status === 'HECHO';
  const cancelled = activity.status === 'CANCELADO';

  const onSymbolClick = () => {
    if (!activity.symbol) return;
    const spec = getContractSpec(activity.symbol);
    openPanel(
      <div className="space-y-2 text-sm">
        <div className="font-bold text-base">{activity.symbol}</div>
        {spec && (
          <>
            <div className="text-muted-foreground">{spec.description}</div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <div><span className="text-muted-foreground">Broker:</span> {spec.broker.toUpperCase()}</div>
              <div><span className="text-muted-foreground">Tick:</span> {spec.tickSize}</div>
              <div><span className="text-muted-foreground">Tick value:</span> {spec.tickValue} {spec.profitCurrency}</div>
              <div><span className="text-muted-foreground">Contract size:</span> {spec.contractSize}</div>
            </div>
          </>
        )}
      </div>,
      activity.symbol,
    );
  };

  const due = activity.due_date ? new Date(activity.due_date) : null;
  const dueStr = due ? due.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${overdue ? 'bg-destructive/5 border-l-2 border-destructive' : ''}`}>
      <Checkbox checked={done} onCheckedChange={() => toggle(activity)} />
      <Icon className={`w-4 h-4 shrink-0 ${TYPE_COLOR[activity.type]}`} />
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${PRIORITY_BADGE[activity.priority]}`}>
        {activity.priority}
      </span>
      <div className={`flex-1 min-w-0 ${done || cancelled ? 'opacity-50 line-through' : ''}`}>
        <div className="text-sm font-semibold truncate">{activity.title}</div>
        {activity.description && (
          <div className="text-xs text-muted-foreground truncate">{activity.description}</div>
        )}
      </div>
      {activity.symbol && (
        <button
          onClick={onSymbolClick}
          className="px-2 py-0.5 rounded text-[11px] font-data font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
        >
          {activity.symbol}
        </button>
      )}
      <span className={`text-xs font-data shrink-0 w-20 text-right ${overdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
        {dueStr}
      </span>
      <button
        onClick={() => { if (confirm('¿Eliminar esta actividad?')) del.mutate(activity.id); }}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        aria-label="Eliminar"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
