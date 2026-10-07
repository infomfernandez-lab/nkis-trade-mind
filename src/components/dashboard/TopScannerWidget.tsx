import { Link } from '@tanstack/react-router';
import { Radar, ArrowRight } from 'lucide-react';
import { useEscanerFoto, signed, type EscanerFila } from '@/hooks/use-escaner';

export function TopScannerWidget(_: { brokerFilter?: 'all' | 'darwinex' | 'octx' }) {
  const { data: foto, isLoading } = useEscanerFoto();
  const filas = foto?.datos?.filas ?? [];
  const up = filas.filter(f => f.lado === 1).sort((a, b) => Math.abs(b.fuerza ?? 0) - Math.abs(a.fuerza ?? 0)).slice(0, 5);
  const dn = filas.filter(f => f.lado === -1).sort((a, b) => Math.abs(b.fuerza ?? 0) - Math.abs(a.fuerza ?? 0)).slice(0, 5);

  const row = (f: EscanerFila, i: number, isUp: boolean) => {
    const senal = f.cruce?.estado === 'hoy';
    return (
      <li key={f.raiz} className={`flex items-center gap-2 px-2 py-1.5 text-xs ${senal ? 'bg-warning/10' : ''}`}>
        <span className="font-data text-muted-foreground w-4">{i + 1}</span>
        <span className="font-semibold truncate flex-1">{f.nombre ?? f.raiz}</span>
        {senal && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning/20 text-warning border border-warning/40">SEÑAL</span>}
        <span className={`font-data font-bold w-10 text-right ${isUp ? 'text-success' : 'text-destructive'}`}>{signed(f.fuerza)}</span>
      </li>
    );
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Radar className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm">TOP ESCÁNER</h2>
        <Link to="/radar" className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
          Ver completo <ArrowRight className="w-3 h-3" />
        </Link>
      </header>
      <div className="p-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-4">Cargando…</div>
        ) : filas.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-4">Sin datos del escáner todavía.</div>
        ) : (
          <div className="space-y-2">
            <div>
              <div className="text-[10px] font-bold text-success px-2">▲ MÁS ALCISTAS</div>
              <ul className="divide-y divide-border">{up.map((f, i) => row(f, i, true))}</ul>
            </div>
            <div>
              <div className="text-[10px] font-bold text-destructive px-2">▼ MÁS BAJISTAS</div>
              <ul className="divide-y divide-border">{dn.map((f, i) => row(f, i, false))}</ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
