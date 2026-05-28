import { useMemo } from 'react';
import { Sun } from 'lucide-react';
import { formatCurrency, type Trade } from '@/lib/trade-utils';

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function TodaySummary({ closed, open }: { closed: Trade[]; open: Trade[] }) {
  const today = new Date();

  const { pnlToday, tradesToday, pnlMonth, tradesMonth, floating } = useMemo(() => {
    let pnlToday = 0, tradesToday = 0, pnlMonth = 0, tradesMonth = 0;
    for (const t of closed) {
      const exit = new Date(t.exitDate ?? t.entryDate);
      if (isSameMonth(exit, today)) { pnlMonth += t.netPnl; tradesMonth++; }
      if (isSameDay(exit, today))   { pnlToday += t.netPnl; tradesToday++; }
    }
    const floating = open.reduce((s, t) => s + t.netPnl, 0);
    return { pnlToday, tradesToday, pnlMonth, tradesMonth, floating };
  }, [closed, open, today]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Sun className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm">RESUMEN DE HOY</h2>
        <span className="ml-auto text-[10px] text-muted-foreground font-data">
          {today.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
        </span>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
        <Cell label="P&L Hoy" value={formatCurrency(pnlToday)} sub={`${tradesToday} trade${tradesToday === 1 ? '' : 's'}`} tone={pnlToday > 0 ? 'good' : pnlToday < 0 ? 'bad' : 'neutral'} />
        <Cell label="P&L Mes" value={formatCurrency(pnlMonth)} sub={`${tradesMonth} trade${tradesMonth === 1 ? '' : 's'}`} tone={pnlMonth > 0 ? 'good' : pnlMonth < 0 ? 'bad' : 'neutral'} />
        <Cell label="Flotante" value={formatCurrency(floating)} sub={`${open.length} abierta${open.length === 1 ? '' : 's'}`} tone={floating > 0 ? 'good' : floating < 0 ? 'bad' : 'neutral'} />
        <Cell label="Estado" value={open.length > 0 ? 'En mercado' : 'Cash'} sub={open.length > 0 ? 'Vigilando posiciones' : 'Sin exposición'} tone="neutral" />
      </div>
    </section>
  );
}

function Cell({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'good' | 'bad' | 'neutral' }) {
  const c = tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-destructive' : 'text-foreground';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-data font-bold ${c}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
