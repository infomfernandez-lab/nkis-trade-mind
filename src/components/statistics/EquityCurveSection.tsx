import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
  CartesianGrid, Area, ComposedChart, Legend,
} from 'recharts';
import type { Trade } from '@/lib/trade-utils';

const NAVY = '#1E3A5F';
const GOLD = '#D4A017';
const GRAY = '#94a3b8';
const RED = '#f87171';

const INITIAL_NKIS = 953000;
const INITIAL_OCTX = 100000;

interface Props {
  closedTrades: Trade[];
}

interface Point {
  date: string;
  nk: number | null;
  ox: number | null;
  total: number;
  dd: number;
}

function isOctx(t: Trade) {
  return t.broker === 'octx' || t.broker === 'fxpro';
}

export function EquityCurveSection({ closedTrades }: Props) {
  const { points, currentBalance, peak, currentDdPct, maxDdPct } = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => {
      const da = new Date(a.exitDate ?? a.entryDate).getTime();
      const db = new Date(b.exitDate ?? b.entryDate).getTime();
      return da - db;
    });

    let nk = INITIAL_NKIS;
    let ox = INITIAL_OCTX;
    const points: Point[] = [];

    // initial point
    const firstDate = sorted.length > 0
      ? (sorted[0].exitDate ?? sorted[0].entryDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    points.push({ date: firstDate, nk, ox, total: nk + ox, dd: 0 });

    let peak = nk + ox;
    let maxDdPct = 0;

    for (const t of sorted) {
      if (isOctx(t)) ox += t.netPnl;
      else nk += t.netPnl;
      const total = nk + ox;
      if (total > peak) peak = total;
      const ddPct = peak > 0 ? ((peak - total) / peak) * 100 : 0;
      if (ddPct > maxDdPct) maxDdPct = ddPct;
      const d = (t.exitDate ?? t.entryDate).slice(0, 10);
      points.push({ date: d, nk, ox, total, dd: peak - total });
    }

    const currentBalance = nk + ox;
    const currentDdPct = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;

    return { points, currentBalance, peak, currentDdPct, maxDdPct };
  }, [closedTrades]);

  const fmtUsd = (v: number) =>
    `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <h2 className="font-display text-base font-semibold mb-4" style={{ color: GOLD }}>
        Curva de Equity
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Balance actual" value={fmtUsd(currentBalance)} />
        <Stat label="Pico histórico" value={fmtUsd(peak)} />
        <Stat label="Drawdown actual" value={`${currentDdPct.toFixed(2)}%`} tone={currentDdPct > 0 ? 'bad' : 'ok'} />
        <Stat label="Drawdown máx." value={`${maxDdPct.toFixed(2)}%`} tone="bad" />
      </div>
      <div className="h-72 -mx-2 overflow-x-auto">
        <div className="min-w-[640px] h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
              <ReTooltip
                contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [fmtUsd(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="dd" name="Drawdown" stroke="none" fill={RED} fillOpacity={0.15} />
              <Line type="monotone" dataKey="total" name="Total" stroke={GRAY} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="nk" name="NK" stroke={NAVY} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ox" name="OX" stroke={GOLD} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const cls = tone === 'bad' ? 'text-destructive' : tone === 'ok' ? 'text-success' : 'text-foreground';
  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-data font-bold ${cls}`}>{value}</div>
    </div>
  );
}
