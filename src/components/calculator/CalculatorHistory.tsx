import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Link2, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { raiz } from '@/lib/account';

export type CalcRecord = {
  id: string;
  created_at: string;
  instrumento: string | null;
  raiz?: string | null;
  direccion: string | null;
  precio_entrada: number | null;
  stop_loss: number | null;
  precio_objetivo?: number | null;
  atr: number | null;
  cuenta_balance: number | null;
  riesgo_pct_usado?: number | null;
  tipo_cambio?: number | null;
  contratos_exactos?: number | null;
  lotes: number | null;
  riesgo_real: number | null;
  riesgo_real_pct?: number | null;
  rr?: number | null;
  beneficio_potencial?: number | null;
  nota?: string | null;
  estado?: string | null;
  trade_id?: string | null;
};

const ESTADOS = [
  { v: 'all', l: 'Todos' }, { v: 'planificada', l: 'Planificada' },
  { v: 'entre', l: 'Entré' }, { v: 'no_entre', l: 'No entré' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const f = (n: number | null | undefined, d = 2) => (n != null && Number.isFinite(Number(n)) ? Number(n).toLocaleString('es-ES', { maximumFractionDigits: d }) : '—');

export function CalculatorHistory({ onRecover }: { onRecover: (r: CalcRecord) => void }) {
  const qc = useQueryClient();
  const [estado, setEstado] = useState('all');
  const [linking, setLinking] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ['calc-records'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('calculadora_registro').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data as CalcRecord[];
    },
  });

  const shown = rows.filter(r => estado === 'all' || (r.estado ?? 'planificada') === estado);

  const update = async (id: string, patch: Partial<CalcRecord>) => {
    const { error } = await (supabase as any).from('calculadora_registro').update(patch).eq('id', id);
    if (error) toast.error(`No se pudo actualizar: ${error.message}`);
    qc.invalidateQueries({ queryKey: ['calc-records'] });
  };
  const remove = async (id: string) => {
    if (!confirm('¿Borrar este cálculo?')) return;
    const { error } = await supabase.from('calculadora_registro').delete().eq('id', id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['calc-records'] });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display font-semibold">Cálculos guardados</h2>
        <div className="flex flex-wrap gap-1">
          {ESTADOS.map(e => (
            <button key={e.v} onClick={() => setEstado(e.v)}
              className={`px-2.5 py-1 rounded-md text-xs border ${estado === e.v ? 'bg-primary/15 border-primary/50 text-primary' : 'border-border text-muted-foreground'}`}>
              {e.l}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No hay cálculos.</p>}
      <div className="divide-y divide-border">
        {shown.map(r => {
          const st = r.estado ?? 'planificada';
          return (
            <div key={r.id} className="py-2.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-xs text-muted-foreground font-data">{fmtDate(r.created_at)}</span>
                <span className="font-data font-bold">{r.raiz || raiz(r.instrumento)}</span>
                <span className="text-[11px] text-muted-foreground font-data">{r.instrumento}</span>
                <span className={`text-xs font-bold ${r.direccion === 'SELL' ? 'text-destructive' : 'text-success'}`}>{r.direccion}</span>
                <span className="font-data text-xs">E {f(r.precio_entrada, 6)} · SL {f(r.stop_loss, 6)}{r.precio_objetivo != null ? ` · TP ${f(r.precio_objetivo, 6)}` : ''}</span>
                <span className="font-data text-xs"><b>{r.lotes ?? '—'}</b> ctr ({f(r.contratos_exactos)}) · {f(r.riesgo_real)} ({f(r.riesgo_real_pct, 3)} %){r.rr != null ? ` · R:R ${f(r.rr)}` : ''}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${st === 'entre' ? 'border-success/50 text-success' : st === 'no_entre' ? 'border-border text-muted-foreground' : 'border-primary/50 text-primary'}`}>
                  {st === 'entre' ? 'Entré' : st === 'no_entre' ? 'No entré' : 'Planificada'}
                </span>
              </div>
              {r.nota && <p className="text-xs text-muted-foreground italic">{r.nota}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Btn onClick={() => onRecover(r)}><RotateCcw className="w-3 h-3" /> Cargar</Btn>
                <Btn onClick={() => update(r.id, { estado: 'entre' })}><Check className="w-3 h-3" /> Entré</Btn>
                <Btn onClick={() => update(r.id, { estado: 'no_entre', trade_id: null })}><X className="w-3 h-3" /> No entré</Btn>
                {st === 'entre' && (
                  <Btn onClick={() => setLinking(linking === r.id ? null : r.id)}>
                    <Link2 className="w-3 h-3" /> {r.trade_id ? 'Vinculada' : 'Vincular operación'}
                  </Btn>
                )}
                <Btn onClick={() => remove(r.id)} danger><Trash2 className="w-3 h-3" /> Borrar</Btn>
              </div>
              {linking === r.id && <LinkTrade rec={r} onPick={id => { update(r.id, { trade_id: id }); setLinking(null); }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinkTrade({ rec, onPick }: { rec: CalcRecord; onPick: (id: string | null) => void }) {
  const root = rec.raiz || raiz(rec.instrumento);
  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['calc-link-trades', rec.id],
    queryFn: async () => {
      const base = new Date(rec.created_at).getTime();
      const from = new Date(base - 3 * 864e5).toISOString();
      const to = new Date(base + 7 * 864e5).toISOString();
      const { data, error } = await supabase.from('trades').select('*')
        .gte('entry_date', from).lte('entry_date', to).order('entry_date');
      if (error) throw error;
      return (data ?? []).filter((t: any) =>
        raiz(t.symbol) === root && String(t.direction).toUpperCase().startsWith(rec.direccion === 'SELL' ? 'S' : 'B'));
    },
  });
  const linked = trades.find((t: any) => t.id === rec.trade_id) as any;
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2 text-xs space-y-1">
      {isLoading && <p className="text-muted-foreground">Buscando operaciones…</p>}
      {!isLoading && trades.length === 0 && <p className="text-muted-foreground">No hay operaciones de {root} {rec.direccion} cerca de esa fecha.</p>}
      {trades.map((t: any) => (
        <button key={t.id} onClick={() => onPick(t.id)}
          className={`w-full flex flex-wrap gap-x-3 text-left px-2 py-1 rounded hover:bg-accent font-data ${t.id === rec.trade_id ? 'bg-primary/10' : ''}`}>
          <span>{fmtDate(t.entry_date)}</span><span>{t.symbol}</span><span>E {t.entry_price}</span>
          <span>SL {t.stop_loss ?? '—'}</span><span>{t.lot_size} ctr</span><span>P&L {t.net_pnl ?? t.gross_pnl ?? '—'}</span>
        </button>
      ))}
      {linked && (
        <div className="pt-1 border-t border-border font-data">
          Plan vs real · Entrada {rec.precio_entrada} → {linked.entry_price} · Contratos {rec.lotes} → {linked.lot_size}
          {linked.exit_price != null && <> · Salida {linked.exit_price}</>}
          <button onClick={() => onPick(null)} className="ml-2 text-destructive hover:underline">desvincular</button>
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${danger ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : 'border-border hover:bg-accent'}`}>
      {children}
    </button>
  );
}
