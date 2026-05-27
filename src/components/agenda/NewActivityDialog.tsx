import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  useCreateActivity, useUpdateActivity,
  type Activity, type ActivityType, type ActivityPriority,
} from '@/hooks/use-activities';
import { TYPE_OPTIONS, PRIORITY_OPTIONS, todayISO } from './activity-utils';
import { CONTRACT_SPECS } from '@/lib/contract-specs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  activity?: Activity | null;
}

export function NewActivityDialog({ open, onOpenChange, defaultDate, activity }: Props) {
  const create = useCreateActivity();
  const update = useUpdateActivity();
  const editing = !!activity;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActivityType>('REVISAR');
  const [priority, setPriority] = useState<ActivityPriority>('MEDIA');
  const [dueDate, setDueDate] = useState(defaultDate ?? todayISO());
  const [symbol, setSymbol] = useState('');
  const [broker, setBroker] = useState<'' | 'nkis' | 'octx'>('');
  const [description, setDescription] = useState('');

  // Sync form when the dialog opens (with or without an activity to edit)
  useEffect(() => {
    if (!open) return;
    if (activity) {
      setTitle(activity.title ?? '');
      setType((activity.type as ActivityType) ?? 'REVISAR');
      setPriority((activity.priority as ActivityPriority) ?? 'MEDIA');
      setDueDate(activity.due_date ?? defaultDate ?? todayISO());
      setSymbol(activity.symbol ?? '');
      setBroker(((activity.broker as 'nkis' | 'octx') ?? '') as '' | 'nkis' | 'octx');
      setDescription(activity.description ?? '');
    } else {
      setTitle(''); setType('REVISAR'); setPriority('MEDIA');
      setDueDate(defaultDate ?? todayISO()); setSymbol(''); setBroker(''); setDescription('');
    }
  }, [open, activity, defaultDate]);

  const symbolMatches = useMemo(() => {
    const q = symbol.trim().toUpperCase();
    if (!q) return [];
    return CONTRACT_SPECS.filter(s => s.symbol.toUpperCase().includes(q)).slice(0, 8);
  }, [symbol]);

  const handleSave = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      type,
      priority,
      due_date: dueDate || null,
      symbol: symbol.trim() || null,
      broker: broker || null,
      description: description.trim() || null,
    };
    if (editing && activity) {
      await update.mutateAsync({ id: activity.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar actividad' : 'Nueva actividad'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Título *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué hay que hacer?" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as ActivityType)}
                className="w-full h-9 px-2 rounded-md border border-input bg-transparent text-sm">
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prioridad</label>
              <select value={priority} onChange={e => setPriority(e.target.value as ActivityPriority)}
                className="w-full h-9 px-2 rounded-md border border-input bg-transparent text-sm">
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fecha vencimiento</label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-xs text-muted-foreground">Símbolo</label>
              <Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="ej. ES_H" list="symbol-list" />
              <datalist id="symbol-list">
                {symbolMatches.map(s => <option key={`${s.symbol}-${s.broker}`} value={s.symbol}>{s.description}</option>)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Broker</label>
              <select value={broker} onChange={e => setBroker(e.target.value as '' | 'nkis' | 'octx')}
                className="w-full h-9 px-2 rounded-md border border-input bg-transparent text-sm">
                <option value="">—</option>
                <option value="nkis">NKIS</option>
                <option value="octx">OCTX</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descripción</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!title.trim() || pending}>
            {pending ? 'Guardando…' : editing ? 'Actualizar' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
