import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, Clock, Check, BookOpen, ShieldCheck, TrendingUp as TUp, X } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { useSettings } from '@/hooks/use-settings';
import { formatCurrency, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

function formatDuration(entryDate: string): string {
  const ms = Date.now() - new Date(entryDate).getTime();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function daysOpen(entryDate: string): number {
  return Math.floor((Date.now() - new Date(entryDate).getTime()) / 86_400_000);
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

interface Props {
  brokerFilter: BrokerFilter;
}

interface TradeWithSL extends Trade {
  slPhase?: string;
  atrAtEntry?: number | null;
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

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Cargando posiciones...</div>;
  }

  const totalPnl = openTrades.reduce((s, t) => s + t.netPnl, 0);

  const lastSync = allOpen.length > 0
    ? allOpen.reduce((latest, t) => {
        const d = new Date(t.updatedAt).getTime();
        return d > latest ? d : latest;
      }, 0)
    : null;
  const syncInfo = lastSync ? timeSinceText(new Date(lastSync).toISOString()) : null;

  if (openTrades.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No hay posiciones abiertas</p>
        <p className="text-xs text-muted-foreground/60 mt-1">El EA abrirá posiciones automáticamente cuando se cumplan las condiciones del sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>Posiciones: <span className="font-data font-semibold text-foreground">{openTrades.length}</span></span>
        <span>P&L total: <span className={`font-data font-semibold ${totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(totalPnl)}</span></span>
        {syncInfo && (
          <span className={`flex items-center gap-1 ${syncInfo.stale ? 'text-yellow-400' : ''}`}>
            {syncInfo.stale ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            Sync: {syncInfo.text}
            {syncInfo.stale && <span className="font-semibold ml-1">— ejecuta SYNC</span>}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {openTrades.map(trade => (
          <PositionCard key={trade.id} trade={trade as TradeWithSL} balance={settings?.balance ?? 10000} />
        ))}
      </div>
    </div>
  );
}

function PositionCard({ trade, balance }: { trade: TradeWithSL; balance: number }) {
  const isPositive = trade.netPnl >= 0;
  const bigLoss = trade.netPnl < 0 && Math.abs(trade.netPnl) > balance * 0.05;
  const pnlPct = balance > 0 ? (trade.netPnl / balance) * 100 : 0;
  const broker = trade.broker;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${
      bigLoss ? 'border-destructive/40' : isPositive ? 'border-success/30' : 'border-border'
    }`}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
        {/* LEFT — position data */}
        <div className="p-4 lg:p-5 space-y-3 border-b lg:border-b-0 lg:border-r border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-xl text-foreground">{trade.symbol}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              trade.direction === 'BUY' ? 'bg-success/20 text-success border border-success/40' : 'bg-destructive/20 text-destructive border border-destructive/40'
            }`}>{trade.direction}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
            }`}>
              {broker === 'darwinex' ? 'NKIS' : 'OCTX'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Entrada</div>
              <div className="font-data text-sm text-foreground">{formatPrice(trade.entryPrice)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Días abierto</div>
              <div className="font-data text-sm text-foreground">{daysOpen(trade.entryDate)}d</div>
            </div>
            <div>
              <div className="text-muted-foreground">SL actual</div>
              <div className="font-data text-sm text-destructive/80">
                {trade.slPrice > 0 ? formatPrice(trade.slPrice) : '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">ATR entrada</div>
              <div className="font-data text-sm text-foreground">
                {trade.atrAtEntry != null ? Number(trade.atrAtEntry).toFixed(5) : '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Lote</div>
              <div className="font-data text-sm text-foreground">{trade.lotSize}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Duración</div>
              <div className="font-data text-sm text-foreground">{formatDuration(trade.entryDate)}</div>
            </div>
          </div>

          <div className={`mt-2 p-3 rounded-md border ${isPositive ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <div className="text-xs text-muted-foreground mb-0.5">P&L actual</div>
            <div className="flex items-end gap-2">
              <span className={`font-data font-bold text-2xl ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(trade.netPnl)}
              </span>
              <span className={`text-xs font-data mb-1 ${isPositive ? 'text-success' : 'text-destructive'}`}>
                ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — SL management */}
        <div className="p-4 lg:p-5">
          <SLManagement trade={trade} />
          <div className="mt-4">
            <Link
              to="/trades"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Abrir Bitácora
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SLManagement({ trade }: { trade: TradeWithSL }) {
  const queryClient = useQueryClient();
  const phase = trade.slPhase ?? 'inicial';
  const [editing, setEditing] = useState(false);
  const [slValue, setSlValue] = useState(String(trade.slPrice ?? ''));

  const updatePhase = useCallback(async (newPhase: string, extra?: Record<string, unknown>) => {
    const update = { sl_phase: newPhase, sl_updated_at: new Date().toISOString(), ...(extra ?? {}) };
    const { error } = await supabase.from('trades').update(update as never).eq('id', trade.id);
    if (error) {
      toast.error('Error al actualizar fase SL');
      return;
    }
    toast.success(`Fase actualizada: ${newPhase}`);
    queryClient.invalidateQueries({ queryKey: ['trades'] });
  }, [trade.id, queryClient]);

  const saveSL = useCallback(async () => {
    const parsed = Number(slValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('SL inválido');
      return;
    }
    const { error } = await supabase.from('trades').update({
      sl_price: parsed,
      sl_phase: 'trailing',
      sl_updated_at: new Date().toISOString(),
    }).eq('id', trade.id);
    if (error) {
      toast.error('Error al actualizar SL');
      return;
    }
    toast.success('SL actualizado');
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ['trades'] });
  }, [slValue, trade.id, queryClient]);

  const phaseDone = (p: string) => {
    if (phase === 'cerrada') return true;
    if (p === 'breakeven') return phase === 'breakeven' || phase === 'trailing';
    if (p === 'trailing') return phase === 'trailing';
    return false;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Gestión SL — Revisión de hoy</h3>
      </div>

      {/* Fase 1 */}
      <PhaseRow
        n={1}
        title="BREAKEVEN"
        active={phase === 'inicial'}
        done={phaseDone('breakeven')}
        info={
          <>
            <div>Activar cuando precio ≥ entrada + ATR×1.0</div>
            <div className="text-muted-foreground">Nuevo SL → entrada + ATR×0.2</div>
          </>
        }
        action={phase === 'inicial' ? (
          <button
            onClick={() => updatePhase('breakeven')}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/25 transition-colors"
          >
            Marcar activado
          </button>
        ) : null}
      />

      {/* Fase 2 */}
      <PhaseRow
        n={2}
        title="TRAILING ACTIVO"
        active={phase === 'breakeven' || phase === 'trailing'}
        done={phaseDone('trailing')}
        info={
          <>
            <div>SL = Precio actual − ATR×3.0 (BUY)</div>
            {(phase === 'breakeven' || phase === 'trailing') && (
              editing ? (
                <div className="flex items-center gap-1 mt-1.5">
                  <input
                    autoFocus
                    type="number"
                    step="any"
                    value={slValue}
                    onChange={e => setSlValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveSL(); if (e.key === 'Escape') setEditing(false); }}
                    className="w-28 bg-input border border-border rounded px-2 py-1 text-xs text-foreground font-data outline-none focus:border-primary"
                    placeholder="Nuevo SL"
                  />
                  <button onClick={saveSL} className="text-success hover:text-success/80"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditing(false)} className="text-destructive hover:text-destructive/80"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-muted-foreground">SL hoy:</span>
                  <span className="font-data text-foreground">{trade.slPrice > 0 ? formatPrice(trade.slPrice) : '—'}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25 transition-colors"
                  >
                    Actualizar SL
                  </button>
                </div>
              )
            )}
          </>
        }
        action={null}
      />

      {/* Fase 3 */}
      <PhaseRow
        n={3}
        title="CERRADA"
        active={phase === 'trailing' || phase === 'breakeven'}
        done={phase === 'cerrada'}
        info={<div className="text-muted-foreground">Salida confirmada por SL o cierre manual</div>}
        action={phase !== 'cerrada' ? (
          <Link
            to="/trades"
            onClick={() => updatePhase('cerrada')}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/40 hover:bg-destructive/25 transition-colors"
          >
            Marcar cerrada
          </Link>
        ) : null}
      />
    </div>
  );
}

function PhaseRow({ n, title, active, done, info, action }: {
  n: number;
  title: string;
  active: boolean;
  done: boolean;
  info: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border p-2.5 transition-colors ${
      done ? 'border-success/30 bg-success/[0.04]' : active ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-card'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
            done ? 'bg-success border-success' : active ? 'border-primary' : 'border-muted-foreground/30'
          }`}>
            {done && <Check className="w-3 h-3 text-background" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-muted-foreground">FASE {n}</span>
              <span className={`text-xs font-bold ${done ? 'text-success' : active ? 'text-primary' : 'text-muted-foreground'}`}>{title}</span>
              {n === 2 && active && <TUp className="w-3 h-3 text-primary animate-pulse" />}
            </div>
            <div className="text-[11px] mt-0.5 space-y-0.5">{info}</div>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
