import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Copy, Trash2, ChevronDown, ChevronUp, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/calculator')({
  head: () => ({
    meta: [
      { title: 'Calculadora — CAP Trading' },
      { name: 'description', content: 'Calculadora de posición CAP Trend Following' },
    ],
  }),
  component: CalculatorPage,
});

type Account = 'darwinex' | 'fxpro';
type Direction = 'BUY' | 'SELL';

type InstrumentRow = {
  symbol: string;
  description: string;
  size?: string;
  pointValue: number;
  note?: string;
  group: string;
  broker: 'darwinex' | 'fxpro';
};

const INSTRUMENTS: InstrumentRow[] = [
  // Darwinex - Agrícolas
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'KE_K/N', description: 'Hard Red Wheat', size: '5.000', pointValue: 50 },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZC_K/N', description: 'Corn', size: '5.000', pointValue: 50 },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZL_K/N', description: 'Soybean Oil', size: '60.000', pointValue: 600 },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZM_K/N', description: 'Soybean Meal', size: '100', pointValue: 1 },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZS_K/N', description: 'Soybeans', size: '5.000', pointValue: 50 },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'LE_M', description: 'Live Cattle', size: '40.000', pointValue: 400 },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'HE_K', description: 'Lean Hogs', size: '40.000', pointValue: 400 },
  // Energía
  { broker: 'darwinex', group: 'Energía', symbol: 'BZ_M/N', description: 'Brent Crude Oil', size: '1.000', pointValue: 10 },
  { broker: 'darwinex', group: 'Energía', symbol: 'CL_M', description: 'Light Sweet Crude', size: '1.000', pointValue: 10 },
  { broker: 'darwinex', group: 'Energía', symbol: 'HO_K/M', description: 'Heating Oil', size: '42.000', pointValue: 420 },
  { broker: 'darwinex', group: 'Energía', symbol: 'NG_K/M', description: 'Natural Gas', size: '10.000', pointValue: 100 },
  { broker: 'darwinex', group: 'Energía', symbol: 'RB_K/M', description: 'RBOB Gasoline', size: '42.000', pointValue: 420 },
  // Índices USA
  { broker: 'darwinex', group: 'Índices USA', symbol: 'ES_M', description: 'E-mini S&P 500', size: '50', pointValue: 50 },
  { broker: 'darwinex', group: 'Índices USA', symbol: 'NQ_M', description: 'E-mini NASDAQ 100', size: '20', pointValue: 20 },
  { broker: 'darwinex', group: 'Índices USA', symbol: 'RTY_M', description: 'E-mini Russell 2000', size: '50', pointValue: 50 },
  { broker: 'darwinex', group: 'Índices USA', symbol: 'YM_M', description: 'Mini Dow Jones', size: '5', pointValue: 5 },
  // Índices Europeos
  { broker: 'darwinex', group: 'Índices Europeos', symbol: 'FDAX_M', description: 'DAX Index (EUR)', size: '25', pointValue: 25 },
  { broker: 'darwinex', group: 'Índices Europeos', symbol: 'FESX_M', description: 'Euro STOXX 50 (EUR)', size: '10', pointValue: 10 },
  { broker: 'darwinex', group: 'Índices Europeos', symbol: 'FGBL_M', description: 'Bund (EUR)', size: '100k', pointValue: 10 },
  // Metales
  { broker: 'darwinex', group: 'Metales', symbol: 'GC_M', description: 'COMEX Gold', size: '100', pointValue: 100 },
  { broker: 'darwinex', group: 'Metales', symbol: 'HG_K/N', description: 'COMEX Copper', size: '25.000', pointValue: 250 },
  { broker: 'darwinex', group: 'Metales', symbol: 'SI_K/N', description: 'COMEX Silver', size: '5.000', pointValue: 50 },
  { broker: 'darwinex', group: 'Metales', symbol: 'PL_N', description: 'NYMEX Platinum', size: '50', pointValue: 50 },
  // Divisas
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6A_M', description: 'Australian Dollar', size: '100k', pointValue: 10 },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6B_M', description: 'British Pound', size: '62.500', pointValue: 6.25 },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6C_M', description: 'Canadian Dollar', size: '100k', pointValue: 10 },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6E_M', description: 'EUR/USD', size: '125k', pointValue: 12.5 },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6J_M', description: 'Japanese Yen', size: '12.5M', pointValue: 12.5 },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6N_M', description: 'New Zealand Dollar', size: '100k', pointValue: 10 },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6S_M', description: 'Swiss Franc', size: '125k', pointValue: 12.5 },
  // Bonos
  { broker: 'darwinex', group: 'Bonos USA', symbol: 'ZN_M', description: '10Y US Treasury Note', size: '100k', pointValue: 1000 },
  // FXPro
  { broker: 'fxpro', group: 'FXPro', symbol: 'HILS.L', description: 'Hill & Smith', pointValue: 1, note: 'GBX/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'GIS.N', description: 'General Mills', pointValue: 1, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'WIX.O', description: 'Wix.com', pointValue: 1, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: '#Japan225', description: 'Japan 225 CFD', pointValue: 1, note: 'JPY/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'ZINC', description: 'Zinc Spot', pointValue: 1, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'ALUMINIUM', description: 'Aluminium Spot', pointValue: 1, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'COPPER', description: 'Copper Spot', pointValue: 1, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'AMD.O', description: 'AMD', pointValue: 1, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'HLMA.L', description: 'Halma PLC', pointValue: 1, note: 'GBX/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'EURUSD', description: 'EUR/USD', pointValue: 10, note: 'USD/pto' },
  { broker: 'fxpro', group: 'FXPro', symbol: 'USDJPY', description: 'USD/JPY', pointValue: 1, note: 'JPY/pto' },
];

const fmt = (n: number, d = 4) => Number.isFinite(n) ? n.toFixed(d) : '—';
const fmtEur = (n: number) => Number.isFinite(n) ? `€${n.toFixed(2)}` : '—';

function CalculatorPage() {
  const [account, setAccount] = useState<Account>('darwinex');
  const [capital, setCapital] = useState<number>(1_000_000);
  const [instrument, setInstrument] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [entry, setEntry] = useState<string>('');
  const [atr, setAtr] = useState<string>('');
  const [riskPct, setRiskPct] = useState<string>('1');
  const [pointValue, setPointValue] = useState<string>('1');
  const [vix, setVix] = useState<string>('');
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [tp, setTp] = useState<string>('');
  const [tableOpen, setTableOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const onAccountChange = (a: Account) => {
    setAccount(a);
    setCapital(a === 'darwinex' ? 1_000_000 : 26.39);
  };

  const nEntry = parseFloat(entry) || 0;
  const nAtr = parseFloat(atr) || 0;
  const nRisk = parseFloat(riskPct) || 0;
  const nPv = parseFloat(pointValue) || 0;
  const nVix = vix === '' ? null : parseFloat(vix);
  const nCurrent = parseFloat(currentPrice) || 0;
  const nTp = tp === '' ? null : parseFloat(tp);

  const vixInfo = useMemo(() => {
    if (nVix == null || !Number.isFinite(nVix)) return null;
    if (nVix < 25) return { msg: 'Riesgo normal — usar 1%', color: 'text-success', blocked: false };
    if (nVix < 35) return { msg: 'Volatilidad alta — reducir a 0.7%', color: 'text-[#B85C00]', blocked: false };
    if (nVix < 45) return { msg: 'Volatilidad muy alta — reducir a 0.5%', color: 'text-[#B85C00]', blocked: false };
    return { msg: '⚠️ Sistema bloqueado — no operar', color: 'text-destructive', blocked: true };
  }, [nVix]);
  const blocked = vixInfo?.blocked ?? false;

  const slDist = nAtr * 1.5;
  const slPrice = direction === 'BUY' ? nEntry - slDist : nEntry + slDist;
  const riskEur = capital * (nRisk / 100);
  const lotsRaw = slDist > 0 && nPv > 0 ? riskEur / (slDist * nPv) : 0;
  const lots = Math.max(0.01, Math.min(10, Math.round(lotsRaw * 100) / 100));
  const minLotWarning = lotsRaw > 0 && lotsRaw < 0.01;

  const beActivate = direction === 'BUY' ? nEntry + nAtr : nEntry - nAtr;
  const beSl = direction === 'BUY' ? nEntry + nAtr * 0.2 : nEntry - nAtr * 0.2;

  const trailSl = direction === 'BUY' ? nCurrent - nAtr * 3 : nCurrent + nAtr * 3;
  const floatPnl = direction === 'BUY'
    ? (nCurrent - nEntry) * lots * nPv
    : (nEntry - nCurrent) * lots * nPv;

  const realRisk = slDist * lots * nPv;
  const tpDist = nTp != null ? Math.abs(nTp - nEntry) : 0;
  const tpProfit = nTp != null ? tpDist * lots * nPv : 0;
  const rr = slDist > 0 && nTp != null ? tpDist / slDist : 0;
  const rrColor = rr >= 1.5 ? 'text-success' : rr >= 1 ? 'text-[#B85C00]' : 'text-destructive';

  const filteredInstruments = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return INSTRUMENTS;
    return INSTRUMENTS.filter(i =>
      i.symbol.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }, [tableSearch]);

  const pickInstrument = (row: InstrumentRow) => {
    setInstrument(row.symbol);
    setPointValue(String(row.pointValue));
    if (row.broker === 'darwinex') onAccountChange('darwinex');
    else onAccountChange('fxpro');
    setTableOpen(false);
    toast.success(`${row.symbol} cargado — valor punto: ${row.pointValue}`);
  };

  const clearAll = () => {
    setInstrument(''); setEntry(''); setAtr(''); setRiskPct('1');
    setPointValue('1'); setVix(''); setCurrentPrice(''); setTp('');
    toast.success('Calculadora limpiada');
  };

  const copySummary = async () => {
    const lines = [
      `RESUMEN — ${instrument || '—'} ${direction} ${account === 'darwinex' ? 'Darwinex' : 'FXPro'}`,
      `─────────────────────────────`,
      `Entrada:      ${fmt(nEntry)}`,
      `Stop Loss:    ${fmt(slPrice)}  (dist: ${fmt(slDist)})`,
      `Lotes:        ${lots.toFixed(2)}  (riesgo: ${fmtEur(realRisk)})`,
      `Breakeven en: ${fmt(beActivate)} → SL a ${fmt(beSl)}`,
      `Trailing SL:  precio ± (ATR×3)`,
      nTp != null ? `TP:           ${fmt(nTp)}  RR ${rr.toFixed(2)}:1` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Resumen copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calculadora</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calculadora de posición CAP Trend Following. Cálculo en tiempo real.
        </p>
      </div>

      {blocked && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-sm font-semibold">VIX &gt; 45 — Sistema bloqueado. No operar.</div>
        </div>
      )}

      {/* INPUTS */}
      <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Datos de entrada</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cuenta */}
          <Field label="Cuenta">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAccountChange('darwinex')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  account === 'darwinex' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                Darwinex Zero · €1.000.000
              </button>
              <button
                type="button"
                onClick={() => onAccountChange('fxpro')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  account === 'fxpro' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                FXPro · €26.39
              </button>
            </div>
            <NumInput value={capital} onChange={setCapital} className="mt-2" />
          </Field>

          {/* Instrumento */}
          <Field label="Instrumento">
            <input
              value={instrument}
              onChange={e => setInstrument(e.target.value)}
              placeholder="LE_M, HILS.L, ZINC, #Japan225..."
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          {/* Dirección */}
          <Field label="Dirección">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-bold border transition-colors ${
                  direction === 'BUY' ? 'border-success bg-success/15 text-success' : 'border-border bg-secondary text-muted-foreground'
                }`}
              >▲ BUY</button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-bold border transition-colors ${
                  direction === 'SELL' ? 'border-destructive bg-destructive/15 text-destructive' : 'border-border bg-secondary text-muted-foreground'
                }`}
              >▼ SELL</button>
            </div>
          </Field>

          <Field label="Precio de entrada">
            <input
              type="number" step="any" inputMode="decimal"
              value={entry} onChange={e => setEntry(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="ATR (14)" hint="Cópialo de MT5: Insertar → Indicadores → ATR período 14">
            <input
              type="number" step="any" inputMode="decimal"
              value={atr} onChange={e => setAtr(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="% Riesgo" hint="Sistema CAP: 1% por trade">
            <input
              type="number" step="0.1" min="0.1" max="3" inputMode="decimal"
              value={riskPct} onChange={e => setRiskPct(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="Valor del punto" hint="Para futuros Darwinex puede variar. Para CFDs FXPro usar 1 como aproximación o consultar especificaciones en MT5">
            <input
              type="number" step="any" inputMode="decimal"
              value={pointValue} onChange={e => setPointValue(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="VIX actual (opcional)" hint={vixInfo?.msg ?? 'Si lo rellenas, sugerimos % de riesgo según volatilidad'} hintClass={vixInfo?.color}>
            <input
              type="number" step="0.1" inputMode="decimal"
              value={vix} onChange={e => setVix(e.target.value)}
              placeholder="—"
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>
        </div>

        {/* Toggle tabla */}
        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setTableOpen(o => !o)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
          >
            {tableOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {tableOpen ? 'Ocultar tabla de instrumentos' : 'Ver tabla de instrumentos'}
          </button>
          {tableOpen && (
            <InstrumentTable
              search={tableSearch}
              onSearch={setTableSearch}
              rows={filteredInstruments}
              onPick={pickInstrument}
            />
          )}
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard title="Stop Loss">
          <Row label="Distancia (ATR × 1.5)"><Big>{fmt(slDist)}</Big></Row>
          <Row label={`Precio SL (${direction})`}><Big className={direction === 'BUY' ? 'text-destructive' : 'text-destructive'}>{fmt(slPrice)}</Big></Row>
        </ResultCard>

        <ResultCard title="Tamaño de posición">
          <Row label={`Riesgo máximo (${nRisk}%)`}><Big>{fmtEur(riskEur)}</Big></Row>
          <Row label="Lotes">
            <Big>{lots.toFixed(2)}</Big>
          </Row>
          {minLotWarning && (
            <div className="text-xs text-[#B85C00] mt-1">
              Lote mínimo — capital insuficiente para más
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1">mínimo 0.01, máximo 10</div>
        </ResultCard>

        <ResultCard title="Breakeven">
          <Row label={`Activar cuando precio llegue a (${direction})`}>
            <Big>{fmt(beActivate)}</Big>
          </Row>
          <Row label="Mover SL a">
            <Big>{fmt(beSl)}</Big>
          </Row>
          <div className="text-xs text-success mt-2">✓ A partir de aquí: trade 0 riesgo</div>
        </ResultCard>

        <ResultCard title="Trailing Stop">
          <div className="mb-3">
            <label className="text-xs text-muted-foreground block mb-1">Precio actual</label>
            <input
              type="number" step="any" inputMode="decimal"
              value={currentPrice} onChange={e => setCurrentPrice(e.target.value)}
              placeholder="0.00"
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </div>
          <Row label={`SL trailing (precio ± ATR×3)`}><Big>{fmt(trailSl)}</Big></Row>
          <Row label="Beneficio flotante">
            <Big className={floatPnl >= 0 ? 'text-success' : 'text-destructive'}>{fmtEur(floatPnl)}</Big>
          </Row>
        </ResultCard>

        <ResultCard title="Ratio Riesgo / Beneficio" className="md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">TP objetivo (opcional)</label>
              <input
                type="number" step="any" inputMode="decimal"
                value={tp} onChange={e => setTp(e.target.value)}
                placeholder="—"
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-data"
              />
              <Row label="Riesgo real" className="mt-3">
                <Big className="text-destructive">−{fmtEur(realRisk)}</Big>
              </Row>
            </div>
            <div>
              {nTp != null ? (
                <>
                  <Row label={`Beneficio potencial (TP ${fmt(nTp)})`}>
                    <Big className="text-success">+{fmtEur(tpProfit)}</Big>
                  </Row>
                  <Row label="RR ratio">
                    <Big className={rrColor}>{rr.toFixed(2)}:1</Big>
                  </Row>
                  <div className="text-xs text-muted-foreground mt-1">RR mínimo recomendado: 1.5:1</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground italic h-full flex items-center">
                  Sin TP fijo: trailing gestiona la salida
                </div>
              )}
            </div>
          </div>
        </ResultCard>
      </section>

      {/* RESUMEN */}
      <section className="rounded-xl border border-primary/30 bg-card p-4 lg:p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider">
            Resumen — <span className="text-primary">{instrument || '—'}</span>{' '}
            <span className={direction === 'BUY' ? 'text-success' : 'text-destructive'}>{direction}</span>{' '}
            <span className="text-muted-foreground">{account === 'darwinex' ? 'Darwinex' : 'FXPro'}</span>
          </h2>
          <div className="flex gap-2">
            <button onClick={copySummary} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20">
              <Copy className="w-3.5 h-3.5" /> Copiar resumen
            </button>
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-muted-foreground text-xs font-medium hover:text-foreground">
              <Trash2 className="w-3.5 h-3.5" /> Limpiar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm font-data">
          <SumRow label="Entrada" value={fmt(nEntry)} />
          <SumRow label="Stop Loss" value={`${fmt(slPrice)} (d: ${fmt(slDist)})`} />
          <SumRow label="Lotes" value={`${lots.toFixed(2)} (${fmtEur(realRisk)})`} />
          <SumRow label="Breakeven" value={`${fmt(beActivate)} → SL ${fmt(beSl)}`} />
          <SumRow label="Trailing SL" value="precio ± (ATR×3)" />
          {nTp != null && <SumRow label="RR con TP" value={`${rr.toFixed(2)}:1`} />}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children, hint, hintClass }: { label: string; children: React.ReactNode; hint?: string; hintClass?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1.5 font-medium">{label}</label>
      {children}
      {hint && <div className={`text-[11px] mt-1 ${hintClass ?? 'text-muted-foreground'}`}>{hint}</div>}
    </div>
  );
}

function NumInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <input
      type="number" step="any" inputMode="decimal"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className={`w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-data ${className ?? ''}`}
    />
  );
}

function ResultCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-[#111] p-4 ${className ?? ''}`}>
      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className ?? ''}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Big({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-data text-2xl md:text-3xl font-bold text-[#D4A017] ${className ?? ''}`}>{children}</span>;
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function InstrumentTable({
  search, onSearch, rows, onPick,
}: {
  search: string;
  onSearch: (s: string) => void;
  rows: InstrumentRow[];
  onPick: (r: InstrumentRow) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, InstrumentRow[]>();
    rows.forEach(r => {
      const key = `${r.broker === 'darwinex' ? 'Darwinex' : 'FXPro'} · ${r.group}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-[#0d0d0d]">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar por símbolo o descripción..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-transparent text-sm"
          />
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {grouped.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Sin resultados</div>
        )}
        {grouped.map(([group, items]) => (
          <div key={group}>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/50 font-semibold sticky top-0">
              {group}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="hidden md:table-header-group">
                  <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
                    <th className="px-3 py-1.5 font-medium">Símbolo</th>
                    <th className="px-3 py-1.5 font-medium">Descripción</th>
                    <th className="px-3 py-1.5 font-medium">Tamaño</th>
                    <th className="px-3 py-1.5 font-medium text-right">Val/pto</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr
                      key={`${r.broker}-${r.symbol}`}
                      onClick={() => onPick(r)}
                      className="cursor-pointer border-b border-border/50 hover:bg-primary/10 transition-colors"
                    >
                      <td className="px-3 py-2 font-data font-semibold">{r.symbol}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{r.description}</td>
                      <td className="px-3 py-2 text-muted-foreground font-data hidden md:table-cell">{r.size ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-data font-bold text-[#D4A017]">{r.pointValue}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs text-primary md:hidden">Usar →</span>
                        {r.note && <span className="hidden md:inline text-[10px] text-muted-foreground">{r.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
        FXPro: con apalancamiento 1:30 el margen requerido = valor posición / 30. El riesgo se calcula sobre el capital real.
        El valor del punto exacto varía según el instrumento — consulta especificaciones en MT5 (clic derecho → Especificaciones).
      </div>
    </div>
  );
}
