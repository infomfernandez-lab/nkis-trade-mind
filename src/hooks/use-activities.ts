import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export type ActivityType =
  | 'CERRAR' | 'ABRIR' | 'BACKTEST' | 'REVISAR' | 'INFORME' | 'GASTO' | 'NOTA' | 'OTRO';
export type ActivityPriority = 'ALTA' | 'MEDIA' | 'BAJA';
export type ActivityStatus = 'PENDIENTE' | 'HECHO' | 'CANCELADO';

export interface Activity {
  id: string;
  user_id: string | null;
  symbol: string | null;
  broker: string | null;
  title: string;
  description: string | null;
  type: ActivityType;
  priority: ActivityPriority;
  status: ActivityStatus;
  due_date: string | null;
  done_at: string | null;
  created_at: string | null;
}

export interface NewActivity {
  title: string;
  type: ActivityType;
  priority: ActivityPriority;
  due_date?: string | null;
  symbol?: string | null;
  broker?: string | null;
  description?: string | null;
}

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: NewActivity) => {
      if (!user) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('activities')
        .insert({ ...input, user_id: user.id, status: 'PENDIENTE' })
        .select()
        .single();
      if (error) throw error;
      return data as Activity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Activity> & { id: string }) => {
      const { data, error } = await supabase
        .from('activities')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Activity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  });
}

export function useToggleActivityDone() {
  const update = useUpdateActivity();
  return (a: Activity) => {
    const done = a.status === 'HECHO';
    return update.mutateAsync({
      id: a.id,
      status: done ? 'PENDIENTE' : 'HECHO',
      done_at: done ? null : new Date().toISOString(),
    });
  };
}
