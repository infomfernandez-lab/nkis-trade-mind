import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Trade } from '@/lib/trade-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const GOLD = '#D4A017';
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEK = ['L','M','X','J','V','S','D'];

type Account = 'all' | 'nk' | 'ox';

interface Props {
  closedTrades: Trade[];
}

function isOctx(t: Trade) {
  return t.broker === 'octx' || t.broker === 'fxpro';
}

interface DayData {
  pnl: number;
  count: number;
  symbols: string[];
}

export function PnlCalendarSection({ closedTrades }: Props) {
  const [account, setAccount] = useState<Account>('all');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const filtered = useMemo(() => {
    if (account === 'all') return closedTrades;
    if (account === 'ox') return closedTrades.filter(isOctx);
    return closedTrades.filter(t => !isOctx(t));
  }, [closedTrades, account]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const t of filtered) {
      const d = new Date(t.exitDate ?? t.entryDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const cur = map.get(key) ?? { pnl: 0, count: 0, symbols: [] };
      cur.pnl += t.netPnl;
      cur.count += 1;
      if (!cur.symbols.includes(t.symbol)) cur.symbols.push(t.symbol);
      map.set(key, cur);
    }
    return map;
  }, [filtered]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Lunes=0
  const firstWeekday = (first.getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const summary = useMemo(() => {
    let pos = 0, neg = 0, total = 0;
    let best = { day: 0, pnl: -Infinity };
    let worst = { day: 0, pnl: Infinity };
    for (let d = 1; d <= daysInMonth; d++) {
      const data = byDay.get(`${year}-${month}-${d}`);
      if (!data) continue;
      total += data.pnl;
      if (data.pnl > 0) pos++;
      else if (data.pnl < 0) neg++;
      if (data.pnl > best.pnl) best = { day: d, pnl: data.pnl };
      if (data.pnl < worst.pnl) worst = { day: d, pnl: data.pnl };
    }
    return {
      pos, neg, total,
      best: best.pnl === -Infinity ? null : best,
      worst: worst.pnl === Infinity ? null : worst,
    };
  }, [byDay, daysInMonth, year, month]);

  const fmtUsd = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const accBtn = (val: Account, label: string) => (
    <button
      onClick={() => setAccount(val)}
      className={`px-2.5 py-1 text-xs rounded-md border ${account === val ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display text-base font-semibold" style={{ color: GOLD }}>
          Calendario de PnL
        </h2>
        <div className="flex items-center gap-1.5">
          {accBtn('all', 'Todos')}
          {accBtn('nk', 'NK')}
          {accBtn('ox', 'OX')}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-md border border-border hover:bg-muted"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold">{MONTHS[month]} {year}</div>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-md border border-border hover:bg-muted"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground mb-1">
        {WEEK.map(d => <div key={d} className="text-center font-semibold">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="aspect-square" />;
          const data = byDay.get(`${year}-${month}-${d}`);
          if (!data) {
            return (
              <div key={i} className="aspect-square rounded-md bg-muted/30 flex items-start justify-end p-1 text-[10px] text-muted-foreground/60">
                {d}
              </div>
            );
          }
          const positive = data.pnl >= 0;
          const cls = positive
            ? 'bg-success/15 border-success/30 text-success'
            : 'bg-destructive/15 border-destructive/30 text-destructive';
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div className={`aspect-square rounded-md border ${cls} p-1 flex flex-col justify-between text-[10px] cursor-help overflow-hidden`}>
                  <span className="text-muted-foreground self-end">{d}</span>
                  <span className="font-data font-bold text-[10px] leading-tight truncate">
                    {fmtUsd(data.pnl)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[240px]">
                <div className="font-semibold">{d} {MONTHS[month]} {year}</div>
                <div>{data.count} {data.count === 1 ? 'trade' : 'trades'} · {fmtUsd(data.pnl)}</div>
                <div className="text-muted-foreground mt-1">{data.symbols.join(', ')}</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4 text-xs">
        <SumCell label="Días positivos" value={`${summary.pos}`} tone="ok" />
        <SumCell label="Días negativos" value={`${summary.neg}`} tone="bad" />
        <SumCell label="Mejor día" value={summary.best ? `${summary.best.day} · ${fmtUsd(summary.best.pnl)}` : '—'} tone="ok" />
        <SumCell label="Peor día" value={summary.worst ? `${summary.worst.day} · ${fmtUsd(summary.worst.pnl)}` : '—'} tone="bad" />
        <SumCell label="PnL del mes" value={fmtUsd(summary.total)} tone={summary.total >= 0 ? 'ok' : 'bad'} />
      </div>
    </div>
  );
}

function SumCell({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'bad' }) {
  const cls = tone === 'ok' ? 'text-success' : 'text-destructive';
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`font-data font-bold ${cls}`}>{value}</div>
    </div>
  );
}
