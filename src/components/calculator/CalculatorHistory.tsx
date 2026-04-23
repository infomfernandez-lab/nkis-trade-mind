import { Fragment, useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type CalcRecord = {
  id: string;
  created_at: string;
  instrumento: string | null;
  broker: string | null;
  direccion: string | null;
  precio_entrada: number | null;
  stop_loss: number | null;
  distancia_stop: number | null;
  lotes: number | null;
  riesgo_real: number | null;
  breakeven_precio: number | null;
  breakeven_sl: number | null;
  trailing_sl: number | null;
  atr: number | null;
  valor_punto: number | null;
  cuenta_balance: number | null;
  vix: number | null;
};

const PAGE = 20;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
};
const fmtN = (n: number | null, d = 4) =>
  n != null && Number.isFinite(n) ? Number(n).toFixed(d) : '—';
const fmtEur = (n: number | null) =>
  n != null && Number.isFinite(n) ? `€${Math.round(Number(n)).toLocaleString('es-ES')}` : '—';

type Props = {
  onRecover: (r: CalcRecord) => void;
};

export function CalculatorHistory({ onRecover }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CalcRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [brokerFilter, setBrokerFilter] = useState<'all' | 'darwinex' | 'fxpro'>('all');
  const [dirFilter, setDirFilter] = useState<'all' | 'BUY' | 'SELL'>('all');

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    setLoading(true);
    try {
      const { data, error, count: total } = await (supabase as any)
        .from('calculadora_registro')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      const list = (data ?? []) as CalcRecord[];
      setRows(prev => (replace ? list : [...prev, ...list]));
      if (typeof total === 'number') setCount(total);
      setHasMore((offset + list.length) < (total ?? 0));
    } catch (e: any) {
      toast.error('Error cargando historial', { description: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load count even when collapsed
  useEffect(() => {
    (async () => {
      const { count: total } = await (supabase as any)
        .from('calculadora_registro')
        .select('*', { count: 'exact', head: true });
      if (typeof total === 'number') setCount(total);
    })();
  }, []);

  useEffect(() => {
    if (open && rows.length === 0) fetchPage(0, true);
  }, [open, rows.length, fetchPage]);

  const filtered = useMemo(() => {
    return rows.filter(r =>
      (brokerFilter === 'all' || r.broker === brokerFilter) &&
      (dirFilter === 'all' || r.direccion === dirFilter),
    );
  }, [rows, brokerFilter, dirFilter]);

  const totals = useMemo(() => {
    const buy = filtered.filter(r => r.direccion === 'BUY').length;
    const sell = filtered.filter(r => r.direccion === 'SELL').length;
    const risk = filtered.reduce((s, r) => s + (Number(r.riesgo_real) || 0), 0);
    return { buy, sell, risk };
  }, [filtered]);

  const refresh = () => fetchPage(0, true);
  const loadMore = () => fetchPage(rows.length, false);

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
          📂 Historial de cálculos
          <span className="text-muted-foreground font-normal normal-case tracking-normal">
            {count != null ? `(${count} registros)` : ''}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 py-3">
            <FilterGroup
              value={brokerFilter}
              onChange={setBrokerFilter}
              options={[
                { v: 'all', label: 'Todos brokers' },
                { v: 'darwinex', label: 'Darwinex' },
                { v: 'fxpro', label: 'FXPro' },
              ]}
            />
            <FilterGroup
              value={dirFilter}
              onChange={setDirFilter}
              options={[
                { v: 'all', label: 'Todos' },
                { v: 'BUY', label: '▲ BUY' },
                { v: 'SELL', label: '▼ SELL' },
              ]}
            />
            <button
              onClick={refresh}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-muted-foreground text-xs font-medium hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs font-data">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Inst</th>
                  <th className="px-3 py-2 text-left font-semibold">Dir</th>
                  <th className="px-3 py-2 text-right font-semibold">Entrada</th>
                  <th className="px-3 py-2 text-right font-semibold">SL</th>
                  <th className="px-3 py-2 text-right font-semibold">Lotes</th>
                  <th className="px-3 py-2 text-right font-semibold">Riesgo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      Sin registros
                    </td>
                  </tr>
                )}
                {filtered.map(r => {
                  const isOpen = expanded === r.id;
                  const isBuy = r.direccion === 'BUY';
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-t border-border hover:bg-secondary/30 cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.created_at)}</td>
                        <td className="px-3 py-2 font-semibold">{r.instrumento ?? '—'}</td>
                        <td className={`px-3 py-2 font-semibold ${isBuy ? 'text-success' : 'text-destructive'}`}>
                          {isBuy ? '▲ BUY' : '▼ SELL'}
                        </td>
                        <td className="px-3 py-2 text-right">{fmtN(r.precio_entrada)}</td>
                        <td className="px-3 py-2 text-right">{fmtN(r.stop_loss)}</td>
                        <td className="px-3 py-2 text-right">{fmtN(r.lotes, 2)}</td>
                        <td className="px-3 py-2 text-right" style={{ color: '#D4A017' }}>
                          {fmtEur(r.riesgo_real)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); onRecover(r); toast.success(`✓ ${r.instrumento ?? '—'} recuperado`); }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[11px]"
                          >
                            <ClipboardList className="w-3 h-3" /> Recuperar
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${r.id}-d`} className="border-t border-border bg-secondary/20">
                          <td colSpan={8} className="px-4 py-3 text-xs text-muted-foreground">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              <div>
                                <span className="text-foreground/70">Breakeven:</span>{' '}
                                {fmtN(r.breakeven_precio)} → mover SL a {fmtN(r.breakeven_sl)}
                              </div>
                              <div>
                                <span className="text-foreground/70">Trailing SL:</span>{' '}
                                ATR × 3 = {fmtN(r.trailing_sl)}
                              </div>
                              <div>
                                <span className="text-foreground/70">ATR:</span> {fmtN(r.atr)} ·{' '}
                                <span className="text-foreground/70">Valor punto:</span> {fmtN(r.valor_punto, 4)} ·{' '}
                                <span className="text-foreground/70">VIX:</span> {r.vix != null ? Number(r.vix).toFixed(2) : '—'}
                              </div>
                              <div>
                                <span className="text-foreground/70">Broker:</span> {r.broker ?? '—'} ·{' '}
                                <span className="text-foreground/70">Balance:</span>{' '}
                                {r.cuenta_balance != null ? `€${Number(r.cuenta_balance).toLocaleString('es-ES')}` : '—'}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer / totales */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-muted-foreground">
            <div>
              Mostrados: <span className="text-foreground font-semibold">{filtered.length}</span> ·{' '}
              Riesgo total: <span className="font-semibold" style={{ color: '#D4A017' }}>{fmtEur(totals.risk)}</span> ·{' '}
              <span className="text-success font-semibold">BUY: {totals.buy}</span> ·{' '}
              <span className="text-destructive font-semibold">SELL: {totals.sell}</span>
            </div>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-3 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {loading ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FilterGroup<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {options.map(o => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 text-[11px] font-medium ${
            value === o.v ? 'bg-primary/15 text-primary' : 'bg-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
