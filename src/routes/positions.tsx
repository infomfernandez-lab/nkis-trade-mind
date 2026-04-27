import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, Clock, Pencil, Check, X } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from '@/components/ui/table';

export const Route = createFileRoute('/positions')({
  component: PositionsPage,
  head: () => ({
    meta: [
      { title: 'Posiciones Abiertas — CAP Trading' },
      { name: 'description', content: 'Posiciones abiertas en tiempo real.' },
    ],
  }),
});

const INSTRUMENT_CATEGORIES: Record<string, string> = {
  XAUUSD: 'metals', XAGUSD: 'metals', XAUEUR: 'metals',
  XTIUSD: 'energy', XBRUSD: 'energy', XNGUSD: 'energy',
  US30: 'indices', US500: 'indices', USTEC: 'indices', GER40: 'indices', UK100: 'indices', JPN225: 'indices', FRA40: 'indices',
  EURUSD: 'forex', GBPUSD: 'forex', USDJPY: 'forex', AUDUSD: 'forex', USDCAD: 'forex', USDCHF: 'forex', NZDUSD: 'forex', EURGBP: 'forex', EURJPY: 'forex', GBPJPY: 'forex',
  SOYBEAN: 'agri', WHEAT: 'agri', CORN: 'agri', COFFEE: 'agri', COCOA: 'agri', SUGAR: 'agri', COTTON: 'agri',
};

function getCategory(symbol: string): string {
  return INSTRUMENT_CATEGORIES[symbol] ?? 'other';
}

function formatDuration(entryDate: string): string {
  const ms = Date.now() - new Date(entryDate).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatPrice(price: number): string {
  return price > 100 ? price.toFixed(2) : price.toFixed(5);
}

function timeSinceText(dateStr: string): { text: string; stale: boolean } {
  const ms = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours >= 4) return { text: `hace ${hours}h ${minutes % 60}m`, stale: true };
  if (hours > 0) return { text: `hace ${hours}h ${minutes % 60}m`, stale: false };
  return { text: `hace ${minutes}m`, stale: false };
}

const TAB_OPTIONS: { value: BrokerFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'darwinex', label: 'NKIS' },
  { value: 'octx', label: 'OCTX' },
];

function InlineNotes({ trade }: { trade: Trade }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(trade.duringTradeNotes ?? '');
  const queryClient = useQueryClient();

  const save = useCallback(async () => {
    await supabase.from('trades').update({ during_trade_notes: value || null }).eq('id', trade.id);
    queryClient.invalidateQueries({ queryKey: ['trades'] });
    setEditing(false);
  }, [value, trade.id, queryClient]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          className="w-32 bg-transparent border-b border-primary text-xs text-foreground outline-none font-data"
        />
        <button onClick={save} className="text-success hover:text-success/80"><Check className="w-3 h-3" /></button>
        <button onClick={() => setEditing(false)} className="text-destructive hover:text-destructive/80"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group max-w-[140px] truncate">
      {trade.duringTradeNotes ? (
        <span className="truncate font-data">{trade.duringTradeNotes}</span>
      ) : (
        <span className="italic">Sin notas</span>
      )}
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />
    </button>
  );
}

function PositionsPage() {
  const { openTrades: allOpen, isLoading } = useAllTrades();
  const { data: settings } = useSettings();
  const [tab, setTab] = useState<BrokerFilter>('all');
  const [, setTick] = useState(0);

  // Live duration counter — update every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const openTrades = filterByBroker(allOpen, tab);
  const accountBalance = settings?.balance ?? 10000;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando posiciones...</span>
      </div>
    );
  }

  const totalPnl = openTrades.reduce((s, t) => s + t.netPnl, 0);
  const darwinexPnl = allOpen.filter(t => t.broker === 'darwinex').reduce((s, t) => s + t.netPnl, 0);
  const octxPnl = allOpen.filter(t => t.broker === 'octx').reduce((s, t) => s + t.netPnl, 0);

  // Find most recent updated_at from open trades for sync indicator
  const lastSync = allOpen.length > 0
    ? allOpen.reduce((latest, t) => {
        const d = new Date(t.updatedAt).getTime();
        return d > latest ? d : latest;
      }, 0)
    : null;

  const syncInfo = lastSync ? timeSinceText(new Date(lastSync).toISOString()) : null;

  // Detect correlated positions (same category, multiple open)
  const categoryCounts: Record<string, number> = {};
  openTrades.forEach(t => {
    const cat = getCategory(t.symbol);
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  });
  const correlatedCategories = new Set(
    Object.entries(categoryCounts).filter(([, c]) => c > 1).map(([cat]) => cat)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Posiciones Abiertas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Terminal de posiciones — estilo MT5</p>
        </div>
        {syncInfo && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border ${
            syncInfo.stale
              ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
              : 'border-border bg-card text-muted-foreground'
          }`}>
            {syncInfo.stale ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            <span>Última actualización: {syncInfo.text}</span>
            {syncInfo.stale && <span className="ml-1 font-semibold">— ejecuta SYNC_DARWINEX.bat</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-0.5 rounded-md bg-secondary w-fit">
        {TAB_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTab(opt.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === opt.value
                ? 'bg-primary/20 text-primary border border-primary/40 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Posiciones abiertas</div>
          <div className="text-2xl font-data font-bold text-foreground">{openTrades.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">P&L no realizado</div>
          <div className={`text-2xl font-data font-bold ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(totalPnl)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Brokers activos</div>
          <div className="flex gap-2 mt-1">
            {allOpen.some(t => t.broker === 'darwinex') && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">DARWINEX</span>
            )}
            {allOpen.some(t => t.broker === 'octx') && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">OCTX</span>
            )}
            {allOpen.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </div>
      </div>

      {/* Positions table */}
      {openTrades.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-16 text-center">
          <div className="text-muted-foreground text-sm">
            No hay posiciones abiertas.
          </div>
          <div className="text-muted-foreground/60 text-xs mt-2">
            El EA abrirá posiciones automáticamente cuando se cumplan las condiciones del sistema.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                <TableHead className="text-[10px] uppercase tracking-wider w-[80px]">Broker</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Símbolo</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider w-[60px]">Dir.</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-right w-[60px]">Lote</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-right">Entrada</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-right">SL</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-right">TP</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-right">P&L</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider text-right w-[80px]">Duración</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">ADX</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Mom.</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openTrades.map(trade => {
                const isPositive = trade.netPnl >= 0;
                const bigLoss = trade.netPnl < 0 && Math.abs(trade.netPnl) > accountBalance * 0.05;
                const isCorrelated = correlatedCategories.has(getCategory(trade.symbol));

                return (
                  <TableRow
                    key={trade.id}
                    className={`border-l-3 transition-colors ${
                      bigLoss
                        ? 'border-l-destructive bg-destructive/8 hover:bg-destructive/12'
                        : isPositive
                          ? 'border-l-success hover:bg-success/5'
                          : 'border-l-destructive hover:bg-destructive/5'
                    }`}
                  >
                    {/* Broker */}
                    <TableCell>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        trade.broker === 'darwinex'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {trade.broker === 'darwinex' ? 'DRW' : 'FXP'}
                      </span>
                    </TableCell>

                    {/* Symbol */}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm text-foreground">{trade.symbol}</span>
                        {isCorrelated && (
                          <span title="Posición correlacionada"><AlertTriangle className="w-3 h-3 text-yellow-500" /></span>
                        )}
                      </div>
                    </TableCell>

                    {/* Direction */}
                    <TableCell>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        trade.direction === 'BUY'
                          ? 'bg-success/15 text-success'
                          : 'bg-destructive/15 text-destructive'
                      }`}>
                        {trade.direction}
                      </span>
                    </TableCell>

                    {/* Lot */}
                    <TableCell className="text-right font-data text-xs">{trade.lotSize}</TableCell>

                    {/* Entry price */}
                    <TableCell className="text-right font-data text-xs text-foreground">
                      {formatPrice(trade.entryPrice)}
                    </TableCell>

                    {/* SL */}
                    <TableCell className="text-right font-data text-xs">
                      {trade.slPrice > 0 ? (
                        <span className="text-destructive/70">{formatPrice(trade.slPrice)}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* TP */}
                    <TableCell className="text-right font-data text-xs">
                      {trade.tpPrice > 0 ? (
                        <span className="text-success/70">{formatPrice(trade.tpPrice)}</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* P&L */}
                    <TableCell className="text-right">
                      <span className={`font-data font-bold text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(trade.netPnl)}
                      </span>
                    </TableCell>

                    {/* Duration */}
                    <TableCell className="text-right font-data text-xs text-foreground">
                      {formatDuration(trade.entryDate)}
                    </TableCell>

                    {/* ADX */}
                    <TableCell className="text-xs">
                      {trade.adxValue > 0 ? (
                        <div className="flex flex-col">
                          <span className="font-data text-foreground">{trade.adxValue.toFixed(1)}</span>
                          <span className="text-[10px] text-primary/80">{trade.adxState}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Momentum */}
                    <TableCell className="text-xs">
                      {trade.momentumAligned !== undefined ? (
                        <span className={trade.momentumAligned ? 'text-success' : 'text-yellow-500'}>
                          {trade.momentumAligned ? '✓ Alin.' : '✗ No alin.'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Notes */}
                    <TableCell>
                      <InlineNotes trade={trade} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-secondary/30">
                <TableCell colSpan={7} className="text-xs font-semibold text-muted-foreground">
                  TOTAL
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-data font-bold text-sm ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(totalPnl)}
                  </span>
                </TableCell>
                <TableCell colSpan={4} className="text-xs text-muted-foreground">
                  <div className="flex gap-3">
                    {allOpen.some(t => t.broker === 'darwinex') && (
                      <span>DRW: <span className={`font-data font-semibold ${darwinexPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(darwinexPnl)}</span></span>
                    )}
                    {allOpen.some(t => t.broker === 'octx') && (
                      <span>FXP: <span className={`font-data font-semibold ${octxPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(octxPnl)}</span></span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
