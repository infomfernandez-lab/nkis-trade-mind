import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, Pencil, Check, X } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from '@/components/ui/table';

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

interface Props {
  brokerFilter: BrokerFilter;
}

export function OpenPositionsSection({ brokerFilter }: Props) {
  const { openTrades: allOpen, isLoading } = useAllTrades();
  const { data: settings } = useSettings();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const openTrades = filterByBroker(allOpen, brokerFilter);
  const accountBalance = settings?.balance ?? 10000;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Cargando posiciones...</div>;
  }

  const totalPnl = openTrades.reduce((s, t) => s + t.netPnl, 0);
  const darwinexPnl = allOpen.filter(t => t.broker === 'darwinex').reduce((s, t) => s + t.netPnl, 0);
  const fxproPnl = allOpen.filter(t => t.broker === 'fxpro').reduce((s, t) => s + t.netPnl, 0);

  const lastSync = allOpen.length > 0
    ? allOpen.reduce((latest, t) => {
        const d = new Date(t.updatedAt).getTime();
        return d > latest ? d : latest;
      }, 0)
    : null;
  const syncInfo = lastSync ? timeSinceText(new Date(lastSync).toISOString()) : null;

  const categoryCounts: Record<string, number> = {};
  openTrades.forEach(t => {
    const cat = getCategory(t.symbol);
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  });
  const correlatedCategories = new Set(
    Object.entries(categoryCounts).filter(([, c]) => c > 1).map(([cat]) => cat)
  );

  if (openTrades.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No hay posiciones abiertas</p>
        <p className="text-xs text-muted-foreground/60 mt-1">El EA abrirá posiciones automáticamente cuando se cumplan las condiciones del sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary + sync */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>Posiciones: <span className="font-data font-semibold text-foreground">{openTrades.length}</span></span>
        <span>P&L: <span className={`font-data font-semibold ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(totalPnl)}</span></span>
        {syncInfo && (
          <span className={`flex items-center gap-1 ${syncInfo.stale ? 'text-yellow-400' : ''}`}>
            {syncInfo.stale ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            Sync: {syncInfo.text}
            {syncInfo.stale && <span className="font-semibold ml-1">— ejecuta SYNC</span>}
          </span>
        )}
      </div>

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
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      trade.broker === 'darwinex' ? 'bg-primary/15 text-primary' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {trade.broker === 'darwinex' ? 'DRW' : 'FXP'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm text-foreground">{trade.symbol}</span>
                      {isCorrelated && <span title="Correlacionada"><AlertTriangle className="w-3 h-3 text-yellow-500" /></span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      trade.direction === 'BUY' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    }`}>
                      {trade.direction}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-data text-xs">{trade.lotSize}</TableCell>
                  <TableCell className="text-right font-data text-xs text-foreground">{formatPrice(trade.entryPrice)}</TableCell>
                  <TableCell className="text-right font-data text-xs">
                    {trade.slPrice > 0 ? <span className="text-destructive/70">{formatPrice(trade.slPrice)}</span> : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-data text-xs">
                    {trade.tpPrice > 0 ? <span className="text-success/70">{formatPrice(trade.tpPrice)}</span> : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-data font-bold text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(trade.netPnl)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-data text-xs text-foreground">{formatDuration(trade.entryDate)}</TableCell>
                  <TableCell><InlineNotes trade={trade} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-secondary/30">
              <TableCell colSpan={7} className="text-xs font-semibold text-muted-foreground">TOTAL</TableCell>
              <TableCell className="text-right">
                <span className={`font-data font-bold text-sm ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totalPnl)}
                </span>
              </TableCell>
              <TableCell colSpan={2} className="text-xs text-muted-foreground">
                <div className="flex gap-3">
                  {allOpen.some(t => t.broker === 'darwinex') && (
                    <span>DRW: <span className={`font-data font-semibold ${darwinexPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(darwinexPnl)}</span></span>
                  )}
                  {allOpen.some(t => t.broker === 'fxpro') && (
                    <span>FXP: <span className={`font-data font-semibold ${fxproPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(fxproPnl)}</span></span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
