// Filtro de tipo "Activos" reutilizable. Mismo estilo y mismos parámetros
// que el filtro de la página /activos, pensado para reutilizarse en
// el escáner para que la experiencia sea idéntica.
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export type DirFilter = 'all' | 'ALCISTA' | 'BAJISTA';
export type TradeStateFilter = 'all' | 'open' | 'recent_closed' | 'winners' | 'losers';
export type VolFilter = 'all' | 'high' | 'normal';
export type ScannerSortKey =
  | 'score_desc' | 'score_asc'
  | 'adx_desc' | 'vol_desc'
  | 'pnl_desc' | 'pnl_asc'
  | 'recent_close';

export interface ScannerFilterState {
  mercado: string;
  sector: string;
  dir: DirFilter;
  trade: TradeStateFilter;
  vol: VolFilter;
  strongTrend: boolean;
  sort: ScannerSortKey;
  search: string;
}

export const EMPTY_SCANNER_FILTERS: ScannerFilterState = {
  mercado: 'all',
  sector: 'all',
  dir: 'all',
  trade: 'all',
  vol: 'all',
  strongTrend: false,
  sort: 'score_desc',
  search: '',
};

interface Props {
  state: ScannerFilterState;
  onChange: (s: ScannerFilterState) => void;
  mercados: string[];
  sectores: string[];
  /** mostrar contador opcional debajo (p.ej. "12 de 50"). */
  countLabel?: string;
  /** Slot opcional que se renderiza justo debajo de la fila del buscador
   *  (p.ej. selector de vista Escaneado / Vigilancia EA / Posiciones). */
  viewSwitcher?: React.ReactNode;
}

export function AssetsStyleFiltersBar({ state, onChange, mercados, sectores, countLabel }: Props) {
  const set = (patch: Partial<ScannerFilterState>) => onChange({ ...state, ...patch });

  return (
    <div className="space-y-2 p-3 rounded-md border border-border bg-card">
      {/* Fila 1: mercado / sector / orden / búsqueda */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={state.mercado}
          onChange={e => set({ mercado: e.target.value, sector: 'all' })}
          className="h-8 px-2 rounded-md border border-border bg-background text-xs"
        >
          <option value="all">Todos los mercados</option>
          {mercados.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={state.sector}
          onChange={e => set({ sector: e.target.value })}
          className="h-8 px-2 rounded-md border border-border bg-background text-xs"
        >
          <option value="all">Todos los sectores</option>
          {sectores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Sep />
        <select
          value={state.sort}
          onChange={e => set({ sort: e.target.value as ScannerSortKey })}
          className="h-8 px-2 rounded-md border border-border bg-background text-xs"
          title="Ordenar"
        >
          <option value="score_desc">Score ↓</option>
          <option value="score_asc">Score ↑</option>
          <option value="adx_desc">Fuerza tendencia (ADX) ↓</option>
          <option value="vol_desc">Volatilidad ↓</option>
          <option value="pnl_desc">P&L acumulado ↓</option>
          <option value="pnl_asc">P&L acumulado ↑</option>
          <option value="recent_close">Cierre más reciente</option>
        </select>
        <div className="flex-1" />
        {countLabel && <span className="text-[10px] text-muted-foreground">{countLabel}</span>}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={state.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Buscar símbolo…"
            className="h-8 pl-7 w-48 text-xs"
          />
        </div>
      </div>

      {/* Fila 2: dirección / fuerza / volatilidad */}
      <div className="flex flex-wrap items-center gap-2">
        <Toggle label="Dir: Todas" active={state.dir === 'all'} onClick={() => set({ dir: 'all' })} />
        <Toggle label="▲ ALCISTA" active={state.dir === 'ALCISTA'} onClick={() => set({ dir: 'ALCISTA' })} />
        <Toggle label="▼ BAJISTA" active={state.dir === 'BAJISTA'} onClick={() => set({ dir: 'BAJISTA' })} />
        <Sep />
        <Toggle label="Tendencia fuerte (ADX≥25)" active={state.strongTrend} onClick={() => set({ strongTrend: !state.strongTrend })} />
        <Sep />
        <Toggle label="Vol: Todas" active={state.vol === 'all'} onClick={() => set({ vol: 'all' })} />
        <Toggle label="Alta vol." active={state.vol === 'high'} onClick={() => set({ vol: 'high' })} />
        <Toggle label="Vol. normal" active={state.vol === 'normal'} onClick={() => set({ vol: 'normal' })} />
      </div>

      {/* Fila 3: estado de trades */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Trades</span>
        <Toggle label="Todos" active={state.trade === 'all'} onClick={() => set({ trade: 'all' })} />
        <Toggle label="Con posición abierta" active={state.trade === 'open'} onClick={() => set({ trade: 'open' })} />
        <Toggle label="Cerrados recientes (7d)" active={state.trade === 'recent_closed'} onClick={() => set({ trade: 'recent_closed' })} />
        <Toggle label="Ganadores acumulado" active={state.trade === 'winners'} onClick={() => set({ trade: 'winners' })} />
        <Toggle label="Perdedores acumulado" active={state.trade === 'losers'} onClick={() => set({ trade: 'losers' })} />
      </div>
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
        active
          ? 'bg-primary/15 text-primary border-primary/40'
          : 'bg-secondary border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

/* ─────────────── Helpers de filtrado/orden compartidos ─────────────── */

import type { Trade } from '@/lib/trade-utils';

export interface TradeAgg {
  openCount: number;
  closedPnl: number;
  lastExit: number | null;
  recentClosedCount: number;
}

export function aggregateTradesByKey(trades: Trade[]): Map<string, TradeAgg> {
  const map = new Map<string, TradeAgg>();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const t of trades) {
    const key = `${t.symbol}|${t.broker}`;
    const cur = map.get(key) ?? { openCount: 0, closedPnl: 0, lastExit: null, recentClosedCount: 0 };
    if (t.status === 'open') {
      cur.openCount += 1;
    } else {
      cur.closedPnl += t.netPnl;
      const ts = t.exitDate ? new Date(t.exitDate).getTime() : null;
      if (ts) {
        if (!cur.lastExit || ts > cur.lastExit) cur.lastExit = ts;
        if (ts >= weekAgo) cur.recentClosedCount += 1;
      }
    }
    map.set(key, cur);
  }
  return map;
}

export const VOL_RANK: Record<string, number> = { ANORMAL: 4, ELEVADA: 3, COHERENTE: 2, BAJA: 1 };
