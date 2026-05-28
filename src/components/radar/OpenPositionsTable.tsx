import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TrendingUp, TrendingDown, BookCheck, Circle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAllTrades } from '@/hooks/use-trades';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { SymbolMeta, useUnifiedInstruments, type UnifiedInstrument } from './EnTendenciaBlock';
import { classifyInstrument } from '@/lib/instrument-classify';
import {
  type ScannerFilterState,
  type TradeAgg,
  VOL_RANK,
  EMPTY_SCANNER_FILTERS,
  aggregateTradesByKey,
} from './AssetsStyleFiltersBar';
import { useAssetMap } from '@/hooks/use-asset-map';
import { hasJournal } from '@/lib/trade-derived';
import { supabase } from '@/integrations/supabase/client';

type AssetMap = ReturnType<typeof useAssetMap>;

interface Props {
  brokerFilter: BrokerFilter;
  filters?: ScannerFilterState;
  tradeAgg?: Map<string, TradeAgg>;
  assetMap?: AssetMap;
  /** Modo compacto para dashboard: sin filtros, solo tabla. */
  compact?: boolean;
}

function formatPrice(price: number): string {
  if (!price) return '—';
  return price > 100 ? price.toFixed(2) : price.toFixed(5);
}

function tradeStatus(t: Trade): string {
  if (t.netPnl > 0) return 'En beneficio';
  if (t.netPnl < 0) return 'En pérdida — SL protege';
  return 'Dejar correr';
}

interface ScannerSessionLite {
  session_date: string;
  broker: string;
  top_instruments: unknown;
}

function useScannerSessions() {
  return useQuery<ScannerSessionLite[]>({
    queryKey: ['scanner_sessions', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('session_date, broker, top_instruments')
        .order('session_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ScannerSessionLite[];
    },
    staleTime: 60_000,
  });
}

export function OpenPositionsTable({ brokerFilter, filters, tradeAgg, assetMap }: Props) {
  const { openTrades, isLoading } = useAllTrades();
  const filteredAll = filterByBroker(openTrades, brokerFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: scannerSessions } = useScannerSessions();
  const scannerAll = useUnifiedInstruments(brokerFilter);

  // Indexar el escáner por símbolo+broker para fusionar métricas (ADX, ATR…)
  // con los trades abiertos y poder aplicar los mismos filtros del escáner.
  const scannerByKey = useMemo(() => {
    const m = new Map<string, UnifiedInstrument>();
    for (const it of scannerAll) m.set(`${it.symbol}::${it.broker}`, it);
    return m;
  }, [scannerAll]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    const aggFor = (t: Trade) => tradeAgg.get(`${t.symbol}|${t.broker}`);

    const matched = filteredAll.filter(t => {
      const c = assetMap.classify(t.symbol);
      if (filters.mercado !== 'all' && c.mercado !== filters.mercado) return false;
      if (filters.sector !== 'all' && c.sector !== filters.sector) return false;

      const isAlc = t.direction === 'BUY';
      const isBaj = t.direction === 'SELL';
      if (filters.dir === 'ALCISTA' && !isAlc) return false;
      if (filters.dir === 'BAJISTA' && !isBaj) return false;

      if (q && !t.symbol.toUpperCase().includes(q)
            && !classifyInstrument(t.symbol).description.toUpperCase().includes(q)) return false;

      const scan = scannerByKey.get(`${t.symbol}::${t.broker}`);
      if (filters.strongTrend && !(Number(scan?.adx_value ?? 0) >= 25)) return false;
      if (filters.vol !== 'all') {
        const v = (scan?.atr_estado ?? '').toString().toUpperCase();
        if (filters.vol === 'high' && !(v === 'ELEVADA' || v === 'ANORMAL')) return false;
        if (filters.vol === 'normal' && !(v === 'BAJA' || v === 'COHERENTE')) return false;
      }
      if (filters.trade !== 'all') {
        const agg = aggFor(t);
        if (filters.trade === 'open') { /* todas las filas ya son abiertas */ }
        else if (!agg) return false;
        else {
          if (filters.trade === 'recent_closed' && agg.recentClosedCount === 0) return false;
          if (filters.trade === 'winners' && !(agg.closedPnl > 0)) return false;
          if (filters.trade === 'losers' && !(agg.closedPnl < 0)) return false;
        }
      }
      return true;
    });

    const num = (x: number | null | undefined) => (x == null ? -Infinity : Number(x));
    const cmp = (a: Trade, b: Trade): number => {
      const aScan = scannerByKey.get(`${a.symbol}::${a.broker}`);
      const bScan = scannerByKey.get(`${b.symbol}::${b.broker}`);
      const aAgg = aggFor(a);
      const bAgg = aggFor(b);
      switch (filters.sort) {
        case 'score_desc': return num(bScan?.score) - num(aScan?.score);
        case 'score_asc':  return num(aScan?.score) - num(bScan?.score);
        case 'adx_desc':   return num(bScan?.adx_value) - num(aScan?.adx_value);
        case 'vol_desc': {
          const av = VOL_RANK[(aScan?.atr_estado ?? '').toString().toUpperCase()] ?? 0;
          const bv = VOL_RANK[(bScan?.atr_estado ?? '').toString().toUpperCase()] ?? 0;
          return bv - av;
        }
        case 'pnl_desc':   return (bAgg?.closedPnl ?? -Infinity) - (aAgg?.closedPnl ?? -Infinity);
        case 'pnl_asc':    return (aAgg?.closedPnl ?? Infinity) - (bAgg?.closedPnl ?? Infinity);
        case 'recent_close': return (bAgg?.lastExit ?? 0) - (aAgg?.lastExit ?? 0);
      }
    };
    return [...matched].sort(cmp);
  }, [filteredAll, filters, tradeAgg, scannerByKey, assetMap]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-6">Cargando posiciones...</div>;
  }

  if (filteredAll.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No hay posiciones abiertas</p>
        <p className="text-xs text-muted-foreground/60 mt-1">El EA abrirá posiciones automáticamente cuando se cumplan las condiciones del sistema.</p>
      </div>
    );
  }

  const dwTrades = filtered.filter(t => t.broker === 'darwinex');
  const fxTrades = filtered.filter(t => t.broker === 'octx');
  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Ninguna posición coincide con los filtros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dwTrades.length > 0 && (
        <BrokerSubsection
          broker="darwinex"
          trades={dwTrades}
          expandedId={expandedId}
          onToggleExpand={toggle}
          scannerSessions={scannerSessions ?? []}
        />
      )}
      {fxTrades.length > 0 && (
        <BrokerSubsection
          broker="octx"
          trades={fxTrades}
          expandedId={expandedId}
          onToggleExpand={toggle}
          scannerSessions={scannerSessions ?? []}
        />
      )}
      <p className="text-[11px] italic text-muted-foreground/70 leading-snug px-1">
        Las posiciones abiertas solo las cierra el SL. El scanner no tiene autoridad sobre trades ya abiertos.
      </p>
    </div>
  );
}

function BrokerSubsection({
  broker, trades, expandedId, onToggleExpand, scannerSessions,
}: {
  broker: 'darwinex' | 'octx';
  trades: Trade[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  scannerSessions: ScannerSessionLite[];
}) {
  const total = trades.reduce((s, t) => s + t.netPnl, 0);
  const headerColor = broker === 'darwinex'
    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
    : 'bg-orange-900/40 text-orange-300 border-orange-700/50';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${headerColor}`}>
          {broker === 'darwinex' ? 'NK' : 'OX'}
        </span>
        <span className="text-xs text-muted-foreground">{trades.length} pos</span>
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="px-3 py-3 w-[40px]"></th>
              <th className="text-left px-3 py-3">Symbol</th>
              <th className="text-left px-3 py-3 w-[80px]">Dir</th>
              <th className="text-left px-3 py-3 w-[90px]">Fecha</th>
              <th className="text-right px-3 py-3 w-[100px]">Entrada</th>
              <th className="text-right px-3 py-3 w-[100px]">SL</th>
              <th className="text-right px-3 py-3 w-[100px]">TP</th>
              <th className="text-right px-3 py-3 w-[110px]">P&L</th>
              <th className="text-left px-3 py-3 w-[200px]">Estado</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <PositionRow
                key={t.id}
                trade={t}
                expanded={expandedId === t.id}
                onToggle={() => onToggleExpand(t.id)}
                scannerSessions={scannerSessions}
              />
            ))}
            <tr className="border-t-2 border-border bg-secondary/30">
              <td colSpan={7} className="px-3 py-3 text-sm font-semibold text-muted-foreground text-right">
                Total {broker === 'darwinex' ? 'NK' : 'OX'}
              </td>
              <td className={`px-3 py-3 text-right font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(total)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {trades.map(t => (
          <MobileRow
            key={t.id}
            trade={t}
            expanded={expandedId === t.id}
            onToggle={() => onToggleExpand(t.id)}
            scannerSessions={scannerSessions}
          />
        ))}
        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 text-xs">
          <span className="text-muted-foreground font-semibold">Total {broker === 'darwinex' ? 'NK' : 'OX'}</span>
          <span className={`font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ trade: t }: {
  trade: Trade;
  expanded?: boolean;
  onToggle?: () => void;
  scannerSessions: ScannerSessionLite[];
}) {
  const navigate = useNavigate();
  const journalDone = hasJournal(t);
  const alcista = t.direction === 'BUY';
  const rowBg = alcista
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';
  const meta = classifyInstrument(t.symbol);
  const assetBroker = t.broker === 'darwinex' || t.broker === 'nkis' ? 'nkis' : 'octx';

  return (
    <tr
      className={`border-b border-border transition-colors cursor-pointer ${rowBg}`}
      onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: assetBroker, symbol: t.symbol } })}
    >
      <td className="px-3 py-3 text-center">
        {journalDone
          ? <BookCheck className="w-4 h-4 text-success inline" />
          : <Circle className="w-4 h-4 text-muted-foreground inline" />}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-foreground">{t.symbol}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[260px]" title={meta.description}>{meta.description}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold ${
          alcista ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive'
        }`}>
          {alcista ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {t.direction}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
        {new Date(t.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
      </td>
      <td className="px-3 py-3 text-right font-data">{formatPrice(t.entryPrice)}</td>
      <td className="px-3 py-3 text-right font-data text-destructive/80">{formatPrice(t.slPrice)}</td>
      <td className="px-3 py-3 text-right font-data text-success/80">{formatPrice(t.tpPrice)}</td>
      <td className={`px-3 py-3 text-right font-data font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
        {formatCurrency(t.netPnl)}
      </td>
      <td className="px-3 py-3 text-sm text-muted-foreground">{tradeStatus(t)}</td>
    </tr>
  );
}

function MobileRow({ trade: t }: {
  trade: Trade;
  expanded?: boolean;
  onToggle?: () => void;
  scannerSessions: ScannerSessionLite[];
}) {
  const navigate = useNavigate();
  const journalDone = hasJournal(t);
  const alcista = t.direction === 'BUY';
  const assetBroker = t.broker === 'darwinex' || t.broker === 'nkis' ? 'nkis' : 'octx';

  return (
    <div
      className={`p-3 cursor-pointer ${alcista ? 'bg-success/10' : 'bg-destructive/10'}`}
      onClick={() => navigate({ to: '/activos/$broker/$symbol', params: { broker: assetBroker, symbol: t.symbol } })}
    >
      <div className="w-full flex items-center gap-2 flex-wrap text-left">
        {journalDone
          ? <BookCheck className="w-4 h-4 text-success shrink-0" />
          : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="font-bold text-sm">{t.symbol}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
          alcista ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive'
        }`}>
          {alcista ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {t.direction}
        </span>
        <span className={`ml-auto font-data font-bold text-sm ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
          {formatCurrency(t.netPnl)}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{tradeStatus(t)}</div>
      <div className="mt-1"><SymbolMeta symbol={t.symbol} compact /></div>
    </div>
  );
}
