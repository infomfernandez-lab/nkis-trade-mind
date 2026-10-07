import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { useEscanerFoto, nf, signed, type EscanerFila } from '@/hooks/use-escaner';

const byFuerza = (a: EscanerFila, b: EscanerFila) => Math.abs(b.fuerza ?? 0) - Math.abs(a.fuerza ?? 0);
const potCls = (p?: string | null) =>
  p === 'Alto' ? 'bg-success/15 text-success border-success/40'
  : p === 'Medio' ? 'bg-warning/15 text-warning border-warning/40'
  : 'bg-secondary text-muted-foreground border-border';
const ladoTxt = (l?: number) => (l === 1 ? 'Alcista' : l === -1 ? 'Bajista' : 'Lateral');
const entraFavor = (f: EscanerFila) => f.liquidez === 'Entra dinero';

function PotBadge({ p }: { p?: string | null }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${potCls(p)}`}>{p}</span>;
}

function Card({ f, i, onOpen }: { f: EscanerFila; i: number; onOpen: () => void }) {
  const up = f.lado === 1;
  const senal = f.cruce?.estado === 'hoy';
  return (
    <button onClick={onOpen} className={`w-full text-left rounded-md border p-2.5 transition-colors hover:border-primary/50 ${senal ? 'border-warning/60 bg-warning/10' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2">
        <span className="font-data text-xs text-muted-foreground w-5">{i + 1}</span>
        <span className="font-semibold text-sm truncate">{f.nombre ?? f.raiz}</span>
        <span className="text-[10px] text-muted-foreground font-data">{f.simbolo}</span>
        <span className={`ml-auto font-data font-bold ${up ? 'text-success' : 'text-destructive'}`}>{signed(f.fuerza)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1.5 pl-7 text-[11px]">
        <PotBadge p={f.potencial} />
        {f.liquidez && <span className="text-muted-foreground">{f.liquidez}</span>}
        {f.dias_venc != null && f.dias_venc <= 20 && <span className="text-destructive font-semibold">vence en {f.dias_venc} d</span>}
      </div>
      {f.cruce?.texto && (
        senal
          ? <div className="mt-2 ml-7 px-2 py-1 rounded bg-warning/20 text-warning border border-warning/40 text-xs font-bold">{f.cruce.texto}</div>
          : <div className="mt-1 pl-7 text-[11px] text-muted-foreground">{f.cruce.texto}</div>
      )}
    </button>
  );
}

function Column({ titulo, filas, up, onOpen }: { titulo: string; filas: EscanerFila[]; up: boolean; onOpen: (f: EscanerFila) => void }) {
  const senales = filas.filter(f => f.cruce?.estado === 'hoy').length;
  return (
    <section className="rounded-lg border border-border bg-card/50 p-3">
      <h2 className={`font-display font-bold ${up ? 'text-success' : 'text-destructive'}`}>
        {titulo} <span className="text-xs text-muted-foreground font-normal">· {filas.length} mercados · {senales} con señal hoy</span>
      </h2>
      <p className="text-[11px] text-muted-foreground mb-2">Solo {up ? 'compras' : 'ventas'}. Ordenados por fuerza. Entra si hay SEÑAL.</p>
      <div className="space-y-1.5">
        {filas.length === 0 ? <p className="text-xs italic text-muted-foreground py-4 text-center">Ninguno.</p>
          : filas.map((f, i) => <Card key={f.raiz} f={f} i={i} onOpen={() => onOpen(f)} />)}
      </div>
    </section>
  );
}

function Spark({ data }: { data?: (number | null)[] }) {
  const v = (data ?? []).slice(-60).map(x => (x == null ? null : Number(x)));
  const nums = v.filter((x): x is number => x != null);
  if (nums.length < 2) return <span className="text-muted-foreground">—</span>;
  const min = Math.min(...nums, 0), max = Math.max(...nums, 0), r = max - min || 1;
  const pts = v.map((x, i) => (x == null ? null : `${(i / (v.length - 1)) * 80},${20 - ((x - min) / r) * 20}`)).filter(Boolean).join(' ');
  const zero = 20 - ((0 - min) / r) * 20;
  const last = nums[nums.length - 1];
  return (
    <svg width={80} height={20} className="overflow-visible">
      <line x1={0} x2={80} y1={zero} y2={zero} className="stroke-border" strokeWidth={0.5} />
      <polyline points={pts} fill="none" strokeWidth={1.2} className={last >= 0 ? 'stroke-success' : 'stroke-destructive'} />
    </svg>
  );
}

function FuerzaBar({ v }: { v?: number }) {
  const n = Math.max(-100, Math.min(100, v ?? 0));
  return (
    <div className="relative w-20 h-2 bg-secondary rounded">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground/50" />
      <div className={`absolute top-0 bottom-0 rounded ${n >= 0 ? 'bg-success' : 'bg-destructive'}`}
        style={n >= 0 ? { left: '50%', width: `${n / 2}%` } : { right: '50%', width: `${-n / 2}%` }} />
    </div>
  );
}

type Filtro = 'todos' | 'alc' | 'baj' | 'entra' | 'senal';
type SortKey = 'nombre' | 'fuerza' | 'puntos' | 'presion' | 'dist' | 'semanal' | 'cambio5' | 'edad' | 'sc' | 'venc';
const sortVal = (f: EscanerFila, k: SortKey): number | string => {
  switch (k) {
    case 'nombre': return (f.nombre ?? f.raiz).toLowerCase();
    case 'fuerza': return f.fuerza ?? -999;
    case 'puntos': return f.puntos ?? -1;
    case 'presion': return f.presion ?? -999;
    case 'dist': return f.dist ?? -999;
    case 'semanal': return f.semanal ?? 0;
    case 'cambio5': return f.cambio5 ?? -999;
    case 'edad': return f.edad ?? -1;
    case 'sc': { const s = f.hist?.sc ?? []; return Number(s[s.length - 1] ?? -999); }
    case 'venc': return f.dias_venc ?? 99999;
  }
};

function Tabla({ filas, onOpen }: { filas: EscanerFila[]; onOpen: (f: EscanerFila) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'fuerza', dir: -1 });
  const rows = useMemo(() => {
    const r = filas.filter(f =>
      filtro === 'alc' ? f.lado === 1 : filtro === 'baj' ? f.lado === -1
      : filtro === 'entra' ? entraFavor(f) : filtro === 'senal' ? f.cruce?.estado === 'hoy' : true);
    return [...r].sort((a, b) => {
      const x = sortVal(a, sort.k), y = sortVal(b, sort.k);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [filas, filtro, sort]);
  const th = (k: SortKey, label: string) => (
    <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort(s => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label}{sort.k === k ? (sort.dir === -1 ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
  const chips: [Filtro, string][] = [['todos', 'Todos'], ['alc', 'Alcistas'], ['baj', 'Bajistas'], ['entra', 'Entra dinero a favor'], ['senal', 'Con señal hoy']];
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap gap-1.5 p-2 border-b border-border">
        {chips.map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`px-2.5 h-7 rounded-md text-xs font-medium border ${filtro === k ? 'bg-primary/15 text-primary border-primary/40' : 'border-border hover:border-primary/40'}`}>{l}</button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">{rows.length} mercados</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr>{th('nombre', 'Activo')}{th('fuerza', 'Dirección y fuerza')}{th('puntos', 'Potencial')}{th('presion', 'Liquidez')}{th('dist', 'Distancia y señal')}{th('semanal', 'Semanal')}{th('cambio5', 'Fuerza 5 días')}{th('edad', 'Edad')}{th('sc', 'Fuerza 60 días')}{th('venc', 'Vence')}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(f => {
              const senal = f.cruce?.estado === 'hoy';
              return (
                <tr key={f.raiz} onClick={() => onOpen(f)} className={`cursor-pointer hover:bg-secondary/40 ${senal ? 'bg-warning/5' : ''}`}>
                  <td className="px-2 py-1.5"><div className="font-semibold">{f.nombre ?? f.raiz}</div><div className="text-[10px] text-muted-foreground"><span className="font-data">{f.simbolo}</span>{f.familia ? ` · ${f.familia}` : ''}</div></td>
                  <td className="px-2 py-1.5"><div className="flex items-center gap-2"><FuerzaBar v={f.fuerza} /><span className={`font-data font-bold ${f.lado === 1 ? 'text-success' : f.lado === -1 ? 'text-destructive' : ''}`}>{signed(f.fuerza)}</span></div><div className="text-[10px] text-muted-foreground">{ladoTxt(f.lado)}{f.cat && f.cat !== 'Lateral' ? ` · ${f.cat}` : ''}</div></td>
                  <td className="px-2 py-1.5"><PotBadge p={f.potencial} /><div className="text-[10px] text-muted-foreground mt-0.5">{f.puntos ?? 0} de 5 a favor</div></td>
                  <td className="px-2 py-1.5"><div>{f.liquidez ?? '—'}</div><div className="text-[10px] text-muted-foreground">presión {signed(f.presion)}</div></td>
                  <td className="px-2 py-1.5"><div className="font-data">{nf(f.dist, 1)} ATR</div><div className={`text-[10px] ${senal ? 'text-warning font-bold' : 'text-muted-foreground'}`}>{f.cruce?.texto ?? ''}</div></td>
                  <td className={`px-2 py-1.5 text-center ${f.semanal === 1 ? 'text-success' : f.semanal === -1 ? 'text-destructive' : 'text-muted-foreground'}`}>{f.semanal === 1 ? '▲' : f.semanal === -1 ? '▼' : '–'}</td>
                  <td className="px-2 py-1.5 font-data">{signed(f.cambio5, 0)}</td>
                  <td className="px-2 py-1.5 font-data">{f.edad ?? '—'}</td>
                  <td className="px-2 py-1.5"><Spark data={f.hist?.sc} /></td>
                  <td className={`px-2 py-1.5 font-data ${f.dias_venc != null && f.dias_venc <= 20 ? 'text-destructive font-bold' : ''}`}>{f.dias_venc ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PriceChart({ h }: { h: NonNullable<EscanerFila['hist']> }) {
  const c = (h.c ?? []).map(Number);
  if (c.length < 2) return <p className="text-xs text-muted-foreground">Sin histórico.</p>;
  const W = 640, H = 220, VH = 60;
  const series = [c, (h.e50 ?? []).map(x => (x == null ? NaN : Number(x))), (h.s200 ?? []).map(x => (x == null ? NaN : Number(x)))];
  const all = series.flat().filter(Number.isFinite);
  const min = Math.min(...all), max = Math.max(...all), r = max - min || 1;
  const x = (i: number) => (i / (c.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / r) * H;
  const path = (s: number[]) => s.map((v, i) => (Number.isFinite(v) ? `${x(i)},${y(v)}` : null)).filter(Boolean).join(' ');
  const vol = (h.v ?? []).map(v => (v == null ? 0 : Number(v)));
  const hasVol = vol.some(v => v > 0);
  const vmax = Math.max(...vol, 1);
  const bw = W / c.length;
  return (
    <div>
      <div className="flex gap-3 text-[10px] text-muted-foreground mb-1">
        <span><span className="inline-block w-3 h-0.5 bg-foreground align-middle mr-1" />Precio</span>
        <span><span className="inline-block w-3 h-0.5 bg-primary align-middle mr-1" />EMA 64</span>
        <span><span className="inline-block w-3 h-0.5 bg-warning align-middle mr-1" />SMA 200</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="none">
        <polyline points={path(series[2])} fill="none" className="stroke-warning" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <polyline points={path(series[1])} fill="none" className="stroke-primary" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        <polyline points={path(c)} fill="none" className="stroke-foreground" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {hasVol && (
        <svg viewBox={`0 0 ${W} ${VH}`} className="w-full h-14 mt-1" preserveAspectRatio="none">
          {vol.map((v, i) => {
            const bh = (v / vmax) * VH;
            const upDay = i > 0 && c[i] >= c[i - 1];
            return <rect key={i} x={i * bw} y={VH - bh} width={Math.max(bw - 0.5, 0.5)} height={bh} className={upDay ? 'fill-success/70' : 'fill-destructive/70'} />;
          })}
        </svg>
      )}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-data">
        <span>{h.t?.[0]}</span><span>{h.t?.[h.t.length - 1]}</span>
      </div>
    </div>
  );
}

function Detalle({ f, onClose }: { f: EscanerFila; onClose: () => void }) {
  const dato = (l: string, v: React.ReactNode) => <div className="flex justify-between gap-2 py-1 border-b border-border/50"><span className="text-muted-foreground">{l}</span><span className="font-data text-right">{v}</span></div>;
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-lg border border-border bg-card p-4 mt-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <div>
            <h3 className="font-display text-lg font-bold">{f.nombre ?? f.raiz} <span className="text-xs font-data text-muted-foreground">{f.simbolo}</span></h3>
            <p className="text-xs text-muted-foreground">{[f.familia, f.tema].filter(Boolean).join(' · ')} · <span className={f.lado === 1 ? 'text-success' : f.lado === -1 ? 'text-destructive' : ''}>{ladoTxt(f.lado)} {signed(f.fuerza)}</span>{f.cat ? ` · ${f.cat}` : ''}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-secondary" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        {f.hist && <PriceChart h={f.hist} />}
        <div className="grid md:grid-cols-2 gap-4 mt-4 text-xs">
          <div>
            <h4 className="font-semibold mb-1">Por qué</h4>
            <ul className="space-y-1">
              {(f.razones ?? []).map(([s, t], i) => (
                <li key={i} className="flex gap-1.5"><span className={s === '+' ? 'text-success' : 'text-destructive'}>{s === '+' ? '▲' : '▼'}</span><span>{t}</span></li>
              ))}
              {!f.razones?.length && <li className="text-muted-foreground">—</li>}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Datos</h4>
            {dato('Precio', nf(f.precio, 2))}
            {dato('Distancia a la media', `${nf(f.dist, 2)} ATR`)}
            {dato('Señal', f.cruce?.texto ?? '—')}
            {dato('Edad', f.edad != null ? `${f.edad} sesiones` : '—')}
            {dato('Presión de volumen', signed(f.presion))}
            {dato('Vencimiento', f.vencimiento ? `${f.vencimiento}${f.dias_venc != null ? ` (${f.dias_venc} d)` : ''}` : '—')}
          </div>
        </div>
      </div>
    </div>
  );
}

function Explicacion() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-border bg-card">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold">
        Qué es cada dato y cómo se calcula {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-2 text-xs text-muted-foreground list-disc pl-8">
          <li><b className="text-foreground">Dirección y fuerza (−100 a +100):</b> 50 % momentum a 1, 3, 6 y 12 meses ajustado por volatilidad; 30 % posición en el canal de 50 y 100 sesiones; 20 % medias 50/200 (separación y pendiente). Alcista desde +30, bajista desde −30; fuerte desde ±60.</li>
          <li><b className="text-foreground">Señal:</b> la última vela cerrada cruza −2, 0 o +2 de la distancia (cierre − EMA64) / ATR14 a favor de la tendencia.</li>
          <li><b className="text-foreground">Potencial:</b> un punto por cada cosa a favor (semanal a favor, acelerando, no estirada a ≤ 3 ATR, joven ≤ 60 sesiones, el dinero entra a favor). Alto 4-5, Medio 3, Bajo 0-2.</li>
          <li><b className="text-foreground">Liquidez:</b> presión de volumen de 20 sesiones = (volumen de días al alza − volumen de días a la baja) / total × 100. "Entra dinero" ≥ +20 a favor; "Sale dinero" ≥ 20 en contra.</li>
        </ul>
      )}
    </section>
  );
}

export function EscanerView() {
  const { data: foto, isLoading, error } = useEscanerFoto();
  const [sel, setSel] = useState<EscanerFila | null>(null);
  const filas = foto?.datos?.filas ?? [];
  const up = useMemo(() => filas.filter(f => f.lado === 1).sort(byFuerza), [filas]);
  const dn = useMemo(() => filas.filter(f => f.lado === -1).sort(byFuerza), [filas]);
  const avisos = foto?.datos?.avisos ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>;
  if (error || !foto) return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      Todavía no ha llegado ninguna foto del escáner. Envíala desde CAP_ESCANER a <span className="font-data text-foreground">/api/sync-escaner</span>.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Column titulo="▲ Los más alcistas hoy" filas={up} up onOpen={setSel} />
        <Column titulo="▼ Los más bajistas hoy" filas={dn} up={false} onOpen={setSel} />
      </div>
      {avisos.length > 0 && (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-warning mb-1"><AlertTriangle className="w-4 h-4" /> Avisos</h3>
          <ul className="space-y-0.5 text-xs">
            {avisos.map((a, i) => <li key={i}>{a.tipo && <span className="font-semibold uppercase text-[10px] text-muted-foreground mr-1.5">{a.tipo}</span>}{a.texto}</li>)}
          </ul>
        </section>
      )}
      <Explicacion />
      <Tabla filas={filas} onOpen={setSel} />
      {sel && <Detalle f={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
