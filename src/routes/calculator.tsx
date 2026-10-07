import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Info, Save, Search, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CalculatorHistory, type CalcRecord } from '@/components/calculator/CalculatorHistory';
import { useSettings } from '@/hooks/use-settings';
import { CONTRACT_SPECS } from '@/lib/contract-specs';
import { accountFromSettings, raiz } from '@/lib/account';
import { limpiarDescripcion } from '@/components/backtester/backtest-api';

export const Route = createFileRoute('/calculator')({
  head: () => ({
    meta: [
      { title: 'Calculadora — CAP Trading' },
      { name: 'description', content: 'Calculadora de contratos CWND: riesgo, R:R, nominal y apalancamiento paso a paso.' },
      { property: 'og:title', content: 'Calculadora — CAP Trading' },
      { property: 'og:description', content: 'Calculadora de contratos CWND: riesgo, R:R, nominal y apalancamiento paso a paso.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: CalculatorPage,
});

type Direction = 'BUY' | 'SELL';
type Market = {
  root: string; description: string; tickSize: number; tickValue: number;
  currency: string; contractSize: number; margin: number | null; marginCurrency: string | null;
};

/** Versiones micro conocidas (ratio = tamaño micro / tamaño estándar). */
const MICROS: Record<string, { symbol: string; ratio: number }> = {
  NQ: { symbol: 'MNQ', ratio: 0.1 }, ES: { symbol: 'MES', ratio: 0.1 }, YM: { symbol: 'MYM', ratio: 0.1 },
  RTY: { symbol: 'M2K', ratio: 0.1 }, GC: { symbol: 'MGC', ratio: 0.1 }, SI: { symbol: 'SIL', ratio: 0.2 },
  CL: { symbol: 'MCL', ratio: 0.1 }, HG: { symbol: 'MHG', ratio: 0.1 }, '6E': { symbol: 'M6E', ratio: 0.1 },
  '6A': { symbol: 'M6A', ratio: 0.1 }, '6B': { symbol: 'M6B', ratio: 0.1 }, FDAX: { symbol: 'FDXM', ratio: 0.2 },
  FESX: { symbol: 'FSXE', ratio: 0.1 },
};

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
      contractSize: c.contractSize,
      margin: c.marginInitial && c.marginInitial > 0 ? c.marginInitial : null,
      marginCurrency: c.marginCurrency?.toUpperCase() ?? null,
    });
  }
  return [...map.values()].sort((a, b) => a.root.localeCompare(b.root));
})();

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
const r6 = (n: number) => +n.toFixed(6);

function CalculatorPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();
  const account = accountFromSettings(settings);
  const syncedBalance = Number((settings as any)?.balance_nkis ?? 0);
  const defaultBalance = syncedBalance > 0 ? syncedBalance : account.saldoInicial;
  const cur = account.moneda.toUpperCase();
  const { data: contracts } = useCurrentContracts();

  const [search, setSearch] = useState('');
  const [root, setRoot] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [atr, setAtr] = useState('');
  const [balanceStr, setBalanceStr] = useState('');
  const [riskOverride, setRiskOverride] = useState('');
  const [fxStr, setFxStr] = useState('');
  const [note, setNote] = useState('');
  const [showCalc, setShowCalc] = useState(false);

  const market = MARKETS.find(m => m.root === root) ?? null;
  const currentContract = market ? contracts?.get(market.root) : undefined;
  const micro = market ? MICROS[market.root] : undefined;
  const needsFx = !!market && market.currency !== cur;
  const fxPair = market ? `${market.currency}${cur}` : '';

  const options = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return MARKETS;
    return MARKETS.filter(m =>
      m.root.includes(raiz(q)) || m.description.toUpperCase().includes(q) || (contracts?.get(m.root) ?? '').includes(q),
    );
  }, [search, contracts]);

  const e = num(entry), s = num(stop), t = num(target), a = num(atr);
  const balance = balanceStr.trim() ? num(balanceStr) : defaultBalance;
  const overrideN = num(riskOverride);
  const riskPct = riskOverride.trim() && overrideN > 0 ? overrideN : account.riesgoPct;
  const fx = needsFx ? num(fxStr) : 1;

  const suggestedStop = Number.isFinite(e) && a > 0 ? (direction === 'BUY' ? e - 1.5 * a : e + 1.5 * a) : null;

  const stopError = Number.isFinite(e) && Number.isFinite(s)
    ? (direction === 'BUY' && s >= e ? 'En BUY el stop debe estar por debajo de la entrada.'
      : direction === 'SELL' && s <= e ? 'En SELL el stop debe estar por encima de la entrada.' : null)
    : null;
  const targetWarn = Number.isFinite(e) && t > 0 &&
    ((direction === 'BUY' && t <= e) || (direction === 'SELL' && t >= e))
    ? 'El objetivo está del lado contrario a la dirección.' : null;

  const result = useMemo(() => {
    if (!market || riskPct == null || !Number.isFinite(e) || !Number.isFinite(s) || stopError) return null;
    if (!(balance > 0) || !(fx > 0)) return null;
    const dist = Math.abs(e - s);
    if (!(dist > 0)) return null;
    const ticks = dist / market.tickSize;
    const tickValueAcc = market.tickValue * fx;
    const riskPerContract = ticks * tickValueAcc;
    const riskBudget = balance * (riskPct / 100);
    const exact = riskBudget / riskPerContract;
    const n = Math.floor(exact);
    const money = n * riskPerContract;
    const realPct = (money / balance) * 100;
    const onePct = (riskPerContract / balance) * 100;
    const upMoney = (n + 1) * riskPerContract;
    const hasT = Number.isFinite(t) && t > 0;
    const rr = hasT ? Math.abs(t - e) / dist : null;
    const profitPerContract = hasT ? (Math.abs(t - e) / market.tickSize) * tickValueAcc : null;
    const nUsed = Math.max(n, 1);
    const profit = profitPerContract != null ? profitPerContract * n : null;
    const valuePerPoint = tickValueAcc / market.tickSize;
    const nominal1 = e * valuePerPoint;
    const nominal = nominal1 * n;
    const leverage = nominal / balance;
    const marginFx = market.margin != null ? (market.marginCurrency && market.marginCurrency !== cur ? fx : 1) : 0;
    const margin1 = market.margin != null ? market.margin * marginFx : null;
    const microInfo = micro ? {
      risk: riskPerContract * micro.ratio,
      fit: Math.floor(riskBudget / (riskPerContract * micro.ratio)),
    } : null;
    return {
      dist, ticks, distPct: (dist / e) * 100, distAtr: a > 0 ? dist / a : null,
      tickValueAcc, riskPerContract, riskBudget, exact, n, money, realPct, onePct, upMoney,
      upPct: (upMoney / balance) * 100, rr, profit, profitPct: profit != null ? (profit / balance) * 100 : null,
      profitPerContract, valuePerPoint, nominal, nominal1, leverage, margin1,
      marginTotal: margin1 != null ? margin1 * n : null, microInfo, nUsed,
    };
  }, [market, riskPct, e, s, t, a, stopError, balance, fx, cur, micro]);

  const fm = (n: number, d = 2) => `${n.toLocaleString('es-ES', { maximumFractionDigits: d })} ${cur}`;
  const pct = (n: number, d = 2) => `${n.toLocaleString('es-ES', { maximumFractionDigits: d })} %`;

  const handleSave = async () => {
    if (!market || !result) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('calculadora_registro').insert({
      user_id: user?.id,
      instrumento: currentContract ?? market.root,
      raiz: market.root,
      broker: 'darwinex',
      direccion: direction,
      precio_entrada: e,
      stop_loss: s,
      precio_objetivo: Number.isFinite(t) && t > 0 ? t : null,
      distancia_stop: result.dist,
      atr: a > 0 ? a : null,
      valor_punto: result.valuePerPoint,
      cuenta_balance: balance,
      riesgo_pct_usado: riskPct,
      tipo_cambio: needsFx ? fx : null,
      contratos_exactos: +result.exact.toFixed(4),
      lotes: result.n,
      riesgo_real: result.money,
      riesgo_real_pct: result.realPct,
      rr: result.rr,
      beneficio_potencial: result.profit,
      nota: note.trim() || null,
      estado: 'planificada',
    });
    if (error) toast.error(`Error al guardar: ${error.message}`);
    else {
      toast.success('Cálculo guardado');
      setNote('');
      qc.invalidateQueries({ queryKey: ['calc-records'] });
    }
  };

  const recover = (r: CalcRecord) => {
    setRoot(r.raiz || raiz(r.instrumento ?? ''));
    setDirection(r.direccion === 'SELL' ? 'SELL' : 'BUY');
    setEntry(r.precio_entrada != null ? String(r.precio_entrada) : '');
    setStop(r.stop_loss != null ? String(r.stop_loss) : '');
    setTarget(r.precio_objetivo != null ? String(r.precio_objetivo) : '');
    setAtr(r.atr != null ? String(r.atr) : '');
    setBalanceStr(r.cuenta_balance != null ? String(r.cuenta_balance) : '');
    setRiskOverride(r.riesgo_pct_usado != null && r.riesgo_pct_usado !== account.riesgoPct ? String(r.riesgo_pct_usado) : '');
    setFxStr(r.tipo_cambio != null ? String(r.tipo_cambio) : '');
    setNote(r.nota ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const noRisk = !isLoading && account.riesgoPct == null && !(overrideN > 0);

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calculadora — CWND</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riesgo por operación: {account.riesgoPct != null ? pct(account.riesgoPct, 3) : 'sin configurar'} ·{' '}
          <Link to="/settings" className="text-primary hover:underline">cambiar en Ajustes</Link>
          {' '}· Saldo {fm(defaultBalance)}{syncedBalance > 0 ? ' (sincronizado)' : ' (saldo inicial)'}
        </p>
      </div>

      {noRisk && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <SettingsIcon className="w-4 h-4" /> Configura tu % de riesgo en{' '}
          <Link to="/settings" className="font-semibold text-primary hover:underline">Ajustes</Link>
          <span className="text-muted-foreground">(o rellena "Riesgo solo para este cálculo").</span>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-5">
        {/* ENTRADA */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mercado</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={ev => setSearch(ev.target.value)}
                placeholder="Buscar: NQ, nasdaq, NQ_Z…"
                className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {(search || !market) && (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {options.map(m => (
                  <button
                    key={m.root}
                    onClick={() => { setRoot(m.root); setSearch(''); setFxStr(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-accent ${root === m.root ? 'bg-primary/10' : ''}`}
                  >
                    <span className="font-data font-bold w-14">{m.root}</span>
                    <span className="flex-1 text-muted-foreground truncate">{m.description}</span>
                    <span className="text-[10px] font-data text-muted-foreground">{m.currency}</span>
                  </button>
                ))}
                {options.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>}
              </div>
            )}
            {market && (
              <div className="mt-2 rounded-md border border-border bg-secondary/40 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="font-data font-bold text-lg">{market.root}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{market.description}</span>
                  </div>
                  <button onClick={() => setRoot('')} className="text-[11px] text-primary hover:underline">cambiar</button>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] font-data text-muted-foreground">
                  <span>Contrato vigente: {currentContract ?? '—'}</span>
                  <span>Divisa: {market.currency}</span>
                  <span>Tick: {market.tickSize}</span>
                  <span>Valor tick: {market.tickValue} {market.currency}</span>
                  <span>Tamaño contrato: {market.contractSize}</span>
                  <span>Margen: {market.margin != null ? `${market.margin.toLocaleString('es-ES')} ${market.marginCurrency ?? ''}` : '—'}</span>
                  {micro && <span className="col-span-2 text-primary">Existe micro: {micro.symbol} ({micro.ratio * 100} % del tamaño)</span>}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['BUY', 'SELL'] as Direction[]).map(d => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`py-3 rounded-md text-base font-bold border transition-colors ${direction === d
                  ? (d === 'BUY' ? 'bg-success/20 text-success border-success/50' : 'bg-destructive/20 text-destructive border-destructive/50')
                  : 'bg-secondary text-muted-foreground border-border'}`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de entrada" value={entry} onChange={setEntry} />
            <Field label="Precio del stop *" value={stop} onChange={setStop} />
            <Field label="Precio objetivo (opcional)" value={target} onChange={setTarget} />
            <div>
              <Field label="ATR(14) (opcional)" value={atr} onChange={setAtr} />
              {suggestedStop != null && (
                <button onClick={() => setStop(String(r6(suggestedStop)))} className="mt-1 text-[11px] text-primary hover:underline">
                  Proponer stop a 1,5 × ATR: {r6(suggestedStop)}
                </button>
              )}
            </div>
            <Field label={`Saldo (${cur})`} value={balanceStr} onChange={setBalanceStr} placeholder={String(defaultBalance)} />
            <Field label="Riesgo solo para este cálculo (%)" value={riskOverride} onChange={setRiskOverride}
              placeholder={account.riesgoPct != null ? String(account.riesgoPct) : '—'} />
            {needsFx && (
              <div className="col-span-2">
                <Field label={`Tipo de cambio ${fxPair} (1 ${market!.currency} = ? ${cur})`} value={fxStr} onChange={setFxStr} placeholder="p. ej. 1,08" />
                {!(fx > 0) && <p className="mt-1 text-[11px] text-warning">El contrato va en {market!.currency}: introduce el tipo de cambio para calcular.</p>}
              </div>
            )}
          </div>

          {stopError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" /> {stopError}
            </div>
          )}
          {targetWarn && !stopError && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <Info className="w-4 h-4" /> {targetWarn}
            </div>
          )}
        </div>

        {/* RESULTADO */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
          {!result ? (
            <p className="text-sm text-muted-foreground">
              {stopError ? 'Corrige el stop para ver el cálculo.' : 'Elige mercado, entrada y stop para ver el resultado.'}
            </p>
          ) : (
            <>
              <div className="text-center">
                <div className="font-data text-5xl font-bold text-primary">{result.n}</div>
                <div className="text-sm text-muted-foreground">contratos</div>
                <div className="mt-1 text-base">Arriesgas <b>{fm(result.money)}</b> ({pct(result.realPct, 3)})</div>
                <div className="text-[11px] text-muted-foreground font-data">Exactos: {result.exact.toFixed(2)} · Riesgo {pct(riskPct!, 3)}{riskOverride.trim() && overrideN > 0 ? ' (solo este cálculo)' : ''}</div>
              </div>

              {result.n === 0 && (
                <div className="rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
                  1 contrato arriesga <b>{fm(result.riskPerContract)}</b> = <b>{pct(result.onePct, 3)}</b> del saldo (más que tu {pct(riskPct!, 3)}).
                  {result.microInfo && <> Con {micro!.symbol}: {result.microInfo.fit} micros encajan ({fm(result.microInfo.risk)} cada uno).</>}
                </div>
              )}
              {result.n > 0 && result.microInfo && (
                <p className="text-[11px] text-muted-foreground">Con {micro!.symbol}: {result.microInfo.fit} micros encajan en tu riesgo.</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Con {result.n + 1} contrato{result.n + 1 > 1 ? 's' : ''} (redondeo hacia arriba): {fm(result.upMoney)} ({pct(result.upPct, 3)}).
              </p>

              <PriceBar dir={direction} entry={e} stop={s} target={Number.isFinite(t) && t > 0 ? t : null}
                dist={result.dist} rr={result.rr} />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Card label="Distancia stop" value={`${r6(result.dist)}`}
                  sub={`${result.ticks.toFixed(1)} ticks · ${pct(result.distPct)}${result.distAtr != null ? ` · ${result.distAtr.toFixed(2)} ATR` : ''}`} />
                <Card label="Riesgo 1 contrato" value={fm(result.riskPerContract)} sub={pct(result.onePct, 3)} />
                <Card label="Valor nominal" value={fm(result.nominal, 0)} sub={`1 contrato: ${fm(result.nominal1, 0)}`} />
                <Card label="Apalancamiento" value={`${result.leverage.toFixed(2)}×`} />
                <Card label="Margen" value={result.marginTotal != null ? fm(result.marginTotal, 0) : '—'}
                  sub={result.margin1 != null ? `1 contrato: ${fm(result.margin1, 0)}` : 'sin dato'} />
                <Card label="Beneficio potencial" value={result.profit != null ? fm(result.profit) : '—'}
                  sub={result.profitPct != null ? `${pct(result.profitPct, 3)} · R:R ${result.rr!.toFixed(2)}` : 'sin objetivo'} tone="success" />
              </div>

              <div className="rounded-md border border-border">
                <button onClick={() => setShowCalc(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm">
                  Ver cálculo <ChevronDown className={`w-4 h-4 transition-transform ${showCalc ? 'rotate-180' : ''}`} />
                </button>
                {showCalc && (
                  <div className="px-3 pb-3 space-y-1 text-[11px] font-data text-muted-foreground">
                    {needsFx && <div>Valor tick en {cur} = {market!.tickValue} × {fx} = {r6(result.tickValueAcc)}</div>}
                    <div>Riesgo 1 contrato = (|{e} − {s}| / {market!.tickSize}) × {r6(result.tickValueAcc)} = {result.ticks.toFixed(2)} × {r6(result.tickValueAcc)} = {result.riskPerContract.toFixed(2)}</div>
                    <div>Dinero a arriesgar = {balance} × {riskPct}% = {result.riskBudget.toFixed(2)}</div>
                    <div>Contratos exactos = {result.riskBudget.toFixed(2)} / {result.riskPerContract.toFixed(2)} = {result.exact.toFixed(4)}</div>
                    <div>Contratos = ⌊{result.exact.toFixed(4)}⌋ = {result.n}</div>
                    <div>Riesgo real = {result.n} × {result.riskPerContract.toFixed(2)} = {result.money.toFixed(2)} ({result.realPct.toFixed(4)} %)</div>
                    {result.rr != null && <div>R:R = |{t} − {e}| / |{e} − {s}| = {result.rr.toFixed(3)}</div>}
                    <div>Nominal = {e} × {r6(result.valuePerPoint)} (valor punto) × {result.n} = {result.nominal.toFixed(0)} · Apalancamiento = {result.nominal.toFixed(0)} / {balance} = {result.leverage.toFixed(3)}</div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input value={note} onChange={ev => setNote(ev.target.value)} placeholder="Nota (opcional)"
                  className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                  <Save className="w-4 h-4" /> Guardar cálculo
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <CalculatorHistory onRecover={recover} />
    </div>
  );
}

function PriceBar({ dir, entry, stop, target, dist, rr }: {
  dir: Direction; entry: number; stop: number; target: number | null; dist: number; rr: number | null;
}) {
  const pts = [stop, entry, ...(target != null ? [target] : [])];
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const pos = (p: number) => ((p - lo) / span) * 100;
  const seg = (a: number, b: number) => ({ left: `${Math.min(pos(a), pos(b))}%`, width: `${Math.abs(pos(a) - pos(b))}%` });
  const validT = target != null && ((dir === 'BUY' && target > entry) || (dir === 'SELL' && target < entry));
  return (
    <div className="pt-2">
      <div className="flex justify-between text-[11px] font-data mb-1">
        <span className="text-destructive">Stop −{r6(dist)}</span>
        {validT && <span className="text-success">Objetivo +{r6(Math.abs(target! - entry))} · R:R {rr!.toFixed(2)}</span>}
      </div>
      <div className="relative h-3 rounded-full bg-secondary mx-2">
        <div className="absolute inset-y-0 bg-destructive/70 rounded-full" style={seg(stop, entry)} />
        {validT && <div className="absolute inset-y-0 bg-success/70 rounded-full" style={seg(entry, target!)} />}
        {pts.map((p, i) => (
          <div key={i} className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `${pos(p)}%` }} />
        ))}
      </div>
      <div className="relative h-8 mx-2 text-[10px] font-data">
        {[['SL', stop], ['Entrada', entry], ...(target != null ? [['TP', target]] : [])].map(([l, p]) => (
          <div key={l as string} className="absolute -translate-x-1/2 text-center top-1" style={{ left: `${pos(p as number)}%` }}>
            <div className="text-muted-foreground">{l}</div><div>{r6(p as number)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'success' }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-data font-bold text-sm ${tone === 'success' ? 'text-success' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground font-data">{sub}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={ev => onChange(ev.target.value)}
        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-data focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
