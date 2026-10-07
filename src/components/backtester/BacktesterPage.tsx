import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Play, Trash2, AlertTriangle, Loader2, FileText, Columns2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, AreaChart, Area, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/use-settings';
import { backtestServerHeaders } from '@/lib/account';
import {
  parseOperacionesCsv, variantStats, equity, groupR, isoDate, fmtPf, type CsvTrade, type VariantStats,
} from './csv-backtest';

type Session = {
  id: string;
  created_at: string;
  params: { tipo?: string; nombre?: string; fuente?: string; nota?: string; paramCols?: string[] };
  metrics: { variantes?: VariantStats[]; abiertas?: number; n?: number };
  trades: CsvTrade[];
  archivada?: boolean;
};

const SERVER_OFF = 'Servidor apagado: abre 4_SERVIDOR_BACKTEST.bat y ngrok en tu PC, y comprueba la URL en Ajustes';

function useSessions() {
  return useQuery({
    queryKey: ['backtest-imports'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('backtest_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as Session[]).filter(s => s.params?.tipo === 'import' && s.archivada !== true);
    },
  });
}

async function saveSession(csvText: string, nombre: string, fuente: string, nota: string) {
  const { trades, abiertas, paramCols } = parseOperacionesCsv(csvText);
  const variantes = variantStats(trades);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sin sesión');
  const { error } = await (supabase as any).from('backtest_sessions').insert({
    user_id: user.id,
    symbol: 'MULTI',
    broker: 'cwnd',
    direction: 'AMBAS',
    params: { tipo: 'import', nombre, fuente, nota, paramCols },
    metrics: { variantes, abiertas: abiertas.length, n: trades.length },
    trades,
    equity_curve: [],
  });
  if (error) throw error;
}

export default function BacktesterPage() {
  const qc = useQueryClient();
  const { data: sessions = [], isLoading } = useSessions();
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['backtest-imports'] });

  const current = sessions.find(s => s.id === selected) ?? sessions[0] ?? null;

  const del = async (id: string) => {
    await (supabase as any).from('backtest_sessions').delete().eq('id', id);
    refresh();
  };

  const compared = compare.map(id => sessions.find(s => s.id === id)).filter(Boolean) as Session[];

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Backtester</h1>
        <p className="text-sm text-muted-foreground mt-1">Importa el operaciones.csv de cualquiera de tus scripts o ejecútalo en tu PC.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ImportBlock onSaved={refresh} />
        <RunOnPcBlock onSaved={refresh} />
      </div>

      {/* Historial */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-display font-bold text-sm">HISTORIAL DE SESIONES</h2>
          {compare.length > 0 && <span className="text-xs text-muted-foreground">Comparando {compare.length}/2</span>}
        </div>
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aún no hay sesiones importadas.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map(s => (
              <li key={s.id} className={`flex items-center gap-3 px-2 py-2 text-sm ${current?.id === s.id ? 'bg-primary/10' : ''}`}>
                <input
                  type="checkbox"
                  title="Comparar"
                  checked={compare.includes(s.id)}
                  onChange={ev => setCompare(c => ev.target.checked ? [...c, s.id].slice(-2) : c.filter(x => x !== s.id))}
                />
                <button className="flex-1 text-left" onClick={() => setSelected(s.id)}>
                  <span className="font-semibold">{s.params?.nombre}</span>
                  <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary">{s.params?.fuente}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString('es-ES')} · {s.metrics?.n ?? 0} ops · {s.metrics?.variantes?.length ?? 0} variantes
                  </span>
                </button>
                <button onClick={() => del(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {compared.length === 2 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2"><Columns2 className="w-4 h-4 text-primary" /><h2 className="font-display font-bold">Comparación</h2>
            <button onClick={() => setCompare([])} className="ml-auto text-xs text-primary hover:underline">Cerrar comparación</button></div>
          <div className="grid xl:grid-cols-2 gap-4">
            {compared.map(s => <SessionView key={s.id} session={s} compact />)}
          </div>
        </section>
      ) : current ? <SessionView session={current} /> : null}
    </div>
  );
}

/* ───────── Importar ───────── */

function ImportBlock({ onSaved }: { onSaved: () => void }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [nombre, setNombre] = useState('');
  const [fuente, setFuente] = useState<'MT5' | 'YAHOO'>('MT5');
  const [nota, setNota] = useState('');
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => {
    if (!csv) return null;
    try { const p = parseOperacionesCsv(csv); return { ...p, variantes: new Set(p.trades.map(t => t.variante)).size, error: null }; }
    catch (e: any) { return { error: e.message as string } as any; }
  }, [csv]);

  const load = async (f: File) => { setFileName(f.name); setCsv(await f.text()); };

  const save = async () => {
    if (!csv || !nombre.trim()) { toast.error('Indica el nombre del sistema'); return; }
    setSaving(true);
    try { await saveSession(csv, nombre.trim(), fuente, nota); toast.success('Sesión guardada'); setCsv(null); setNombre(''); setNota(''); onSaved(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="font-display font-bold text-sm">IMPORTAR RESULTADOS (operaciones.csv)</h2>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) load(f); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed p-6 text-center text-sm ${drag ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground'}`}
      >
        <Upload className="w-5 h-5 mx-auto mb-1" />
        {fileName || 'Arrastra aquí el archivo o pulsa para elegirlo'}
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) load(f); }} />
      </div>
      {preview?.error && <p className="text-xs text-destructive">{preview.error}</p>}
      {preview && !preview.error && (
        <p className="text-xs text-muted-foreground">
          {preview.trades.length} operaciones cerradas · {preview.abiertas.length} abiertas · parámetros: {preview.paramCols.join(', ') || 'ninguno'} · {preview.variantes} variantes
        </p>
      )}
      {csv && !preview?.error && (
        <div className="space-y-2">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder='Nombre del sistema (p. ej. "Reglas Manuel – pivotes")'
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm" />
          <FuenteSelect value={fuente} onChange={setFuente} />
          <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional)" rows={2}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm" />
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Guardar e importar
          </button>
        </div>
      )}
    </section>
  );
}

function FuenteSelect({ value, onChange }: { value: 'MT5' | 'YAHOO'; onChange: (v: 'MT5' | 'YAHOO') => void }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {(['MT5', 'YAHOO'] as const).map(f => (
        <button key={f} onClick={() => onChange(f)}
          className={`px-4 py-1.5 text-xs font-bold ${value === f ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          {f === 'YAHOO' ? 'Yahoo' : 'MT5'}
        </button>
      ))}
    </div>
  );
}

/* ───────── Ejecutar en mi PC ───────── */

function RunOnPcBlock({ onSaved }: { onSaved: () => void }) {
  const { data: settings } = useSettings();
  const url = String((settings as any)?.backtest_server_url ?? '').replace(/\/+$/, '');
  const key = String((settings as any)?.backtest_server_key ?? '');
  const [scripts, setScripts] = useState<{ nombre: string; descripcion: string }[] | null>(null);
  const [script, setScript] = useState('');
  const [fuente, setFuente] = useState<'MT5' | 'YAHOO'>('MT5');
  const [err, setErr] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; estado: string; segundos: number; log: string } | null>(null);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (!url) return;
    fetch(`${url}/scripts`, { headers: backtestServerHeaders(key) })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((list) => { setScripts(list); setErr(null); if (list?.[0]) setScript(list[0].nombre); })
      .catch(() => setErr(SERVER_OFF));
  }, [url, key]);

  useEffect(() => {
    if (!job || job.estado !== 'en_curso') return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${url}/trabajo/${job.id}`, { headers: backtestServerHeaders(key) });
        const j = await r.json();
        if (j.estado === 'terminado') {
          clearInterval(iv);
          setJob({ id: job.id, estado: 'terminado', segundos: j.segundos ?? 0, log: j.log ?? '' });
          try { await saveSession(j.csv ?? '', script, fuente, j.log ?? ''); toast.success('Backtest terminado y guardado'); onSaved(); }
          catch (e: any) { toast.error(`No se pudo procesar el CSV: ${e.message}`); }
        } else if (j.estado === 'error') {
          clearInterval(iv);
          setJob({ id: job.id, estado: 'error', segundos: j.segundos ?? 0, log: j.log ?? '' });
        } else {
          setJob(prev => prev && { ...prev, segundos: j.segundos ?? prev.segundos, log: j.log ?? prev.log });
        }
      } catch { clearInterval(iv); setErr(SERVER_OFF); setJob(null); }
    }, 3000);
    return () => clearInterval(iv);
  }, [job?.id, job?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    try {
      const r = await fetch(`${url}/ejecutar`, {
        method: 'POST',
        headers: { ...backtestServerHeaders(key), 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, fuente }),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setJob({ id: j.trabajo, estado: 'en_curso', segundos: 0, log: '' });
      setErr(null);
    } catch { setErr(SERVER_OFF); }
  };

  const desc = scripts?.find(s => s.nombre === script)?.descripcion;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h2 className="font-display font-bold text-sm">EJECUTAR EN MI PC</h2>
      {!url ? (
        <p className="text-xs text-muted-foreground">Configura la URL y la clave del servidor en Ajustes › Servidor de backtest.</p>
      ) : err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>
      ) : !scripts ? <Loader2 className="w-4 h-4 animate-spin" /> : (
        <>
          <select value={script} onChange={e => setScript(e.target.value)} className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm">
            {scripts.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
          </select>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
          <FuenteSelect value={fuente} onChange={setFuente} />
          <div>
            <button onClick={run} disabled={!script || job?.estado === 'en_curso'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {job?.estado === 'en_curso' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {job?.estado === 'en_curso' ? `Ejecutando… ${job.segundos} s` : 'Ejecutar'}
            </button>
          </div>
        </>
      )}
      {job && job.estado === 'error' && (
        <pre className="max-h-60 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive whitespace-pre-wrap">{job.log || 'Error sin log'}</pre>
      )}
      {job && job.estado !== 'error' && (
        <div>
          <button onClick={() => setShowLog(v => !v)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <FileText className="w-3 h-3" /> {showLog ? 'Ocultar log' : 'Ver log'}
          </button>
          {showLog && <pre className="mt-1 max-h-60 overflow-auto rounded-md border border-border bg-secondary/40 p-2 text-[11px] whitespace-pre-wrap">{job.log}</pre>}
        </div>
      )}
    </section>
  );
}

/* ───────── Vista de sesión ───────── */

type SortK = keyof VariantStats;

function SessionView({ session, compact }: { session: Session; compact?: boolean }) {
  const variantes = session.metrics?.variantes ?? [];
  const [sortK, setSortK] = useState<SortK>('pf');
  const [desc, setDesc] = useState(true);
  const best = useMemo(() => [...variantes].filter(v => v.n >= 100).sort((a, b) => b.pf - a.pf)[0]?.variante
    ?? [...variantes].sort((a, b) => b.pf - a.pf)[0]?.variante, [variantes]);
  const [sel, setSel] = useState<string | null>(null);
  const selVar = sel ?? best ?? null;

  const sorted = useMemo(() => [...variantes].sort((a, b) => {
    const va = a[sortK] as any, vb = b[sortK] as any;
    const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return desc ? -c : c;
  }), [variantes, sortK, desc]);

  const th = (label: string, k: SortK) => (
    <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground" onClick={() => { if (sortK === k) setDesc(!desc); else { setSortK(k); setDesc(true); } }}>
      {label}{sortK === k ? (desc ? ' ↓' : ' ↑') : ''}
    </th>
  );

  const trades = (session.trades ?? []).filter(t => t.variante === selVar);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline gap-2 mb-3">
          <h2 className="font-display font-bold">{session.params?.nombre}</h2>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary">{session.params?.fuente}</span>
          <span className="text-xs text-muted-foreground">{new Date(session.created_at).toLocaleString('es-ES')} · {session.metrics?.abiertas ?? 0} abiertas (fuera de estadísticas)</span>
        </div>
        {session.params?.nota && !compact && <p className="text-xs text-muted-foreground mb-3 whitespace-pre-wrap line-clamp-4">{session.params.nota}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border">
              <tr>
                <th className="px-2 py-1.5 text-left cursor-pointer" onClick={() => setSortK('variante')}>Variante</th>
                {th('Ops', 'n')}{th('% acierto', 'winRate')}{th('R medio', 'rMedio')}{th('PF', 'pf')}{th('R total', 'rTotal')}
                {th('DD máx R', 'maxDdR')}{th('PF 1ª', 'pf1')}{th('PF 2ª', 'pf2')}{th('Años +', 'anosPos')}{th('Símb. +', 'simbPos')}
              </tr>
            </thead>
            <tbody>
              {sorted.map(v => (
                <tr key={v.variante} onClick={() => setSel(v.variante)}
                  className={`border-b border-border cursor-pointer hover:bg-accent ${v.variante === best ? 'bg-success/10' : ''} ${v.variante === selVar ? 'ring-1 ring-primary ring-inset' : ''}`}>
                  <td className="px-2 py-1.5 font-data">
                    {v.variante === best && '★ '}{v.variante}
                    {v.n < 100 && <span className="ml-1 text-[10px] text-orange-500">⚠ pocas operaciones</span>}
                    {v.pf2 < 1 && <span className="ml-1 text-[10px] text-destructive">⚠ PF 2ª mitad &lt; 1</span>}
                  </td>
                  <td className="px-2 text-right font-data">{v.n}</td>
                  <td className="px-2 text-right font-data">{v.winRate.toFixed(1)}%</td>
                  <td className="px-2 text-right font-data">{v.rMedio.toFixed(3)}</td>
                  <td className="px-2 text-right font-data font-bold">{fmtPf(v.pf)}</td>
                  <td className={`px-2 text-right font-data ${v.rTotal >= 0 ? 'text-success' : 'text-destructive'}`}>{v.rTotal.toFixed(1)}</td>
                  <td className="px-2 text-right font-data text-destructive">{v.maxDdR.toFixed(1)}</td>
                  <td className="px-2 text-right font-data">{fmtPf(v.pf1)}</td>
                  <td className={`px-2 text-right font-data ${v.pf2 < 1 ? 'text-destructive' : ''}`}>{fmtPf(v.pf2)}</td>
                  <td className="px-2 text-right font-data">{v.anosPos}</td>
                  <td className="px-2 text-right font-data">{v.simbPos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selVar && <VariantDetail trades={trades} name={selVar} compact={compact} />}
    </div>
  );
}

function VariantDetail({ trades, name, compact }: { trades: CsvTrade[]; name: string; compact?: boolean }) {
  const { pts, sorted } = useMemo(() => equity(trades), [trades]);
  const n = trades.length;
  const v = variantStats(trades)[0];
  const byYear = groupR(trades, t => isoDate(t.fecha_entrada).slice(0, 4));
  const bySym = groupR(trades, t => t.simbolo);
  const byFam = groupR(trades, t => t.familia ?? '');
  const bySig = groupR(trades, t => t.senal ?? '');
  const byDir = groupR(trades, t => t.direccion);
  const byMot = groupR(trades, t => t.motivo);
  const dist = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of trades) { const b = Math.floor(t.R * 2) / 2; m.set(b, (m.get(b) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, c]) => ({ k: k.toFixed(1), c }));
  }, [trades]);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h3 className="font-display font-bold text-sm">{name}</h3>
      {n < 100 && <Warn>Pocas operaciones ({n}): resultado poco fiable</Warn>}
      {v && v.pf2 < 1 && <Warn>El Profit Factor de la 2ª mitad es menor que 1 ({fmtPf(v.pf2)})</Warn>}
      <div className={`grid gap-4 ${compact ? '' : 'lg:grid-cols-2'}`}>
        <Chart title="R acumulado">
          <LineChart data={pts}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="fecha" hide /><YAxis width={40} fontSize={10} /><Tooltip /><Line dataKey="r" dot={false} stroke="hsl(var(--primary))" strokeWidth={2} /></LineChart>
        </Chart>
        <Chart title="Drawdown en R">
          <AreaChart data={pts}><XAxis dataKey="fecha" hide /><YAxis width={40} fontSize={10} /><Tooltip /><Area dataKey="dd" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.25)" /></AreaChart>
        </Chart>
        <Chart title="Distribución de R">
          <BarChart data={dist}><XAxis dataKey="k" fontSize={10} /><YAxis width={30} fontSize={10} /><Tooltip /><Bar dataKey="c">{dist.map(d => <Cell key={d.k} fill={Number(d.k) >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />)}</Bar></BarChart>
        </Chart>
        <Chart title="Resultado por año (R)">
          <BarChart data={byYear}><XAxis dataKey="k" fontSize={10} /><YAxis width={40} fontSize={10} /><Tooltip /><Bar dataKey="rTotal">{byYear.map(d => <Cell key={d.k} fill={d.rTotal >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />)}</Bar></BarChart>
        </Chart>
      </div>
      <div className={`grid gap-4 ${compact ? '' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        <GroupTable title="Por símbolo" rows={bySym} />
        {byFam.length > 1 && <GroupTable title="Por familia" rows={byFam} />}
        {bySig.length > 1 && <GroupTable title="Por señal" rows={bySig} />}
        <GroupTable title="Largos vs cortos" rows={byDir} />
        <GroupTable title="Por motivo de salida" rows={byMot} />
      </div>
      {!compact && (
        <details>
          <summary className="cursor-pointer text-xs text-primary">Lista de operaciones ({n})</summary>
          <div className="max-h-96 overflow-auto mt-2">
            <table className="w-full text-xs font-data">
              <thead className="text-muted-foreground"><tr><th className="text-left px-2">Símbolo</th><th className="text-left">Dir</th><th className="text-left">Entrada</th><th className="text-left">Salida</th><th className="text-right">Precio E</th><th className="text-right">Precio S</th><th className="text-right">R</th><th className="text-left px-2">Motivo</th></tr></thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2">{t.simbolo}{t.contrato !== t.simbolo && <span className="text-muted-foreground"> {t.contrato}</span>}</td>
                    <td>{t.direccion}</td><td>{t.fecha_entrada}</td><td>{t.fecha_salida}</td>
                    <td className="text-right">{t.entrada}</td><td className="text-right">{t.salida}</td>
                    <td className={`text-right font-bold ${t.R >= 0 ? 'text-success' : 'text-destructive'}`}>{t.R.toFixed(2)}</td>
                    <td className="px-2">{t.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400"><AlertTriangle className="w-4 h-4" />{children}</div>;
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="h-48"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: ReturnType<typeof groupR> }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="max-h-56 overflow-auto rounded border border-border">
        <table className="w-full text-xs font-data">
          <thead className="text-muted-foreground"><tr><th className="text-left px-2">—</th><th className="text-right">Ops</th><th className="text-right">%</th><th className="text-right">PF</th><th className="text-right px-2">R</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.k} className="border-t border-border">
                <td className="px-2">{r.k}</td><td className="text-right">{r.n}</td><td className="text-right">{r.winRate.toFixed(0)}</td>
                <td className="text-right">{fmtPf(r.pf)}</td>
                <td className={`text-right px-2 ${r.rTotal >= 0 ? 'text-success' : 'text-destructive'}`}>{r.rTotal.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
