import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { resolveSector } from '@/lib/asset-enrich';
import { useAllTrades } from '@/hooks/use-trades';
import type { Trade } from '@/lib/trade-utils';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Asset = {
  symbol: string;
  broker: string;
  description: string | null;
  familia: string | null;
  sector: string | null;
  last_score: number | null;
  last_direction: string | null;
  last_atr_state: string | null;
  last_adx: number | null;
  last_stoch: number | null;
  last_price: number | null;
  is_active_scanner: boolean | null;
  last_seen_scanner: string | null;
};

type DirFilter = 'all' | 'ALCISTA' | 'BAJISTA';
type ActiveFilter = 'active' | 'all';
type TradeStateFilter = 'all' | 'open' | 'recent_closed' | 'winners' | 'losers';
type VolFilter = 'all' | 'high' | 'normal';
type SortKey =
  | 'score_desc' | 'score_asc'
  | 'adx_desc' | 'vol_desc'
  | 'trend_new' | 'trend_old'
  | 'pnl_desc' | 'pnl_asc'
  | 'recent_close';

const VOL_RANK: Record<string, number> = { ANORMAL: 4, ELEVADA: 3, COHERENTE: 2, BAJA: 1 };

// Map asset broker (nkis/octx) ↔ trade broker (darwinex/octx)
function assetBrokerToTrade(b: string): string {
  const x = (b ?? '').toLowerCase();
  if (x === 'nkis' || x === 'darwinex') return 'darwinex';
  return x;
}

interface TradeAgg {
  openCount: number;
  closedPnl: number;
  lastExit: number | null; // timestamp ms
  recentClosedCount: number; // last 7 days
  winRate: number | null;
}

function aggregateTradesBySymbol(trades: Trade[]): Map<string, TradeAgg> {
  const map = new Map<string, TradeAgg>();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const t of trades) {
    const key = `${t.symbol}|${t.broker}`;
    const cur = map.get(key) ?? { openCount: 0, closedPnl: 0, lastExit: null, recentClosedCount: 0, winRate: null };
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
  // win rate
  const winLoss = new Map<string, { w: number; l: number }>();
  for (const t of trades) {
    if (t.status !== 'closed') continue;
    const key = `${t.symbol}|${t.broker}`;
    const wl = winLoss.get(key) ?? { w: 0, l: 0 };
    if (t.netPnl > 0) wl.w++; else if (t.netPnl < 0) wl.l++;
    winLoss.set(key, wl);
  }
  for (const [k, v] of winLoss) {
    const total = v.w + v.l;
    const agg = map.get(k);
    if (agg && total > 0) agg.winRate = v.w / total;
  }
  return map;
}

export default function AssetsPage() {
  const { broker: globalBroker } = useBrokerFilter();
  const [familiaF, setFamiliaF] = useState<string>('all');
  const [sectorF, setSectorF] = useState<string>('all');
  const [dirF, setDirF] = useState<DirFilter>('all');
  const [activeF, setActiveF] = useState<ActiveFilter>('all');
  const [tradeF, setTradeF] = useState<TradeStateFilter>('all');
  const [volF, setVolF] = useState<VolFilter>('all');
  const [strongTrend, setStrongTrend] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('score_desc');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const brokerDb = globalBroker === 'darwinex' ? 'nkis' : globalBroker === 'octx' ? 'octx' : 'all';

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets-all', brokerDb],
    queryFn: async () => {
      const qs = new URLSearchParams({ select: '*' });
      if (brokerDb !== 'all') qs.set('broker', brokerDb);
      const res = await fetch(`/api/assets-proxy?${qs.toString()}`);
      if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
      const raw = (await res.json()) as Asset[];
      return raw.map(a => ({ ...a, sector: resolveSector(a) }));
    },
  });

  const { closedTrades, openTrades } = useAllTrades();
  const tradeAgg = useMemo(
    () => aggregateTradesBySymbol([...closedTrades, ...openTrades]),
    [closedTrades, openTrades],
  );
  const aggFor = (a: Asset): TradeAgg | undefined =>
    tradeAgg.get(`${a.symbol}|${assetBrokerToTrade(a.broker)}`);

  const familias = useMemo(() => {
    const s = new Set<string>();
    assets.forEach(a => { if (a.familia) s.add(a.familia); });
    return Array.from(s).sort();
  }, [assets]);

  const sectores = useMemo(() => {
    const s = new Set<string>();
    assets.forEach(a => {
      if (familiaF !== 'all' && a.familia !== familiaF) return;
      if (a.sector) s.add(a.sector);
    });
    return Array.from(s).sort();
  }, [assets, familiaF]);

  useEffect(() => {
    if (sectorF !== 'all' && !sectores.includes(sectorF)) setSectorF('all');
  }, [sectores, sectorF]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    const out = assets.filter(a => {
      if (brokerDb !== 'all' && (a.broker ?? '').toLowerCase() !== brokerDb) return false;
      if (familiaF !== 'all' && a.familia !== familiaF) return false;
      if (sectorF !== 'all' && a.sector !== sectorF) return false;
      if (dirF !== 'all' && (a.last_direction ?? '').toUpperCase() !== dirF) return false;
      if (activeF === 'active' && !a.is_active_scanner) return false;
      if (q && !a.symbol.toUpperCase().includes(q)) return false;

      if (strongTrend && !(Number(a.last_adx ?? 0) >= 25)) return false;

      if (volF !== 'all') {
        const v = (a.last_atr_state ?? '').toUpperCase();
        if (volF === 'high' && !(v === 'ELEVADA' || v === 'ANORMAL')) return false;
        if (volF === 'normal' && !(v === 'BAJA' || v === 'COHERENTE')) return false;
      }

      if (tradeF !== 'all') {
        const agg = aggFor(a);
        if (!agg) return false;
        if (tradeF === 'open' && agg.openCount === 0) return false;
        if (tradeF === 'recent_closed' && agg.recentClosedCount === 0) return false;
        if (tradeF === 'winners' && !(agg.closedPnl > 0)) return false;
        if (tradeF === 'losers' && !(agg.closedPnl < 0)) return false;
      }

      return true;
    });

    const cmp = (a: Asset, b: Asset): number => {
      const aAgg = aggFor(a);
      const bAgg = aggFor(b);
      const num = (x: number | null | undefined) => (x == null ? -Infinity : Number(x));
      switch (sortKey) {
        case 'score_desc': return num(b.last_score) - num(a.last_score);
        case 'score_asc':  return num(a.last_score) - num(b.last_score);
        case 'adx_desc':   return num(b.last_adx) - num(a.last_adx);
        case 'vol_desc': {
          const av = VOL_RANK[(a.last_atr_state ?? '').toUpperCase()] ?? 0;
          const bv = VOL_RANK[(b.last_atr_state ?? '').toUpperCase()] ?? 0;
          return bv - av;
        }
        case 'trend_new': {
          const at = a.last_seen_scanner ? new Date(a.last_seen_scanner).getTime() : 0;
          const bt = b.last_seen_scanner ? new Date(b.last_seen_scanner).getTime() : 0;
          return bt - at;
        }
        case 'trend_old': {
          const at = a.last_seen_scanner ? new Date(a.last_seen_scanner).getTime() : Infinity;
          const bt = b.last_seen_scanner ? new Date(b.last_seen_scanner).getTime() : Infinity;
          return at - bt;
        }
        case 'pnl_desc':   return (bAgg?.closedPnl ?? -Infinity) - (aAgg?.closedPnl ?? -Infinity);
        case 'pnl_asc':    return (aAgg?.closedPnl ?? Infinity) - (bAgg?.closedPnl ?? Infinity);
        case 'recent_close': return (bAgg?.lastExit ?? 0) - (aAgg?.lastExit ?? 0);
      }
    };
    out.sort(cmp);
    return out;
  }, [assets, brokerDb, familiaF, sectorF, dirF, activeF, tradeF, volF, strongTrend, search, sortKey, tradeAgg]);

  const activeCount = assets.filter(a => a.is_active_scanner).length;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Activos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} de {assets.length} instrumentos · {activeCount} activos en el escáner
          </p>
        </div>
      </div>

      <div className="space-y-2 p-3 rounded-md border border-border bg-card">
        {/* Fila 1: mercado / sector / búsqueda */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={familiaF}
            onChange={e => setFamiliaF(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs"
          >
            <option value="all">Todos los mercados</option>
            {familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={sectorF}
            onChange={e => setSectorF(e.target.value)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs"
          >
            <option value="all">Todos los sectores</option>
            {sectores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <Sep />
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="h-8 px-2 rounded-md border border-border bg-background text-xs"
            title="Ordenar"
          >
            <option value="score_desc">Score ↓</option>
            <option value="score_asc">Score ↑</option>
            <option value="adx_desc">Fuerza tendencia (ADX) ↓</option>
            <option value="vol_desc">Volatilidad ↓</option>
            <option value="trend_new">Tendencia más reciente</option>
            <option value="trend_old">Tendencia más antigua</option>
            <option value="pnl_desc">P&L acumulado ↓</option>
            <option value="pnl_asc">P&L acumulado ↑</option>
            <option value="recent_close">Cierre más reciente</option>
          </select>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar símbolo…"
              className="h-8 pl-7 w-48 text-xs"
            />
          </div>
        </div>

        {/* Fila 2: dirección + actividad escáner */}
        <div className="flex flex-wrap items-center gap-2">
          <Toggle label="Dir: Todas" active={dirF === 'all'} onClick={() => setDirF('all')} />
          <Toggle label="▲ ALCISTA" active={dirF === 'ALCISTA'} onClick={() => setDirF('ALCISTA')} />
          <Toggle label="▼ BAJISTA" active={dirF === 'BAJISTA'} onClick={() => setDirF('BAJISTA')} />
          <Sep />
          <Toggle label="Solo en escáner" active={activeF === 'active'} onClick={() => setActiveF('active')} />
          <Toggle label="Todos" active={activeF === 'all'} onClick={() => setActiveF('all')} />
          <Sep />
          <Toggle label="Tendencia fuerte (ADX≥25)" active={strongTrend} onClick={() => setStrongTrend(v => !v)} />
          <Sep />
          <Toggle label="Vol: Todas" active={volF === 'all'} onClick={() => setVolF('all')} />
          <Toggle label="Alta vol." active={volF === 'high'} onClick={() => setVolF('high')} />
          <Toggle label="Vol. normal" active={volF === 'normal'} onClick={() => setVolF('normal')} />
        </div>

        {/* Fila 3: estado de trades */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Trades</span>
          <Toggle label="Todos" active={tradeF === 'all'} onClick={() => setTradeF('all')} />
          <Toggle label="Con posición abierta" active={tradeF === 'open'} onClick={() => setTradeF('open')} />
          <Toggle label="Cerrados recientes (7d)" active={tradeF === 'recent_closed'} onClick={() => setTradeF('recent_closed')} />
          <Toggle label="Ganadores acumulado" active={tradeF === 'winners'} onClick={() => setTradeF('winners')} />
          <Toggle label="Perdedores acumulado" active={tradeF === 'losers'} onClick={() => setTradeF('losers')} />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Símbolo</TableHead>
              <TableHead>Mercado</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="text-right">ADX</TableHead>
              <TableHead className="text-right">Stoch</TableHead>
              <TableHead>ATR</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead>Último scan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
            ) : filtered.map(a => {
              const dir = (a.last_direction ?? '').toUpperCase();
              const inScanner = !!a.is_active_scanner;
              const rowTint =
                inScanner && dir === 'ALCISTA' ? 'bg-success/5 hover:bg-success/10' :
                inScanner && dir === 'BAJISTA' ? 'bg-destructive/5 hover:bg-destructive/10' :
                '';
              const agg = aggFor(a);
              return (
                <TableRow
                  key={`${a.symbol}-${a.broker}`}
                  className={`cursor-pointer ${rowTint}`}
                  onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: a.broker, symbol: a.symbol } })}
                >
                  <TableCell className="font-data font-bold">
                    {a.symbol}
                    <span className="ml-1.5 text-[9px] uppercase text-muted-foreground">{a.broker}</span>
                    {agg && agg.openCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/40">
                        ● {agg.openCount}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{a.familia ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.sector ?? '—'}</TableCell>
                  <TableCell className="text-right"><ScoreBadge score={a.last_score} /></TableCell>
                  <TableCell><DirectionCell value={a.last_direction} /></TableCell>
                  <TableCell className="text-right font-data text-xs">{a.last_adx != null ? Number(a.last_adx).toFixed(1) : '—'}</TableCell>
                  <TableCell className="text-right font-data text-xs">{a.last_stoch != null ? Number(a.last_stoch).toFixed(1) : '—'}</TableCell>
                  <TableCell><AtrBadge value={a.last_atr_state} /></TableCell>
                  <TableCell className="text-right font-data text-xs">{a.last_price != null ? Number(a.last_price).toFixed(4) : '—'}</TableCell>
                  <TableCell className="text-right font-data text-xs">
                    {agg && (agg.closedPnl !== 0 || agg.openCount > 0) ? (
                      <span className={agg.closedPnl > 0 ? 'text-success' : agg.closedPnl < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                        {agg.closedPnl >= 0 ? '+' : ''}{agg.closedPnl.toFixed(2)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.last_seen_scanner
                      ? new Date(a.last_seen_scanner).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const s = Number(score);
  if (s >= 75) {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/40">★ {s.toFixed(0)}</span>;
  }
  if (s >= 60) {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/15 text-success border border-success/40">● {s.toFixed(0)}</span>;
  }
  if (s >= 40) {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">◌ {s.toFixed(0)}</span>;
  }
  return <span className="font-data text-xs text-muted-foreground">{s.toFixed(0)}</span>;
}

function DirectionCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const v = value.toUpperCase();
  if (v === 'ALCISTA') return <span className="inline-flex items-center gap-1 text-success text-xs font-semibold"><ArrowUp className="w-3 h-3" /> ALCISTA</span>;
  if (v === 'BAJISTA') return <span className="inline-flex items-center gap-1 text-destructive text-xs font-semibold"><ArrowDown className="w-3 h-3" /> BAJISTA</span>;
  return <span className="text-xs">{value}</span>;
}

function AtrBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const v = value.toUpperCase();
  const style =
    v === 'BAJA' ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' :
    v === 'COHERENTE' ? 'bg-muted text-muted-foreground border-border' :
    v === 'ELEVADA' ? 'bg-orange-500/15 text-orange-500 border-orange-500/40' :
    v === 'ANORMAL' ? 'bg-destructive/15 text-destructive border-destructive/40' :
    'bg-muted text-muted-foreground border-border';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${style}`}>{v}</span>;
}
