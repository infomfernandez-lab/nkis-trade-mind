import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CalculatorHistory, type CalcRecord } from '@/components/calculator/CalculatorHistory';
import { useSettings } from '@/hooks/use-settings';
import { useLatestVix } from '@/hooks/use-latest-vix';
import { CONTRACT_SPECS } from '@/lib/contract-specs';
import { accountFromSettings, raiz } from '@/lib/account';
import { limpiarDescripcion } from '@/components/backtester/backtest-api';

export const Route = createFileRoute('/calculator')({
  head: () => ({
    meta: [
      { title: 'Calculadora — CAP Trading' },
      { name: 'description', content: 'Calculadora de contratos CWND con riesgo fijo por operación.' },
      { property: 'og:title', content: 'Calculadora — CAP Trading' },
      { property: 'og:description', content: 'Calculadora de contratos CWND con riesgo fijo por operación.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: CalculatorPage,
});

type Direction = 'BUY' | 'SELL';
type Market = { root: string; description: string; tickSize: number; tickValue: number; currency: string };

/** Un mercado por raíz (tick y valor del tick iguales en todos los vencimientos). */
const MARKETS: Market[] = (() => {
  const map = new Map<string, Market>();
  for (const c of CONTRACT_SPECS) {
    if (c.broker !== 'nkis' || !(c.tickSize > 0)) continue;
    const root = raiz(c.symbol);
    if (map.has(root)) continue;
    map.set(root, {
      root,
      description: limpiarDescripcion(c.description || root),
      tickSize: c.tickSize,
      tickValue: c.tickValue,
      currency: (c.profitCurrency || 'USD').toUpperCase(),
    });
  }
  return [...map.values()].sort((a, b) => a.root.localeCompare(b.root));
})();

/** Contrato vigente por raíz según el último escaneo CWND. */
function useCurrentContracts() {
  return useQuery({
    queryKey: ['calc-current-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('broker, top_instruments, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const row = (data ?? []).find(r => !String(r.broker ?? '').toLowerCase().includes('octx'));
      const out = new Map<string, string>();
      for (const it of (Array.isArray(row?.top_instruments) ? row!.top_instruments : []) as any[]) {
        const sym = String(it?.symbol ?? '').toUpperCase();
        const root = raiz(sym);
        if (sym && !out.has(root)) out.set(root, sym);
      }
      return out;
    },
  });
}

const num = (v: string) => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

function CalculatorPage() {
  const { data: settings } = useSettings();
  const account = accountFromSettings(settings);
  const syncedBalance = Number((settings as any)?.balance_nkis ?? 0);
  const balance = syncedBalance > 0 ? syncedBalance : account.saldoInicial;
  const riskPct = account.riesgoPct;
  const { data: vixRow } = useLatestVix();
  const { data: contracts } = useCurrentContracts();

  const [search, setSearch] = useState('');
  const [root, setRoot] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [atr, setAtr] = useState('');

  const market = MARKETS.find(m => m.root === root) ?? null;
  const currentContract = market ? contracts?.get(market.root) : undefined;

  const options = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return MARKETS;
    return MARKETS.filter(m =>
      m.root.includes(raiz(q)) || m.description.toUpperCase().includes(q) || (contracts?.get(m.root) ?? '').includes(q),
    );
  }, [search, contracts]);

  const e = num(entry);
  const s = num(stop);
  const t = num(target);
  const a = num(atr);

  const suggestedStop = Number.isFinite(e) && Number.isFinite(a) && a > 0
    ? (direction === 'BUY' ? e - 1.5 * a : e + 1.5 * a)
    : null;

  const stopError = Number.isFinite(e) && Number.isFinite(s)
    ? (direction === 'BUY' && s >= e ? 'En BUY el stop debe estar por debajo de la entrada.'
      : direction === 'SELL' && s <= e ? 'En SELL el stop debe estar por encima de la entrada.'
      : null)
    : null;

  const result = useMemo(() => {
    if (!market || !Number.isFinite(e) || !Number.isFinite(s) || stopError) return null;
    const dist = Math.abs(e - s);
    if (!(dist > 0)) return null;
    const riskPerContract = (dist / market.tickSize) * market.tickValue;
    const riskBudget = balance * (riskPct / 100);
    const contracts = Math.floor(riskBudget / riskPerContract);
    const money = contracts * riskPerContract;
    const realPct = balance > 0 ? (money / balance) * 100 : 0;
    const rr = Number.isFinite(t) && t > 0 ? Math.abs(t - e) / dist : null;
    return { dist, riskPerContract, riskBudget, contracts, money, realPct, rr };
  }, [market, e, s, t, stopError, balance, riskPct]);

  const fmtMoney = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${account.moneda}`;

  const handleSave = async () => {
    if (!market || !result) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('calculadora_registro').insert({
      user_id: user?.id,
      instrumento: currentContract ?? market.root,
      broker: 'darwinex',
      direccion: direction,
      precio_entrada: e,
      stop_loss: s,
      distancia_stop: result.dist,
      lotes: result.contracts,
      riesgo_real: result.money,
      atr: Number.isFinite(a) ? a : null,
      valor_punto: market.tickValue / market.tickSize,
      cuenta_balance: balance,
      vix: vixRow?.vix ?? null,
    });
    if (error) toast.error(`Error al guardar: ${error.message}`);
    else toast.success('Cálculo guardado');
  };

  const recover = (r: CalcRecord) => {
    setRoot(raiz(r.instrumento ?? ''));
    setDirection((r.direccion as Direction) === 'SELL' ? 'SELL' : 'BUY');
    setEntry(r.precio_entrada != null ? String(r.precio_entrada) : '');
    setStop(r.stop_loss != null ? String(r.stop_loss) : '');
    setAtr(r.atr != null ? String(r.atr) : '');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calculadora — CWND</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riesgo fijo {riskPct.toLocaleString('es-ES')} % del saldo · Saldo {fmtMoney(balance)}
          {vixRow?.vix != null && <> · VIX {vixRow.vix} (solo informativo)</>}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        {/* Instrumento */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Instrumento</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={ev => setSearch(ev.target.value)}
              placeholder="Buscar: NQ, nasdaq, NQ_Z…"
              className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {options.map(m => (
              <button
                key={m.root}
                onClick={() => { setRoot(m.root); setSearch(''); }}
                className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-accent ${root === m.root ? 'bg-primary/10' : ''}`}
              >
                <span className="font-data font-bold w-14">{m.root}</span>
                <span className="flex-1 text-muted-foreground truncate">{m.description}</span>
                <span className="text-[10px] font-data text-muted-foreground">tick {m.tickSize} = {m.tickValue} {m.currency}</span>
              </button>
            ))}
            {options.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>}
          </div>
          {market && (
            <div className="mt-2 text-sm">
              <span className="font-data font-bold text-lg">{market.root}</span>
              <span className="ml-2 text-muted-foreground">{market.description}</span>
              <div className="text-[11px] text-muted-foreground font-data">
                {currentContract ? `Contrato vigente (último escaneo): ${currentContract}` : 'Sin contrato en el último escaneo'}
                {' · '}Tamaño tick {market.tickSize} · Valor tick {market.tickValue} {market.currency}
              </div>
            </div>
          )}
        </div>

        {/* Dirección */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {(['BUY', 'SELL'] as Direction[]).map(d => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-5 py-1.5 text-sm font-bold ${direction === d
                  ? (d === 'BUY' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive')
                  : 'bg-secondary text-muted-foreground'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Precio de entrada" value={entry} onChange={setEntry} />
          <Field label="Precio del stop (penúltimo pivote no tocado)" value={stop} onChange={setStop} />
          <Field label="Precio objetivo (opcional)" value={target} onChange={setTarget} />
          <div>
            <Field label="ATR(14) (opcional, ayuda para el stop)" value={atr} onChange={setAtr} />
            {suggestedStop != null && (
              <button
                onClick={() => setStop(String(+suggestedStop.toFixed(6)))}
                className="mt-1 text-[11px] text-primary hover:underline"
              >
                Stop propuesto (1,5 × ATR): {+suggestedStop.toFixed(6)} — usar
              </button>
            )}
          </div>
        </div>

        {stopError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" /> {stopError}
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          {result.contracts === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="w-4 h-4" /> 1 contrato arriesga más del {riskPct.toLocaleString('es-ES')} % del saldo: usa el micro o no operes
            </div>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Contratos" value={String(result.contracts)} big />
            <Stat label="Dinero arriesgado" value={fmtMoney(result.money)} />
            <Stat label="% real arriesgado" value={`${result.realPct.toFixed(3)} %`} />
            <Stat label="R:R planificado" value={result.rr != null ? result.rr.toFixed(2) : '—'} />
          </div>
          <p className="text-[11px] text-muted-foreground font-data">
            Distancia stop {+result.dist.toFixed(6)} · Riesgo por contrato {fmtMoney(result.riskPerContract)} · Presupuesto {fmtMoney(result.riskBudget)}
          </p>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Save className="w-4 h-4" /> Guardar cálculo
          </button>
        </div>
      )}

      <CalculatorHistory onRecover={recover} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        inputMode="decimal"
        value={value}
        onChange={ev => onChange(ev.target.value)}
        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-data focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-data font-bold ${big ? 'text-3xl text-primary' : 'text-lg'}`}>{value}</div>
    </div>
  );
}
