import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { SymbolMeta } from './EnTendenciaBlock';
import { TypeFilter } from './TypeFilter';
import { classifyInstrument, type InstrumentType } from '@/lib/instrument-classify';

interface Props {
  brokerFilter: BrokerFilter;
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

export function OpenPositionsTable({ brokerFilter }: Props) {
  const { openTrades, isLoading } = useAllTrades();
  const filteredAll = filterByBroker(openTrades, brokerFilter);
  const [typeFilter, setTypeFilter] = useState<Set<InstrumentType>>(new Set());

  const counts = useMemo(() => {
    const c: Partial<Record<InstrumentType, number>> = {};
    for (const t of filteredAll) {
      const tp = classifyInstrument(t.symbol).type;
      c[tp] = (c[tp] ?? 0) + 1;
    }
    return c;
  }, [filteredAll]);

  const filtered = typeFilter.size === 0
    ? filteredAll
    : filteredAll.filter(t => typeFilter.has(classifyInstrument(t.symbol).type));

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground">{filtered.length} de {filteredAll.length} posiciones</span>
        <TypeFilter selected={typeFilter} onChange={setTypeFilter} availableCounts={counts} />
      </div>
      {dwTrades.length > 0 && <BrokerSubsection broker="darwinex" trades={dwTrades} />}
      {fxTrades.length > 0 && <BrokerSubsection broker="octx" trades={fxTrades} />}
      <p className="text-[11px] italic text-muted-foreground/70 leading-snug px-1">
        Las posiciones abiertas solo las cierra el SL. El scanner no tiene autoridad sobre trades ya abiertos.
      </p>
    </div>
  );
}

function BrokerSubsection({ broker, trades }: { broker: 'darwinex' | 'octx'; trades: Trade[] }) {
  const total = trades.reduce((s, t) => s + t.netPnl, 0);
  const headerColor = broker === 'darwinex'
    ? 'bg-blue-950 text-blue-300 border-blue-800'
    : 'bg-orange-900/40 text-orange-300 border-orange-700/50';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${headerColor}`}>
          {broker === 'darwinex' ? 'NKIS' : 'OCTX'}
        </span>
        <span className="text-xs text-muted-foreground">{trades.length} pos</span>
      </div>

      {/* Desktop */}
      <table className="w-full hidden md:table text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/20">
            <th className="text-left px-3 py-2">Símbolo</th>
            <th className="text-left px-2 py-2 w-[70px]">Dir</th>
            <th className="text-left px-2 py-2 w-[110px]">Apertura</th>
            <th className="text-right px-2 py-2 w-[100px]">Entrada</th>
            <th className="text-right px-2 py-2 w-[100px]">SL</th>
            <th className="text-right px-2 py-2 w-[100px]">TP</th>
            <th className="text-right px-2 py-2 w-[100px]">P&L</th>
            <th className="text-left px-2 py-2 w-[180px]">Estado</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(t => (
            <tr key={t.id} className="border-t border-border hover:bg-accent/20 transition-colors">
              <td className="px-3 py-2 font-bold">
                <div className="flex flex-col gap-0.5">
                  <span>{t.symbol}</span>
                  <SymbolMeta symbol={t.symbol} />
                </div>
              </td>
              <td className="px-2 py-2">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  t.direction === 'BUY' ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
                }`}>
                  {t.direction === 'BUY' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {t.direction}
                </span>
              </td>
              <td className="px-2 py-2 text-xs text-muted-foreground font-data">{new Date(t.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</td>
              <td className="px-2 py-2 text-right font-data text-xs">{formatPrice(t.entryPrice)}</td>
              <td className="px-2 py-2 text-right font-data text-xs text-destructive/80">{formatPrice(t.slPrice)}</td>
              <td className="px-2 py-2 text-right font-data text-xs text-success/80">{formatPrice(t.tpPrice)}</td>
              <td className={`px-2 py-2 text-right font-data font-bold ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(t.netPnl)}
              </td>
              <td className="px-2 py-2 text-xs text-muted-foreground">{tradeStatus(t)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-secondary/30">
            <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right">Total {broker === 'darwinex' ? 'NKIS' : 'OCTX'}</td>
            <td className={`px-2 py-2 text-right font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-border">
        {trades.map(t => <MobileRow key={t.id} trade={t} />)}
        <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 text-xs">
          <span className="text-muted-foreground font-semibold">Total {broker === 'darwinex' ? 'NKIS' : 'OCTX'}</span>
          <span className={`font-data font-bold ${total >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

function MobileRow({ trade: t }: { trade: Trade }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2">
        <span className="font-bold text-sm">{t.symbol}</span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          t.direction === 'BUY' ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {t.direction === 'BUY' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {t.direction}
        </span>
        <span className={`ml-auto font-data font-bold text-sm ${t.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(t.netPnl)}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className="text-[11px] text-muted-foreground mt-0.5">{tradeStatus(t)}</div>
      <div className="mt-1"><SymbolMeta symbol={t.symbol} compact /></div>
      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div><div className="text-muted-foreground">Apertura</div><div className="font-data text-foreground">{new Date(t.entryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</div></div>
          <div><div className="text-muted-foreground">Entrada</div><div className="font-data text-foreground">{formatPrice(t.entryPrice)}</div></div>
          <div><div className="text-muted-foreground">Lote</div><div className="font-data text-foreground">{t.lotSize}</div></div>
          <div><div className="text-muted-foreground">SL</div><div className="font-data text-destructive/80">{formatPrice(t.slPrice)}</div></div>
          <div><div className="text-muted-foreground">TP</div><div className="font-data text-success/80">{formatPrice(t.tpPrice)}</div></div>
        </div>
      )}
    </div>
  );
}
