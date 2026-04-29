import { useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import { useWatchlist, useDeleteWatchlistItem, useAddToWatchlist } from '@/hooks/use-watchlist';
import { useLatestScannerByKey } from '@/hooks/use-scanner-instruments';
import { useAuth } from '@/hooks/use-auth';
import { normalizeBroker, type BrokerFilter } from '@/lib/trade-utils';
import { toast } from 'sonner';
import type { UnifiedInstrument } from './EnTendenciaBlock';
import { SymbolMeta, PriceCell, SymbolName } from './EnTendenciaBlock';
import { TypeFilter } from './TypeFilter';
import { classifyInstrument, type InstrumentType } from '@/lib/instrument-classify';
import { RadarCaptureButton } from './RadarCaptureButton';
import { useQualificationMap } from '@/hooks/use-qualification';
import { useTableControls, useFiltered, SortHeader, TableSearchLimit } from './TableControls';

type SortKey = 'symbol' | 'price' | 'broker' | 'direction' | 'score' | 'stoch' | 'adx';

interface Props {
  brokerFilter: BrokerFilter;
}

interface SeguimientoItem {
  id: string;
  watchlistId: string;
  symbol: string;
  broker: 'darwinex' | 'octx';
  direction: 'alcista' | 'bajista';
  score: number | null;
  stoch: number | null;
  adx: number | null;
  current_price: number | null;
}

function isAlcistaDir(d: string): boolean {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

function buildItems(
  brokerFilter: BrokerFilter,
  scannerMap: Map<string, UnifiedInstrument>,
  watchlist: Array<{ id: string; symbol: string; broker: string; direction: string; status?: string; scanner_score?: number | null; stochastic_level?: number | null; adx_value?: number | null }>,
): SeguimientoItem[] {
  const out: SeguimientoItem[] = [];
  for (const w of watchlist) {
    const status = (w.status ?? '').toUpperCase();
    if (status !== 'SEGUIMIENTO') continue;
    const broker = normalizeBroker(w.broker) === 'octx' ? 'octx' : 'darwinex';
    if (brokerFilter !== 'all' && brokerFilter !== broker) continue;
    const key = `${w.symbol}::${broker}`;
    const scan = scannerMap.get(key);
    out.push({
      id: w.id,
      watchlistId: w.id,
      symbol: w.symbol,
      broker,
      direction: isAlcistaDir(scan?.direction ?? w.direction) ? 'alcista' : 'bajista',
      score: scan?.score ?? w.scanner_score ?? null,
      stoch: scan?.stoch_k ?? w.stochastic_level ?? null,
      adx: scan?.adx_value ?? w.adx_value ?? null,
      current_price: scan?.current_price ?? null,
    });
  }
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function SeguimientoBlock({ brokerFilter }: Props) {
  const { data: items } = useWatchlist();
  const scannerMap = useLatestScannerByKey();
  const del = useDeleteWatchlistItem();
  const qualMap = useQualificationMap();
  const [typeFilter, setTypeFilter] = useState<Set<InstrumentType>>(new Set());
  const controls = useTableControls<SortKey>({ key: null, dir: 'desc' });

  const fullList = useMemo(() => {
    const built = buildItems(brokerFilter, scannerMap, items ?? []);
    return built.filter(it => !qualMap.has(`${it.symbol}::${it.broker}`));
  }, [brokerFilter, scannerMap, items, qualMap]);
  const counts = useMemo(() => {
    const c: Partial<Record<InstrumentType, number>> = {};
    for (const it of fullList) {
      const t = classifyInstrument(it.symbol).type;
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [fullList]);
  const typeFiltered = typeFilter.size === 0
    ? fullList
    : fullList.filter(it => typeFilter.has(classifyInstrument(it.symbol).type));

  const list = useFiltered<SeguimientoItem, SortKey>(
    typeFiltered,
    { sort: controls.sort, search: controls.search, limit: controls.limit },
    {
      symbol: it => it.symbol,
      price: it => it.current_price,
      broker: it => it.broker,
      direction: it => it.direction,
      score: it => it.score,
      stoch: it => it.stoch,
      adx: it => it.adx,
    },
    it => [it.symbol, it.broker],
  );

  const handleRemove = (item: SeguimientoItem) => {
    del.mutate(item.watchlistId, {
      onSuccess: () => toast.success(`${item.symbol} fuera de seguimiento`),
      onError: () => toast.error('Error al quitar'),
    });
  };

  if (fullList.length === 0) {
    // If qualification panel above is rendering items, stay silent.
    if (qualMap.size > 0) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <Eye className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-sm text-muted-foreground">Sin instrumentos en seguimiento — añade desde el escáner con "👁 Seguir"</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-1.5 bg-secondary/40 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-3 flex-wrap">
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <TableSearchLimit
            search={controls.search}
            onSearchChange={controls.setSearch}
            limit={controls.limit}
            onLimitChange={controls.setLimit}
            total={typeFiltered.length}
            shown={list.length}
          />
          <TypeFilter selected={typeFilter} onChange={setTypeFilter} availableCounts={counts} />
        </div>
      </div>
      {/* Desktop */}
      <table className="w-full hidden md:table">
        <thead>
          <tr className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="text-left px-3 py-2 w-[50px]">#</th>
            <SortHeader label="Símbolo" sortKey="symbol" state={controls.sort} onToggle={controls.toggle} />
            <SortHeader label="Precio" sortKey="price" state={controls.sort} onToggle={controls.toggle} align="right" className="w-[90px]" />
            <SortHeader label="Cuenta" sortKey="broker" state={controls.sort} onToggle={controls.toggle} className="w-[80px]" />
            <SortHeader label="Dir" sortKey="direction" state={controls.sort} onToggle={controls.toggle} className="w-[80px]" />
            <SortHeader label="Score" sortKey="score" state={controls.sort} onToggle={controls.toggle} align="center" className="w-[70px]" />
            <SortHeader label="Stoch" sortKey="stoch" state={controls.sort} onToggle={controls.toggle} align="center" className="w-[70px]" />
            <SortHeader label="ADX" sortKey="adx" state={controls.sort} onToggle={controls.toggle} align="center" className="w-[70px]" />
            <th className="text-right px-2 py-2 w-[120px]">Acción</th>
          </tr>
        </thead>
        <tbody>
          {list.map((item, idx) => (
            <tr key={item.id} className="border-t border-border text-sm">
              <td className="px-3 py-2 font-data text-muted-foreground">{idx + 1}</td>
              <td className="px-3 py-2 font-bold text-foreground">
                <div className="flex flex-col gap-0.5">
                  <SymbolName symbol={item.symbol} />
                  <SymbolMeta symbol={item.symbol} />
                </div>
              </td>
              <td className="px-2 py-2 text-right"><PriceCell price={item.current_price} /></td>
              <td className="px-2 py-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  item.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
                }`}>{item.broker === 'darwinex' ? 'NK' : 'OX'}</span>
              </td>
              <td className="px-2 py-2">
                <span className={`font-bold text-xs ${item.direction === 'alcista' ? 'text-success' : 'text-destructive'}`}>
                  {item.direction === 'alcista' ? 'BUY' : 'SELL'}
                </span>
              </td>
              <td className="px-2 py-2 text-center font-data text-xs font-bold">{item.score ?? '—'}</td>
              <td className="px-2 py-2 text-center font-data text-xs">{item.stoch != null ? Math.round(item.stoch) : '—'}</td>
              <td className="px-2 py-2 text-center font-data text-xs">{item.adx ?? '—'}</td>
              <td className="px-2 py-2 text-right">
                <div className="inline-flex items-center gap-1 justify-end">
                  <RadarCaptureButton symbol={item.symbol} />
                  <button
                    onClick={() => handleRemove(item)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Quitar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {list.map((item, idx) => (
          <div key={item.id} className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-data text-xs text-muted-foreground">#{idx + 1}</span>
              <span className="font-bold text-sm text-foreground"><SymbolName symbol={item.symbol} /></span>
              <span className="font-data text-xs font-semibold text-foreground">{item.current_price != null ? item.current_price.toLocaleString(undefined, { maximumFractionDigits: 5 }) : ''}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                item.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
              }`}>{item.broker === 'darwinex' ? 'NK' : 'OX'}</span>
              <span className={`text-xs font-bold ${item.direction === 'alcista' ? 'text-success' : 'text-destructive'}`}>
                {item.direction === 'alcista' ? 'BUY' : 'SELL'}
              </span>
              <span className="text-xs font-data font-bold ml-auto">Score {item.score ?? '—'}</span>
            </div>
            <div className="mt-1"><SymbolMeta symbol={item.symbol} compact /></div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground gap-2 flex-wrap">
              <span>Stoch {item.stoch != null ? Math.round(item.stoch) : '—'} · ADX {item.adx ?? '—'}</span>
              <div className="inline-flex items-center gap-1">
                <RadarCaptureButton symbol={item.symbol} />
                <button
                  onClick={() => handleRemove(item)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3 h-3" /> Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useSeguimientoCount(brokerFilter: BrokerFilter): number {
  const { data: items } = useWatchlist();
  const scannerMap = useLatestScannerByKey();
  return useMemo(
    () => buildItems(brokerFilter, scannerMap, items ?? []).length,
    [brokerFilter, scannerMap, items],
  );
}

/** Hook to add an instrument to seguimiento from the scanner */
export function useAddToSeguimiento() {
  const add = useAddToWatchlist();
  const { user } = useAuth();
  return (inst: UnifiedInstrument) => {
    if (!user) {
      toast.error('Inicia sesión para seguir');
      return;
    }
    add.mutate({
      symbol: inst.symbol,
      direction: isAlcistaDir(inst.direction) ? 'alcista' : 'bajista',
      watch_reason: `Seguimiento manual — Score ${inst.score}/100`,
      stochastic_level: inst.stoch_k ?? null,
      scanner_score: inst.score,
      adx_value: inst.adx_value,
      adx_state: inst.adx_state,
      distance_to_ma50: inst.distance_to_ma50,
      status: 'SEGUIMIENTO',
      added_from_scanner: true,
      trade_id: null,
      broker: inst.broker,
    }, {
      onSuccess: () => toast.success(`${inst.symbol} → Seguimiento`),
      onError: () => toast.error('Error al añadir a seguimiento'),
    });
  };
}
