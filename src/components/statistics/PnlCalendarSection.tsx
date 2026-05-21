import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { Trade } from '@/lib/trade-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const GOLD = '#D4A017';
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEK = ['L','M','X','J','V','S','D'];

type BrokerFilter = 'all' | 'darwinex' | 'octx';

interface Props {
  closedTrades: Trade[];
  broker?: BrokerFilter;
}

interface DayData {
  pnl: number;
  count: number;
  symbols: string[];
}

export function PnlCalendarSection({ closedTrades, broker = 'all' }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const filtered = useMemo(
    () => closedTrades.filter(t => t.broker !== 'fxpro'),
    [closedTrades],
  );

  const accountLabel = broker === 'darwinex' ? 'NK' : broker === 'octx' ? 'OX' : 'Todas las cuentas';


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

  return (
    <div className="rounded-lg border border-border bg-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display text-base font-semibold flex items-center gap-1.5" style={{ color: GOLD }}>
          Calendario de PnL
          <InfoTip text="Cada casilla suma el P&L neto de los trades cerrados ese día. Pulsa o pasa el ratón para ver detalle." />
        </h2>
        <span className="text-xs text-muted-foreground">{accountLabel}</span>
      </div>


      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-md border border-border hover:bg-muted"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-base font-semibold">{MONTHS[month]} {year}</div>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-md border border-border hover:bg-muted"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
        {WEEK.map(d => <div key={d} className="text-center font-semibold">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="aspect-square" />;
          const data = byDay.get(`${year}-${month}-${d}`);
          if (!data) {
            return (
              <div key={i} className="aspect-square rounded-md bg-muted/30 flex items-start justify-end p-1 text-xs text-muted-foreground/60">
                {d}
              </div>
            );
          }
          const positive = data.pnl >= 0;
          const cls = positive
            ? 'bg-success/15 border-success/30 text-success'
            : 'bg-destructive/15 border-destructive/30 text-destructive';
          const detail = (
            <>
              <div className="font-semibold text-sm">{d} {MONTHS[month]} {year}</div>
              <div className="text-sm">{data.count} {data.count === 1 ? 'trade' : 'trades'} · {fmtUsd(data.pnl)}</div>
              <div className="text-xs text-muted-foreground mt-1">{data.symbols.join(', ')}</div>
            </>
          );
          return (
            <Popover key={i}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`aspect-square w-full rounded-md border ${cls} p-1 flex flex-col justify-between cursor-pointer overflow-hidden hover:brightness-110 transition`}
                >
                  <span className="text-[10px] text-muted-foreground self-end leading-none">{d}</span>
                  <span className="font-data font-bold leading-tight text-center w-full text-[11px] sm:text-sm md:text-base lg:text-lg xl:text-xl whitespace-nowrap">
                    {fmtUsd(data.pnl)}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-auto max-w-[260px] p-3">
                {detail}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-4 text-xs">
        <SumCell label="Días positivos" value={`${summary.pos}`} tone="ok" tip="Número de días del mes con P&L neto positivo." />
        <SumCell label="Días negativos" value={`${summary.neg}`} tone="bad" tip="Número de días del mes con P&L neto negativo." />
        <SumCell label="Mejor día" value={summary.best ? `${summary.best.day} · ${fmtUsd(summary.best.pnl)}` : '—'} tone="ok" tip="Día del mes con mayor P&L neto positivo." />
        <SumCell label="Peor día" value={summary.worst ? `${summary.worst.day} · ${fmtUsd(summary.worst.pnl)}` : '—'} tone="bad" tip="Día del mes con mayor P&L neto negativo." />
        <SumCell label="PnL del mes" value={fmtUsd(summary.total)} tone={summary.total >= 0 ? 'ok' : 'bad'} tip="Suma del P&L neto de todos los trades cerrados durante el mes." />
      </div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex"
          aria-label="Más información"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        >
          <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="max-w-[260px] text-sm p-3"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}

function SumCell({ label, value, tone, tip }: { label: string; value: string; tone: 'ok' | 'bad'; tip: string }) {
  const cls = tone === 'ok' ? 'text-success' : 'text-destructive';
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-center gap-1.5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <InfoTip text={tip} />
      </div>
      <div className={`font-data font-bold ${cls}`}>{value}</div>
    </div>
  );
}
