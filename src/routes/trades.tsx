import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useClosedTrades } from '@/hooks/use-trades';
import { formatCurrency, formatDate, getTradeColorStrip, filterByBroker, type Trade, type BrokerFilter } from '@/lib/trade-utils';
import { BrokerSelector } from '@/components/BrokerSelector';

export const Route = createFileRoute('/trades')({
  component: TradeLog,
  head: () => ({
    meta: [
      { title: 'Registro de Trades — CAP Trading' },
      { name: 'description', content: 'Historial completo de trades con análisis psicológico.' },
    ],
  }),
});

function TradeLog() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [broker, setBroker] = useState<BrokerFilter>('all');
  const { data: closedTrades, isLoading, error } = useClosedTrades();

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
  const trades = [...filtered].reverse();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Registro de Trades</h1>
          <p className="text-sm text-muted-foreground mt-1">{trades.length} trades cerrados — expande para ver el detalle</p>
        </div>
        <BrokerSelector value={broker} onChange={setBroker} />
      </div>

      <div className="space-y-3">
        {trades.map(trade => (
          <TradeCard
            key={trade.id}
            trade={trade}
            expanded={expandedId === trade.id}
            onToggle={() => setExpandedId(expandedId === trade.id ? null : trade.id)}
          />
        ))}
        {trades.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground text-sm">No hay trades de {broker === 'darwinex' ? 'Darwinex' : 'FXPro'}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeCard({ trade, expanded, onToggle }: { trade: Trade; expanded: boolean; onToggle: () => void }) {
  const strip = getTradeColorStrip(trade);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden card-hover">
      <div className={`h-1 ${strip}`} />
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/20 transition-colors">
        <div className="flex items-center gap-4">
          <div className={`px-2 py-0.5 rounded text-xs font-data font-bold ${trade.direction === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {trade.direction}
          </div>
          <div className="font-semibold text-sm">{trade.symbol}</div>
          <div className="text-xs text-muted-foreground font-data">{formatDate(trade.entryDate)}</div>
          <div className="text-xs text-muted-foreground capitalize">{trade.broker}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`font-data font-bold text-sm ${trade.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(trade.netPnl)}
          </div>
          <div className="text-xs text-muted-foreground font-data">{trade.durationHours}h</div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 lg:p-6 space-y-6 text-sm">
          <Section title="Datos del Trade">
            <Grid>
              <Field label="Ticket" value={`#${trade.ticket}`} />
              <Field label="Broker" value={trade.broker} />
              <Field label="Precio Entrada" value={String(trade.entryPrice)} mono />
              <Field label="Precio Salida" value={String(trade.exitPrice)} mono />
              <Field label="SL" value={String(trade.slPrice)} mono />
              <Field label="TP" value={String(trade.tpPrice)} mono />
              <Field label="Lotaje" value={String(trade.lotSize)} mono />
              <Field label="P&L Bruto" value={formatCurrency(trade.grossPnl)} pnl={trade.grossPnl} />
              <Field label="Comisión" value={`$${trade.commission}`} />
              <Field label="Swap" value={`$${trade.swap}`} />
              <Field label="P&L Neto" value={formatCurrency(trade.netPnl)} pnl={trade.netPnl} />
              <Field label="Duración" value={`${trade.durationHours}h`} />
              <Field label="Tipo de Cierre" value={trade.howClosed || '—'} />
            </Grid>
          </Section>

          <Section title="Indicadores al Momento de Entrada">
            <Grid>
              <Field label="ADX" value={`${trade.adxValue} (${trade.adxState})`} mono />
              <Field label="Dist. a MA50" value={`${trade.distanceToMA50}% (${trade.distanceToMA50Label})`} mono />
              <Field label="Momentum 20d" value={`${trade.momentum20d}% ${trade.momentumAligned ? '✓ Alineado' : '✗ No alineado'}`} mono />
              <Field label="Stochastic K" value={String(trade.stochasticK)} mono />
              <Field label="Ranking Scanner" value={trade.scannerRank ? `#${trade.scannerRank}` : '—'} />
              <Field label="VIX al Entrar" value={trade.vixAtEntry ? String(trade.vixAtEntry) : '—'} />
            </Grid>
          </Section>

          <Section title="Antes de Entrar">
            <Grid>
              <Field label="Estado Emocional" value={trade.emotionalState || '—'} />
              <Field label="Razón de Entrada" value={trade.reasonForEntry || '—'} />
              <Field label="Cumplimiento del Sistema" value={trade.systemCompliance || '—'} />
              <Field label="Dudas" value={trade.setupDoubts || '—'} />
            </Grid>
            {trade.preTradeNotes && <NoteBlock text={trade.preTradeNotes} />}
          </Section>

          <Section title="Durante el Trade">
            <Grid>
              <Field label="Gestión de la Espera" value={trade.managingWait || '—'} />
              <Field label="Intervención Manual" value={trade.manualIntervention || '—'} />
            </Grid>
            {trade.duringTradeNotes && <NoteBlock text={trade.duringTradeNotes} />}
          </Section>

          <Section title="Después del Cierre">
            <Grid>
              <Field label="Sensación" value={trade.feelingResult || '—'} />
              <Field label="Qué Haría Diferente" value={trade.whatDoDifferently || '—'} />
            </Grid>
            {trade.postTradeNotes && <NoteBlock text={trade.postTradeNotes} />}
          </Section>
        </div>
      )}
    </div>
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

function NoteBlock({ text }: { text: string }) {
  return (
    <div className="mt-3 p-3 rounded-md bg-secondary border border-border text-sm text-foreground/80 italic">
      {text}
    </div>
  );
}
