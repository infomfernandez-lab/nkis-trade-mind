import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, BookCheck, Circle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClosedTrades } from '@/hooks/use-trades';
import { filterByBroker, type Trade } from '@/lib/trade-utils';
import { detectCloseType, computeRR, hasJournal, lookupScannerRank } from '@/lib/trade-derived';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { TradeJournal } from '@/components/TradeJournal';
import { supabase } from '@/integrations/supabase/client';
import { classifyInstrument } from '@/lib/instrument-classify';

export const Route = createFileRoute('/trades')({
  component: TradeLog,
  head: () => ({
    meta: [
      { title: 'Registro de Trades — CAP Trading' },
      { name: 'description', content: 'Historial completo de trades con análisis psicológico.' },
    ],
  }),
});

function formatEur(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}€${Math.abs(value).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShortDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function useScannerSessions() {
  return useQuery({
    queryKey: ['scanner_sessions', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('session_date, broker, top_instruments')
        .order('session_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function TradeLog() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { broker } = useBrokerFilter();
  const { data: closedTrades, isLoading, error } = useClosedTrades();
  const { data: scannerSessions } = useScannerSessions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando trades...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">Error al cargar trades: {error.message}</p>
      </div>
    );
  }

  const filtered = filterByBroker(closedTrades ?? [], broker);
  // Reverse so newest is first; numbering is based on chronological order (oldest = 1)
  const ordered = [...filtered];
  const numbered = ordered.map((t, i) => ({ trade: t, num: i + 1 }));
  const display = [...numbered].reverse();

  if ((closedTrades ?? []).length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Registro de Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">Aún no hay trades cerrados</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm">Tu historial de trades aparecerá aquí cuando tu script de sincronización MT5 envíe datos.</p>
          <p className="text-xs text-muted-foreground mt-2">Configura el script en Ajustes → Clave API de Sincronización MT5</p>
        </div>
      </div>
    );
  }

  const brokerLabel = broker === 'all' ? '' : ` — ${broker === 'darwinex' ? 'NK' : 'OX'}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Registro de Trades{brokerLabel}</h1>
        <p className="text-base text-muted-foreground mt-1">{display.length} trades cerrados — click en una fila para ver el detalle</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Ticker</th>
              <th className="px-3 py-3">Nombre</th>
              <th className="px-3 py-3">Dir</th>
              <th className="px-3 py-3">Cuenta</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3 text-right">Entrada</th>
              <th className="px-3 py-3 text-right">Salida</th>
              <th className="px-3 py-3 text-right">SL</th>
              <th className="px-3 py-3 text-right">TP</th>
              <th className="px-3 py-3 text-right">Lotes</th>
              <th className="px-3 py-3 text-right">Duración</th>
              <th className="px-3 py-3 text-right">P&L</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {display.map(({ trade, num }) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                num={num}
                scannerSessions={scannerSessions ?? []}
                expanded={expandedId === trade.id}
                onToggle={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
              />
            ))}
            {display.length === 0 && (
              <tr><td colSpan={14} className="p-12 text-center text-muted-foreground text-sm">No hay trades de {broker === 'darwinex' ? 'NK' : 'OX'}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface TradeRowProps {
  trade: Trade;
  num: number;
  scannerSessions: any[];
  expanded: boolean;
  onToggle: () => void;
}

function TradeRow({ trade, num, scannerSessions, expanded, onToggle }: TradeRowProps) {
  const queryClient = useQueryClient();
  const close = detectCloseType(trade);
  const rr = computeRR(trade);
  const journalDone = hasJournal(trade);
  const scanner = lookupScannerRank(trade, scannerSessions);
  const fullName = classifyInstrument(trade.symbol).description;

  const rowBg = trade.netPnl >= 0
    ? 'bg-success/15 hover:bg-success/25'
    : 'bg-destructive/15 hover:bg-destructive/25';

  const brokerLabel = trade.broker === 'darwinex' ? 'NK' : trade.broker === 'octx' ? 'OX' : trade.broker;
  const pnlColor = trade.netPnl >= 0 ? 'text-success' : 'text-destructive';
  const dirBg = trade.direction === 'BUY' ? 'bg-success/30 text-success' : 'bg-destructive/30 text-destructive';

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-border cursor-pointer transition-colors ${rowBg}`}
      >
        <td className="px-3 py-3 font-data text-muted-foreground">{num}</td>
        <td className="px-3 py-3 font-semibold">{trade.symbol}</td>
        <td className="px-3 py-3 text-muted-foreground">{fullName}</td>
        <td className="px-3 py-3">
          <span className={`px-2 py-0.5 rounded text-sm font-data font-bold ${dirBg}`}>{trade.direction}</span>
        </td>
        <td className="px-3 py-3 font-data">{brokerLabel}</td>
        <td className="px-3 py-3 font-data">{formatShortDate(trade.entryDate)}</td>
        <td className="px-3 py-3 font-data text-right">{trade.entryPrice}</td>
        <td className="px-3 py-3 font-data text-right">{trade.exitPrice ?? '—'}</td>
        <td className="px-3 py-3 font-data text-right">{trade.slPrice}</td>
        <td className="px-3 py-3 font-data text-right">{trade.tpPrice}</td>
        <td className="px-3 py-3 font-data text-right">{trade.lotSize}</td>
        <td className="px-3 py-3 font-data text-right">{trade.durationHours}h</td>
        <td className={`px-3 py-3 font-data font-bold text-right ${pnlColor}`}>{formatEur(trade.netPnl)}</td>
        <td className="px-3 py-3 text-right">
          <div className="inline-flex items-center gap-2">
            {journalDone ? (
              <BookCheck className="w-4 h-4 text-primary" aria-label="Bitácora rellenada" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground/50" aria-label="Bitácora vacía" />
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={14} className="border-b border-border bg-card p-4 lg:p-6">
            <div className="space-y-6 text-sm">
              <Section title="Datos del Trade">
                <Grid>
                  <Field label="Ticket" value={`#${trade.ticket}`} />
                  <Field label="Broker" value={brokerLabel} />
                  <Field label="Precio Entrada" value={String(trade.entryPrice)} mono />
                  <Field label="Precio Salida" value={String(trade.exitPrice ?? '—')} mono />
                  <Field label="SL" value={String(trade.slPrice)} mono />
                  <Field label="TP" value={String(trade.tpPrice)} mono />
                  <Field label="Lotaje" value={String(trade.lotSize)} mono />
                  <Field label="P&L Bruto" value={formatEur(trade.grossPnl)} pnl={trade.grossPnl} />
                  <Field label="Comisión" value={`€${trade.commission}`} />
                  <Field label="Swap" value={`€${trade.swap}`} />
                  <Field label="P&L Neto" value={formatEur(trade.netPnl)} pnl={trade.netPnl} />
                  <Field label="Duración" value={`${trade.durationHours}h`} />
                  <Field label="RR Real" value={rr != null ? rr.toFixed(2) : '—'} mono />
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Tipo de Cierre</div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-data font-bold ${close.bg} ${close.color}`}>
                      {close.label}
                    </span>
                  </div>
                </Grid>
              </Section>

              <Section title="Indicadores al Momento de Entrada">
                <Grid>
                  <Field label="ADX" value={`${trade.adxValue} (${trade.adxState})`} mono />
                  <Field label="Dist. a MA50" value={`${trade.distanceToMA50}% (${trade.distanceToMA50Label})`} mono />
                  <Field label="Momentum 20d" value={`${trade.momentum20d}% ${trade.momentumAligned ? '✓ Alineado' : '✗ No alineado'}`} mono />
                  <Field label="Stochastic K" value={String(trade.stochasticK)} mono />
                  <Field
                    label="Ranking Scanner"
                    value={
                      scanner.rank != null
                        ? `#${scanner.rank} de ${scanner.total} — Score: ${scanner.score ?? '—'}`
                        : 'No estaba en el radar'
                    }
                  />
                  <Field label="VIX al Entrar" value={trade.vixAtEntry != null ? `VIX: ${trade.vixAtEntry}` : 'VIX: —'} />
                </Grid>
              </Section>

              <TradeJournal
                trade={trade}
                scannerInfo={scanner}
                vixValue={trade.vixAtEntry}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ['trades'] })}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>;
}

function Field({ label, value, mono, pnl }: { label: string; value: string; mono?: boolean; pnl?: number }) {
  const color = pnl !== undefined ? (pnl >= 0 ? 'text-success' : 'text-destructive') : 'text-foreground';
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-medium ${mono ? 'font-data' : ''} ${color}`}>{value}</div>
    </div>
  );
}
