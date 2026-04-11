import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { closedTrades, formatCurrency, formatDate, getTradeColorStrip, type Trade } from '@/lib/mock-data';

export const Route = createFileRoute('/trades')({
  component: TradeLog,
  head: () => ({
    meta: [
      { title: 'Trade Log — NKIS Trading Intelligence' },
      { name: 'description', content: 'Complete trade history with psychological analysis.' },
    ],
  }),
});

function TradeLog() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const trades = [...closedTrades].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Trade Log</h1>
        <p className="text-sm text-muted-foreground mt-1">{trades.length} closed trades — expand for full detail</p>
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
      </div>
    </div>
  );
}

function TradeCard({ trade, expanded, onToggle }: { trade: Trade; expanded: boolean; onToggle: () => void }) {
  const strip = getTradeColorStrip(trade);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden card-hover">
      {/* Color strip */}
      <div className={`h-1 ${strip}`} />

      {/* Collapsed view */}
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/20 transition-colors">
        <div className="flex items-center gap-4">
          <div className={`px-2 py-0.5 rounded text-xs font-data font-bold ${trade.direction === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {trade.direction}
          </div>
          <div className="font-semibold text-sm">{trade.symbol}</div>
          <div className="text-xs text-muted-foreground font-data">{formatDate(trade.entryDate)}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`font-data font-bold text-sm ${trade.netPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(trade.netPnl)}
          </div>
          <div className="text-xs text-muted-foreground font-data">{trade.durationHours}h</div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded view */}
      {expanded && (
        <div className="border-t border-border p-4 lg:p-6 space-y-6 text-sm">
          {/* Trade Data */}
          <Section title="Trade Data">
            <Grid>
              <Field label="Ticket" value={`#${trade.ticket}`} />
              <Field label="Entry Price" value={String(trade.entryPrice)} mono />
              <Field label="Exit Price" value={String(trade.exitPrice)} mono />
              <Field label="SL" value={String(trade.slPrice)} mono />
              <Field label="TP" value={String(trade.tpPrice)} mono />
              <Field label="Lot Size" value={String(trade.lotSize)} mono />
              <Field label="Gross P&L" value={formatCurrency(trade.grossPnl)} pnl={trade.grossPnl} />
              <Field label="Commission" value={`$${trade.commission}`} />
              <Field label="Swap" value={`$${trade.swap}`} />
              <Field label="Net P&L" value={formatCurrency(trade.netPnl)} pnl={trade.netPnl} />
              <Field label="Duration" value={`${trade.durationHours}h`} />
              <Field label="How Closed" value={trade.howClosed || '—'} />
            </Grid>
          </Section>

          {/* Indicator Snapshot */}
          <Section title="Indicator Snapshot at Entry">
            <Grid>
              <Field label="ADX" value={`${trade.adxValue} (${trade.adxState})`} mono />
              <Field label="Dist. to MA50" value={`${trade.distanceToMA50}% (${trade.distanceToMA50Label})`} mono />
              <Field label="20d Momentum" value={`${trade.momentum20d}% ${trade.momentumAligned ? '✓ Aligned' : '✗ Not aligned'}`} mono />
              <Field label="Stochastic K" value={String(trade.stochasticK)} mono />
              <Field label="Scanner Rank" value={trade.scannerRank ? `#${trade.scannerRank}` : '—'} />
              <Field label="VIX at Entry" value={trade.vixAtEntry ? String(trade.vixAtEntry) : '—'} />
            </Grid>
          </Section>

          {/* Psychological Layer */}
          <Section title="Before Entry">
            <Grid>
              <Field label="Emotional State" value={trade.emotionalState || '—'} />
              <Field label="Reason for Entry" value={trade.reasonForEntry || '—'} />
              <Field label="System Compliance" value={trade.systemCompliance || '—'} />
              <Field label="Doubts" value={trade.setupDoubts || '—'} />
            </Grid>
            {trade.preTradeNotes && <NoteBlock text={trade.preTradeNotes} />}
          </Section>

          <Section title="During Trade">
            <Grid>
              <Field label="Managing Wait" value={trade.managingWait || '—'} />
              <Field label="Manual Intervention" value={trade.manualIntervention || '—'} />
            </Grid>
            {trade.duringTradeNotes && <NoteBlock text={trade.duringTradeNotes} />}
          </Section>

          <Section title="After Close">
            <Grid>
              <Field label="Feeling" value={trade.feelingResult || '—'} />
              <Field label="What I'd Do Differently" value={trade.whatDoDifferently || '—'} />
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
