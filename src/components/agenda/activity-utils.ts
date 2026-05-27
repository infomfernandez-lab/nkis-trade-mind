import {
  X, ArrowUp, BarChart3, Eye, FileText, DollarSign, StickyNote, Circle,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityType, ActivityPriority } from '@/hooks/use-activities';

export const TYPE_OPTIONS: ActivityType[] = ['CERRAR', 'ABRIR', 'BACKTEST', 'REVISAR', 'INFORME', 'GASTO', 'NOTA', 'OTRO'];
export const PRIORITY_OPTIONS: ActivityPriority[] = ['ALTA', 'MEDIA', 'BAJA'];

export const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  CERRAR: X,
  ABRIR: ArrowUp,
  BACKTEST: BarChart3,
  REVISAR: Eye,
  INFORME: FileText,
  GASTO: DollarSign,
  NOTA: StickyNote,
  OTRO: Circle,
};

export const TYPE_COLOR: Record<ActivityType, string> = {
  CERRAR: 'text-destructive',
  ABRIR: 'text-success',
  BACKTEST: 'text-primary',
  REVISAR: 'text-amber-500',
  INFORME: 'text-blue-500',
  GASTO: 'text-emerald-500',
  NOTA: 'text-muted-foreground',
  OTRO: 'text-muted-foreground',
};

export const PRIORITY_BADGE: Record<ActivityPriority, string> = {
  ALTA: 'bg-destructive/15 text-destructive border-destructive/40',
  MEDIA: 'bg-amber-500/15 text-amber-600 border-amber-500/40',
  BAJA: 'bg-secondary text-muted-foreground border-border',
};

export const PRIORITY_RANK: Record<ActivityPriority, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

export function isOverdue(due: string | null | undefined, status: string) {
  if (!due || status !== 'PENDIENTE') return false;
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
