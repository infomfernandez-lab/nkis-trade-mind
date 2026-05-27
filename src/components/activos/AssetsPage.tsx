import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { useBrokerFilter } from '@/components/layout/AppLayout';

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

export default function AssetsPage() {
  const { broker: globalBroker } = useBrokerFilter();
  const [familiaF, setFamiliaF] = useState<string>('all');
  const [sectorF, setSectorF] = useState<string>('all');
  const [dirF, setDirF] = useState<DirFilter>('all');
  const [activeF, setActiveF] = useState<ActiveFilter>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Map global broker filter (darwinex/octx/all) → DB broker value (nkis/octx/all)
  const brokerDb = globalBroker === 'darwinex' ? 'nkis' : globalBroker === 'octx' ? 'octx' : 'all';

  const { data: assets = [], isLoading, error: queryError } = useQuery({
    queryKey: ['assets-all', brokerDb],
    queryFn: async () => {
      const qs = new URLSearchParams({ select: '*' });
      if (brokerDb !== 'all') qs.set('broker', brokerDb);
      const res = await fetch(`/api/assets-proxy?${qs.toString()}`);
      if (!res.ok) throw new Error(`Proxy ${res.status}: ${await res.text()}`);
      const rows = (await res.json()) as Asset[];
      console.log('[Activos] proxy →', { brokerDb, rows: rows.length, brokers: [...new Set(rows.map(r => r.broker))] });
      return rows;
    },
  });

  if (queryError) console.error('[Activos] queryError:', queryError);

  const familias = useMemo(() => {
    const s = new Set<string>();
    assets.forEach(a => { if (a.familia) s.add(a.familia); });
    return Array.from(s).sort();
  }, [assets]);

  // Sectores dependen de la familia seleccionada
  const sectores = useMemo(() => {
    const s = new Set<string>();
    assets.forEach(a => {
      if (familiaF !== 'all' && a.familia !== familiaF) return;
      if (a.sector) s.add(a.sector);
    });
    return Array.from(s).sort();
  }, [assets, familiaF]);

  // Reset sector cuando cambia familia y el sector actual ya no aplica
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
      return true;
    });
    out.sort((a, b) => (Number(b.last_score ?? -Infinity)) - (Number(a.last_score ?? -Infinity)));
    return out;
  }, [assets, brokerDb, familiaF, sectorF, dirF, activeF, search]);

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

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border border-border bg-card">
        <select
          value={familiaF}
          onChange={e => setFamiliaF(e.target.value)}
          className="h-8 px-2 rounded-md border border-border bg-background text-xs"
        >
          <option value="all">Todas las familias</option>
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
        <Toggle label="Dir: Todas" active={dirF === 'all'} onClick={() => setDirF('all')} />
        <Toggle label="▲ ALCISTA" active={dirF === 'ALCISTA'} onClick={() => setDirF('ALCISTA')} />
        <Toggle label="▼ BAJISTA" active={dirF === 'BAJISTA'} onClick={() => setDirF('BAJISTA')} />
        <Sep />
        <Toggle label="Solo activos" active={activeF === 'active'} onClick={() => setActiveF('active')} />
        <Toggle label="Todos" active={activeF === 'all'} onClick={() => setActiveF('all')} />
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

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Símbolo</TableHead>
              <TableHead>Familia</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="text-right">ADX</TableHead>
              <TableHead className="text-right">Stoch</TableHead>
              <TableHead>ATR</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Último scan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow
                key={`${a.symbol}-${a.broker}`}
                className="cursor-pointer"
                onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: a.broker, symbol: a.symbol } })}
              >
                <TableCell className="font-data font-bold">
                  {a.symbol}
                  <span className="ml-1.5 text-[9px] uppercase text-muted-foreground">{a.broker}</span>
                </TableCell>
                <TableCell className="text-xs">{a.familia ?? '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.sector ?? '—'}</TableCell>
                <TableCell className="text-right"><ScoreBadge score={a.last_score} /></TableCell>
                <TableCell><DirectionCell value={a.last_direction} /></TableCell>
                <TableCell className="text-right font-data text-xs">{a.last_adx != null ? Number(a.last_adx).toFixed(1) : '—'}</TableCell>
                <TableCell className="text-right font-data text-xs">{a.last_stoch != null ? Number(a.last_stoch).toFixed(1) : '—'}</TableCell>
                <TableCell><AtrBadge value={a.last_atr_state} /></TableCell>
                <TableCell className="text-right font-data text-xs">{a.last_price != null ? Number(a.last_price).toFixed(4) : '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.last_seen_scanner
                    ? new Date(a.last_seen_scanner).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
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
