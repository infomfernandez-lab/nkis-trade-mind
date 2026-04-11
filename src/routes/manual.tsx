import { createFileRoute } from '@tanstack/react-router';
import { Shield, Target, Zap, Eye, BarChart3, AlertTriangle, BookOpen } from 'lucide-react';

export const Route = createFileRoute('/manual')({
  component: Manual,
  head: () => ({
    meta: [
      { title: 'Sistema 1 Manual — NKIS Trading Intelligence' },
      { name: 'description', content: 'Complete reference guide for the Sistema 1 trading system.' },
    ],
  }),
});

function Manual() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Sistema 1</h1>
        <p className="text-muted-foreground mt-2">Systematic Trend-Following Trading System — Complete Reference</p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-sm">
        <p className="text-foreground/90 italic font-medium">
          "The scanner finds WHERE. The EA decides WHEN. You decide to FOLLOW."
        </p>
      </div>

      {/* The Scanner */}
      <ManualSection icon={Eye} title="The Scanner (Radar)">
        <p className="text-muted-foreground mb-4">
          The scanner identifies the instruments with the strongest trends across your universe. It runs locally on your PC as a Python script connected to MT5.
        </p>
        <h4 className="text-sm font-semibold text-foreground mb-2">Indicators Analyzed</h4>
        <ul className="space-y-1.5 mb-4">
          <Li>MA50/200 alignment and slope direction</Li>
          <Li>ADX (14) value and slope over 5 bars</Li>
          <Li>Price distance to MA50 (%)</Li>
          <Li>20-day momentum direction</Li>
          <Li>Correlation filter (avoid correlated positions)</Li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground mb-2">Scoring</h4>
        <p className="text-muted-foreground mb-2">
          Each instrument receives a score from 0 to 100 based on a weighted combination of all indicators. Higher scores indicate stronger, cleaner trends.
        </p>
        <Rule>Always trade the top-ranked instrument. Lower ranks mean weaker setups.</Rule>
      </ManualSection>

      {/* The EA */}
      <ManualSection icon={Zap} title="The EA (Entry Executor)">
        <p className="text-muted-foreground mb-4">
          The Expert Advisor handles entry, exit, and trade management. Once activated, do not intervene.
        </p>
        <div className="space-y-3">
          <DetailRow label="Entry Signal" value="Stochastic (5,2,2) crosses 30 upward (BUY) or 70 downward (SELL) at D1 candle close" />
          <DetailRow label="Stop Loss" value="Lowest low of last 10 candles (BUY) / Highest high of last 10 candles (SELL)" />
          <DetailRow label="Take Profit" value="Previous relevant swing high/low — 30 candle lookback" />
          <DetailRow label="Breakeven" value="Activated when price reaches 75% of TP distance" />
          <DetailRow label="Risk" value="1% of account balance per trade" />
          <DetailRow label="Timeframe" value="D1 (Daily)" />
        </div>
      </ManualSection>

      {/* Operating Rules */}
      <ManualSection icon={Shield} title="Operating Rules">
        <div className="space-y-3">
          <Rule critical>Check VIX before anything. If VIX &gt; 45, do NOT trade. Period.</Rule>
          <Rule>VIX 35-45: Reduce position size by 50%.</Rule>
          <Rule>VIX 25-35: Proceed with caution. Only top-ranked instruments.</Rule>
          <Rule>Run the scanner every night after market close.</Rule>
          <Rule>Select the top-ranked instrument from the scanner.</Rule>
          <Rule>Activate the EA on the D1 chart. Do not touch it.</Rule>
          <Rule>Review the dashboard every Friday.</Rule>
          <Rule>Maximum 2 open positions at any time.</Rule>
          <Rule>Never move a stop loss further away. Never.</Rule>
          <Rule>If you doubt the setup, do not enter. There will always be another trade.</Rule>
        </div>
      </ManualSection>

      {/* Philosophy */}
      <ManualSection icon={BookOpen} title="Philosophy">
        <div className="space-y-4 text-muted-foreground">
          <p>
            This system is designed around a simple truth: <span className="text-foreground font-medium">50% win rate + winning more than you lose = profitable system</span>.
          </p>
          <p>
            The scanner ensures you're always positioned in the strongest trend. The EA ensures you enter with discipline and manage risk mechanically. Your only job is to <span className="text-foreground font-medium">not interfere</span>.
          </p>
          <p>
            Every manual intervention is a vote against your own system. The data on the Pattern Intelligence page proves this — interventions cost money.
          </p>
          <p className="text-primary font-medium italic">
            Discipline in execution beats intelligence in analysis.
          </p>
        </div>
      </ManualSection>

      {/* VIX Reference */}
      <ManualSection icon={BarChart3} title="VIX Reference Table">
        <div className="space-y-2">
          <VixRow range="< 25" status="Normal" color="text-success" action="Trade normally. Full position size." />
          <VixRow range="25 — 35" status="Elevated" color="text-yellow-500" action="Caution. Only top-ranked instruments." />
          <VixRow range="35 — 45" status="High" color="text-orange-500" action="Reduce size by 50%. Extra selectivity." />
          <VixRow range="> 45" status="Extreme" color="text-destructive" action="NO TRADING. Wait for conditions to normalize." />
        </div>
      </ManualSection>
    </div>
  );
}

function ManualSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 lg:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </div>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="text-primary mt-1">•</span>
      <span>{children}</span>
    </li>
  );
}

function Rule({ children, critical }: { children: React.ReactNode; critical?: boolean }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-md text-sm ${critical ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary'}`}>
      {critical && <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
      {!critical && <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
      <span className={critical ? 'text-destructive font-medium' : 'text-foreground/80'}>{children}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-2 rounded bg-secondary">
      <span className="text-xs text-primary font-semibold shrink-0 w-28">{label}</span>
      <span className="text-sm text-foreground/80">{value}</span>
    </div>
  );
}

function VixRow({ range, status, color, action }: { range: string; status: string; color: string; action: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md bg-secondary text-sm">
      <span className={`font-data font-bold w-16 ${color}`}>{range}</span>
      <span className={`font-semibold w-20 ${color}`}>{status}</span>
      <span className="text-muted-foreground flex-1">{action}</span>
    </div>
  );
}
