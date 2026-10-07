import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EscanerCruce { estado?: 'hoy' | 'falta' | 'encima' | string; nivel?: number; falta?: number; texto?: string }
export interface EscanerHist { t?: string[]; c?: number[]; e50?: (number | null)[]; s200?: (number | null)[]; v?: (number | null)[]; sc?: (number | null)[] }
export interface EscanerFila {
  raiz: string; nombre?: string; simbolo?: string; familia?: string; tema?: string;
  score?: number; lado?: number; fuerza?: number; cat?: string; potencial?: string | null; puntos?: number;
  razones?: [string, string][]; liquidez?: string; presion?: number | null; semanal?: number;
  cambio5?: number | null; dist?: number | null; edad?: number | null; cruce?: EscanerCruce;
  precio?: number | null; dias_venc?: number | null; vencimiento?: string | null; hist?: EscanerHist;
}
export interface EscanerDatos {
  version?: unknown; generado?: string; fecha_datos?: string; fuente?: unknown; cuenta?: unknown;
  config?: unknown; avisos?: { tipo?: string; texto?: string }[]; filas?: EscanerFila[];
}
export interface EscanerFoto { id: string; fecha_datos: string; generado: string | null; datos: EscanerDatos; created_at: string }

export function useEscanerFoto() {
  return useQuery({
    queryKey: ['escaner-foto', 'latest'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('escaner_fotos')
        .select('*')
        .order('fecha_datos', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EscanerFoto | null;
    },
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function fotoDesactualizada(fecha?: string | null): boolean {
  if (!fecha) return true;
  const d = new Date(fecha.slice(0, 10) + 'T00:00:00');
  return Date.now() - d.getTime() > 3 * 24 * 3600 * 1000;
}

export function fmtFecha(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d.getTime())) return s;
  const f = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return s.length <= 10 ? f : `${f} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

export const nf = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

export const signed = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : `${Number(n) > 0 ? '+' : ''}${nf(n, d)}`;
