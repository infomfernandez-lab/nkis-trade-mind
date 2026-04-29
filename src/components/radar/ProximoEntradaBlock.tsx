import { useMemo, useState } from 'react';
import { Zap, Trash2, EyeOff } from 'lucide-react';
import { useWatchlist, useDeleteWatchlistItem, useAddToWatchlist } from '@/hooks/use-watchlist';
import { useLatestScannerByKey } from '@/hooks/use-scanner-instruments';
import { useAuth } from '@/hooks/use-auth';
import { normalizeBroker, type BrokerFilter } from '@/lib/trade-utils';
import { toast } from 'sonner';
import { SymbolMeta, PriceCell, SymbolName, PriceTag } from './EnTendenciaBlock';
import { TypeFilter } from './TypeFilter';
import { classifyInstrument, type InstrumentType } from '@/lib/instrument-classify';
import { RadarCaptureButton } from './RadarCaptureButton';
import { useQualificationMap } from '@/hooks/use-qualification';
import { useTableControls, useFiltered, SortHeader, TableSearchLimit } from './TableControls';

type SortKey = 'symbol' | 'price' | 'broker' | 'direction' | 'score' | 'stoch' | 'atr';

interface Props {
  brokerFilter: BrokerFilter;
}

interface NearItem {
  id: string;                       // either watchlist UUID or `${symbol}::${broker}` synthetic
  watchlistId: string | null;       // real watchlist row id if present
  symbol: string;
  broker: 'darwinex' | 'octx';
  direction: 'alcista' | 'bajista';
  stoch: number | null;
  pullback: boolean;
  pullbackBars: number | null;
  atr: number | null;
  source: 'scanner' | 'manual';
  scannerScore: number | null;
  current_price: number | null;
}

function isAlcistaDir(d: string): boolean {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

function buildNearItems(
  brokerFilter: BrokerFilter,
  scannerMap: Map<string, ReturnType<typeof useLatestScannerByKey> extends Map<string, infer V> ? V : never>,
  watchlist: Array<{ id: string; symbol: string; broker: string; direction: string; status?: string }>,
): NearItem[] {
  const out = new Map<string, NearItem>();

  // Build set of discarded keys so the scanner-driven loop ignores them
  const discarded = new Set<string>();
  const watchlistByKey = new Map<string, typeof watchlist[number]>();
  for (const w of watchlist) {
    const broker = normalizeBroker(w.broker) === 'octx' ? 'octx' : 'darwinex';
    const key = `${w.symbol}::${broker}`;
    if ((w.status ?? '').toUpperCase() === 'DESCARTADO') {
      discarded.add(key);
    }
    if (!watchlistByKey.has(key)) watchlistByKey.set(key, w);
  }

  // 1) Scanner-driven: ZONA_ENTRADA OR pullback_active
  for (const [key, inst] of scannerMap.entries()) {
    if (brokerFilter !== 'all' && brokerFilter !== inst.broker) continue;
    if (discarded.has(key)) continue;
    const matches = inst.pullback_active || inst.stoch_estado === 'ZONA_ENTRADA';
    if (!matches) continue;
    const wl = watchlistByKey.get(key);
    out.set(key, {
      id: key,
      watchlistId: wl?.id ?? null,
      symbol: inst.symbol,
      broker: inst.broker,
      direction: isAlcistaDir(inst.direction) ? 'alcista' : 'bajista',
      stoch: inst.stoch_k,
      pullback: inst.pullback_active,
      pullbackBars: inst.pullback_bars,
      atr: inst.atr,
      source: 'scanner',
      scannerScore: inst.score ?? null,
      current_price: inst.current_price ?? null,
    });
  }

  // 2) Manually flagged from En tendencia (status='PROXIMO')
  for (const w of watchlist) {
    if ((w.status ?? '').toUpperCase() !== 'PROXIMO') continue;
    const broker = normalizeBroker(w.broker) === 'octx' ? 'octx' : 'darwinex';
    if (brokerFilter !== 'all' && brokerFilter !== broker) continue;
    const key = `${w.symbol}::${broker}`;
    if (out.has(key)) continue;
    const scan = scannerMap.get(key);
    out.set(key, {
      id: key,
      watchlistId: w.id,
      symbol: w.symbol,
      broker,
      direction: isAlcistaDir(scan?.direction ?? w.direction) ? 'alcista' : 'bajista',
      stoch: scan?.stoch_k ?? null,
      pullback: scan?.pullback_active ?? false,
      pullbackBars: scan?.pullback_bars ?? null,
      atr: scan?.atr ?? null,
      source: 'manual',
      scannerScore: scan?.score ?? null,
      current_price: scan?.current_price ?? null,
    });
  }

  return Array.from(out.values()).sort((a, b) => {
    if (a.pullback !== b.pullback) return a.pullback ? -1 : 1;
    return (b.scannerScore ?? 0) - (a.scannerScore ?? 0);
  });
}

export function ProximoEntradaBlock({ brokerFilter }: Props) {
  const { data: items } = useWatchlist();
  const scannerMap = useLatestScannerByKey();
  const del = useDeleteWatchlistItem();
  const add = useAddToWatchlist();
  const { user } = useAuth();
  const qualMap = useQualificationMap();
  const [typeFilter, setTypeFilter] = useState<Set<InstrumentType>>(new Set());
  const controls = useTableControls<SortKey>({ key: null, dir: 'desc' });

  const allNear: NearItem[] = useMemo(() => {
    const built = buildNearItems(brokerFilter, scannerMap, items ?? []);
    return built.filter(it => !qualMap.has(`${it.symbol}::${it.broker}`));
  }, [brokerFilter, scannerMap, items, qualMap]);
  const counts = useMemo(() => {
    const c: Partial<Record<InstrumentType, number>> = {};
    for (const it of allNear) {
      const t = classifyInstrument(it.symbol).type;
      c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [allNear]);
  const typeFiltered = typeFilter.size === 0
    ? allNear
    : allNear.filter(it => typeFilter.has(classifyInstrument(it.symbol).type));

  const near = useFiltered<NearItem, SortKey>(
    typeFiltered,
    { sort: controls.sort, search: controls.search, limit: controls.limit },
    {
      symbol: it => it.symbol,
      price: it => it.current_price,
      broker: it => it.broker,
      direction: it => it.direction,
      score: it => it.scannerScore,
      stoch: it => it.stoch,
      atr: it => it.atr,
    },
    it => [it.symbol, it.broker],
  );

  const handleRemove = (item: NearItem) => {
    if (!item.watchlistId) {
      toast.info(`${item.symbol} viene del escáner — usa "Descartar" para ocultarlo`);
      return;
    }
    del.mutate(item.watchlistId, {
      onSuccess: () => toast.success(`${item.symbol} eliminado`),
      onError: () => toast.error('Error al eliminar'),
    });
  };

  const handleDiscard = (item: NearItem) => {
    if (!user) {
      toast.error('Inicia sesión para descartar');
      return;
    }
    // If already in watchlist, update via delete + reinsert as DESCARTADO would require update.
    // Simpler path: if there's a watchlist row, delete it first, then insert as DESCARTADO.
    const insertDiscarded = () => {
      add.mutate({
        symbol: item.symbol,
        direction: item.direction,
        watch_reason: 'Descartado manualmente desde Entrada Próxima',
        stochastic_level: item.stoch,
        scanner_score: item.scannerScore,
        adx_value: null,
        adx_state: null,
        distance_to_ma50: null,
        status: 'DESCARTADO',
        added_from_scanner: item.source === 'scanner',
        trade_id: null,
        broker: item.broker,
      }, {
        onSuccess: () => toast.success(`${item.symbol} descartado`),
        onError: () => toast.error('Error al descartar'),
      });
    };
    if (item.watchlistId) {
      del.mutate(item.watchlistId, { onSuccess: insertDiscarded, onError: () => toast.error('Error al descartar') });
    } else {
      insertDiscarded();
    }
  };

  if (allNear.length === 0) {
    if (qualMap.size > 0) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <Zap className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-sm text-muted-foreground">Sin señales próximas hoy — continúa vigilando</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="sticky top-0 z-30 px-3 py-1.5 bg-secondary border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-3 flex-wrap">
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <TableSearchLimit
            search={controls.search}
            onSearchChange={controls.setSearch}
            limit={controls.limit}
            onLimitChange={controls.setLimit}
            total={typeFiltered.length}
            shown={near.length}
            suggestions={typeFiltered.map(it => it.symbol)}
          />
          <TypeFilter selected={typeFilter} onChange={setTypeFilter} availableCounts={counts} />
        </div>
      </div>
      {/* Desktop */}
      <table className="w-full hidden md:table">
        <thead className="sticky top-[34px] z-20">
          <tr className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
            <SortHeader label="Símbolo" sortKey="symbol" state={controls.sort} onToggle={controls.toggle} />
            <SortHeader label="Precio" sortKey="price" state={controls.sort} onToggle={controls.toggle} align="right" className="w-[90px]" />
            <SortHeader label="Cuenta" sortKey="broker" state={controls.sort} onToggle={controls.toggle} className="w-[90px]" />
            <SortHeader label="Señal" sortKey="stoch" state={controls.sort} onToggle={controls.toggle} className="w-[200px]" />
            <th className="text-left px-2 py-2">Qué hacer</th>
            <th className="text-right px-2 py-2 w-[180px]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {near.map(item => (
            <NearRow
              key={item.id}
              item={item}
              onRemove={() => handleRemove(item)}
              onDiscard={() => handleDiscard(item)}
            />
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {near.map(item => (
          <NearMobileCard
            key={item.id}
            item={item}
            onRemove={() => handleRemove(item)}
            onDiscard={() => handleDiscard(item)}
          />
        ))}
      </div>
    </div>
  );
}

function signalText(item: NearItem): string {
  const dir = item.direction === 'alcista' ? 'BUY' : 'SELL';
  if (item.pullback) return `${dir} — PULLBACK${item.pullbackBars ? ` ${item.pullbackBars}v` : ''}`;
  if (item.stoch != null) return `${dir} — Stoch ~${Math.round(item.stoch)}`;
  return dir;
}

function formatAtr(atr: number | null): string {
  if (atr == null) return '';
  if (Math.abs(atr) >= 100) return atr.toFixed(2);
  if (Math.abs(atr) >= 1) return atr.toFixed(3);
  return atr.toFixed(4);
}

function whatToDo(item: NearItem): string {
  const sign = item.direction === 'alcista' ? '−' : '+';
  const cross = item.direction === 'alcista' ? 'AL ALZA nivel 30 → BUY' : 'A LA BAJA nivel 70 → SELL';
  const atrPart = item.atr != null
    ? `SL = entrada ${sign} ${formatAtr(item.atr)} (ATR × 1.5).`
    : `SL = entrada ${sign} (ATR × 1.5).`;
  return `Stoch(5,2,2) cruce ${cross}. ${atrPart} Anotar en bitácora.`;
}

function ActionButtons({ symbol, onRemove, onDiscard, hasWatchlistRow }: { symbol: string; onRemove: () => void; onDiscard: () => void; hasWatchlistRow: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      <RadarCaptureButton symbol={symbol} />
      <button
        onClick={onDiscard}
        title="Ocultar de la lista (queda registrado como descartado)"
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
      >
        <EyeOff className="w-3 h-3" /> Descartar
      </button>
      {hasWatchlistRow && (
        <button
          onClick={onRemove}
          title="Eliminar definitivamente de la watchlist"
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Eliminar
        </button>
      )}
    </div>
  );
}

function NearRow({ item, onRemove, onDiscard }: { item: NearItem; onRemove: () => void; onDiscard: () => void }) {
  return (
    <tr className={`border-t border-border ${item.pullback ? 'bg-primary/[0.05] border-l-[3px] border-l-primary' : ''}`}>
      <td className="px-3 py-2 font-bold text-foreground text-sm">
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
      <td className="px-2 py-2 text-xs">
        <span className={`font-bold ${item.direction === 'alcista' ? 'text-success' : 'text-destructive'}`}>
          {signalText(item)}
        </span>
      </td>
      <td className="px-2 py-2 text-[11px] text-muted-foreground leading-snug">{whatToDo(item)}</td>
      <td className="px-2 py-2">
        <ActionButtons symbol={item.symbol} onRemove={onRemove} onDiscard={onDiscard} hasWatchlistRow={!!item.watchlistId} />
      </td>
    </tr>
  );
}

function NearMobileCard({ item, onRemove, onDiscard }: { item: NearItem; onRemove: () => void; onDiscard: () => void }) {
  return (
    <div className={`p-3 ${item.pullback ? 'bg-primary/[0.05] border-l-[3px] border-l-primary' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm text-foreground"><SymbolName symbol={item.symbol} /></span>
        <PriceTag price={item.current_price} compact />
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          item.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
        }`}>{item.broker === 'darwinex' ? 'NK' : 'OX'}</span>
        <span className={`text-xs font-bold ${item.direction === 'alcista' ? 'text-success' : 'text-destructive'}`}>
          {signalText(item)}
        </span>
      </div>
      <div className="mt-1"><SymbolMeta symbol={item.symbol} compact /></div>
      <div className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{whatToDo(item)}</div>
      <div className="mt-2 flex justify-end">
        <ActionButtons symbol={item.symbol} onRemove={onRemove} onDiscard={onDiscard} hasWatchlistRow={!!item.watchlistId} />
      </div>
    </div>
  );
}

export function useProximoEntradaCount(brokerFilter: BrokerFilter): number {
  const { data: items } = useWatchlist();
  const scannerMap = useLatestScannerByKey();
  return useMemo(
    () => buildNearItems(brokerFilter, scannerMap, items ?? []).length,
    [brokerFilter, scannerMap, items],
  );
}
