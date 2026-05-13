import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import type { Trade } from '@/lib/trade-utils';
import { classifyStatFamily, STAT_FAMILIES, type StatFamily } from './family-classify';

const GOLD = '#D4A017';
const NAVY = '#1E3A5F';
const RED = '#f87171';

interface Row {
  family: StatFamily;
  trades: number;
  winRate: number;
  profitFactor: number;
  pnl: number;
  avgWin: number;
  avgLoss: number;
}

export function FamilyStatsSection({ closedTrades }: { closedTrades: Trade[] }) {
  const rows = useMemo<Row[]>(() => {
    const groups = new Map<StatFamily, Trade[]>();
    for (const t of closedTrades) {
      const fam = classifyStatFamily(t.symbol);
      const arr = groups.get(fam) ?? [];
      arr.push(t);
      groups.set(fam, arr);
    }
    const rows: Row[] = [];
    for (const fam of STAT_FAMILIES) {
      const list = groups.get(fam);
      if (!list || list.length === 0) continue;
      const wins = list.filter(t => t.netPnl > 0);
      const losses = list.filter(t => t.netPnl < 0);
      const grossWin = wins.reduce((s, t) => s + t.netPnl, 0);
      const grossLoss = losses.reduce((s, t) => s + Math.abs(t.netPnl), 0);
      const pnl = list.reduce((s, t) => s + t.netPnl, 0);
      rows.push({
        family: fam,
        trades: list.length,
        winRate: (wins.length / list.length) * 100,
        profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
        pnl,
        avgWin: wins.length > 0 ? grossWin / wins.length : 0,
        avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
      });
    }
    rows.sort((a, b) => {
      const pa = a.profitFactor === Infinity ? 9999 : a.profitFactor;
      const pb = b.profitFactor === Infinity ? 9999 : b.profitFactor;
      return pb - pa;
    });
    return rows;
  }, [closedTrades]);

  const fmtUsd = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <h2 className="font-display text-base font-semibold mb-4" style={{ color: GOLD }}>
        Estadísticas por Familia
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay datos suficientes.</p>
      ) : (
        <>
          <div className="h-64 mb-6 -mx-2 overflow-x-auto">
            <div className="min-w-[480px] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" vertical={false} />
                  <XAxis dataKey="family" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <ReTooltip
                    contentStyle={{ backgroundColor: '#111318', border: '1px solid #1e2330', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtUsd(v), 'PnL']}
                  />
                  <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                    {rows.map((r, i) => (
                      <Cell key={i} fill={r.pnl >= 0 ? NAVY : RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold">Familia</th>
                  <th className="text-right py-2 px-2 font-semibold">Trades</th>
                  <th className="text-right py-2 px-2 font-semibold">Win Rate</th>
                  <th className="text-right py-2 px-2 font-semibold">PF</th>
                  <th className="text-right py-2 px-2 font-semibold">PnL</th>
                  <th className="text-right py-2 px-2 font-semibold">Avg Win</th>
                  <th className="text-right py-2 px-2 font-semibold">Avg Loss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.family} className="border-b border-border/50">
                    <td className="py-2 px-2 font-semibold">{r.family}</td>
                    <td className="text-right py-2 px-2 font-data">{r.trades}</td>
                    <td className={`text-right py-2 px-2 font-data ${r.winRate >= 50 ? 'text-success' : 'text-destructive'}`}>{r.winRate.toFixed(1)}%</td>
                    <td className={`text-right py-2 px-2 font-data ${r.profitFactor >= 1 ? 'text-success' : 'text-destructive'}`}>
                      {r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2)}
                    </td>
                    <td className={`text-right py-2 px-2 font-data ${r.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtUsd(r.pnl)}</td>
                    <td className="text-right py-2 px-2 font-data text-success">{fmtUsd(r.avgWin)}</td>
                    <td className="text-right py-2 px-2 font-data text-destructive">-${r.avgLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
