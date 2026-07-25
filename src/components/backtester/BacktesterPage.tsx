import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, BarChart, Bar, ScatterChart, Scatter, ZAxis, Cell,
  ComposedChart, Area,
} from 'recharts';
import { FlaskConical, Play, AlertTriangle, FileSpreadsheet, FileText, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

import html2canvas from 'html2canvas-pro';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { CONTRACT_SPECS } from '@/lib/contract-specs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnifiedInstruments } from '@/components/radar/EnTendenciaBlock';
import { RadarFiltersBar, EMPTY_FILTERS, tierOfScore, matchSearch, buildSubsList, type RadarFilterState, type Tier, type Suggestion } from '@/components/radar/RadarFiltersBar';
import { classifyFamily, type Family } from '@/lib/instrument-family';
import { classifyInstrument } from '@/lib/instrument-classify';

const SERVER_URL = 'https://ointment-handcraft-payee.ngrok-free.dev';

const COLORS = {
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  purple: '#6366f1',
  blue: '#3b82f6',
  gray: '#64748b',
  grid: '#1e2d45',
  axis: '#64748b',
} as const;
const CHART_BG = '#0a0e1a';
const tooltipProps = {
  contentStyle: { background: '#111827', border: '1px solid #1e2d45', fontSize: 12, color: '#e5e7eb' },
  labelStyle: { color: '#e5e7eb' },
  itemStyle: { color: '#e5e7eb' },
} as const;

type BrokerKey = 'nkis' | 'octx';
type Direction = 'BUY' | 'SELL';

interface BacktestParams {
  symbol: string;
  direction: Direction;
  date_from?: string;
  date_to?: string;
  adx_min: number;
  atr_sl: number;
  tp_mult: number;
  stoch_buy: number;
  stoch_sell: number;
  breakeven_enabled: boolean;
  breakeven_mult: number;
  trailing_enabled: boolean;
  trailing_mult: number;
}

interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price?: number;
  sl_price?: number;
  tp_price?: number | null;
  lot_size?: number;
  days?: number;
  mfe?: number;
  pnl: number;
  reason?: string;
}

interface BacktestMetrics {
  win_rate?: number;
  profit_factor?: number;
  sharpe?: number;
  pnl?: number;
  drawdown?: number;
  trades?: number;
}

interface BacktestResult {
  metrics: BacktestMetrics;
  equity_curve: Array<{ date?: string; equity: number }>;
  trades: BacktestTrade[];
}

/** Normalize raw server response → BacktestResult.
 * The Python backend returns trades with fields like `sl`, `lots`, `exit_reason`;
 * we map them to our internal shape so charts and tables show the correct data. */
function normalizeBacktestResult(raw: any): BacktestResult {
  const trades: BacktestTrade[] = (raw?.trades ?? []).map((t: any) => ({
    entry_date: t.entry_date ?? t.entryDate ?? '',
    exit_date: t.exit_date ?? t.exitDate ?? '',
    entry_price: Number(t.entry_price ?? t.entryPrice ?? 0),
    exit_price: t.exit_price ?? t.exitPrice ?? undefined,
    sl_price: Number(t.sl_price ?? t.sl ?? t.stop_loss ?? 0) || undefined,
    tp_price: t.tp == null && t.tp_price == null ? null : Number(t.tp ?? t.tp_price) || null,
    lot_size: Number(t.lot_size ?? t.lots ?? t.size ?? 0) || undefined,
    days: t.days ?? t.duration_days ?? undefined,
    mfe: t.mfe ?? t.max_favorable ?? undefined,
    pnl: Number(t.pnl ?? t.profit ?? t.net_pnl ?? 0),
    reason: t.reason ?? t.exit_reason ?? t.close_reason ?? undefined,
  }));
  return {
    metrics: raw?.metrics ?? {},
    equity_curve: raw?.equity_curve ?? [],
    trades,
  };
}

interface SavedSession {
  id: string;
  symbol: string;
  broker: string;
  direction: string;
  date_from: string | null;
  date_to: string | null;
  params: BacktestParams;
  metrics: BacktestMetrics;
  equity_curve: BacktestResult['equity_curve'];
  trades: BacktestTrade[];
  created_at: string;
}

export default function BacktesterPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  type BrokerState = {
    symbol: string; symbolQuery: string; direction: Direction;
    dateFrom: string; dateTo: string;
    adxMin: number; atrSl: number; tpMult: number; stochBuy: number; stochSell: number;
    beEnabled: boolean; beMult: number; trEnabled: boolean; trMult: number;
    result: BacktestResult | null;
  };
  const defaultBrokerState = (): BrokerState => ({
    symbol: '', symbolQuery: '', direction: 'BUY',
    dateFrom: '', dateTo: '',
    adxMin: 23, atrSl: 1.5, tpMult: 3.0, stochBuy: 70, stochSell: 30,
    beEnabled: true, beMult: 1.0, trEnabled: false, trMult: 2.0,
    result: null,
  });
  const brokerStatesRef = useRef<Record<BrokerKey, BrokerState>>({
    nkis: defaultBrokerState(),
    octx: defaultBrokerState(),
  });

  const [broker, setBrokerState] = useState<BrokerKey>('nkis');
  const [symbol, setSymbol] = useState('');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [adxMin, setAdxMin] = useState(23);
  const [atrSl, setAtrSl] = useState(1.5);
  const [tpMult, setTpMult] = useState(3.0);
  const [stochBuy, setStochBuy] = useState(70);
  const [stochSell, setStochSell] = useState(30);
  const [beEnabled, setBeEnabled] = useState(true);
  const [beMult, setBeMult] = useState(1.0);
  const [trEnabled, setTrEnabled] = useState(false);
  const [trMult, setTrMult] = useState(2.0);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  const switchBroker = useCallback((next: BrokerKey) => {
    if (next === broker) return;
    // save current
    brokerStatesRef.current[broker] = {
      symbol, symbolQuery, direction, dateFrom, dateTo,
      adxMin, atrSl, tpMult, stochBuy, stochSell,
      beEnabled, beMult, trEnabled, trMult, result,
    };
    // restore next
    const s = brokerStatesRef.current[next];
    setSymbol(s.symbol); setSymbolQuery(s.symbolQuery); setDirection(s.direction);
    setDateFrom(s.dateFrom); setDateTo(s.dateTo);
    setAdxMin(s.adxMin); setAtrSl(s.atrSl); setTpMult(s.tpMult); setStochBuy(s.stochBuy); setStochSell(s.stochSell);
    setBeEnabled(s.beEnabled); setBeMult(s.beMult); setTrEnabled(s.trEnabled); setTrMult(s.trMult);
    setResult(s.result); setError(null);
    setBrokerState(next);
  }, [broker, symbol, symbolQuery, direction, dateFrom, dateTo, adxMin, atrSl, tpMult, stochBuy, stochSell, beEnabled, beMult, trEnabled, trMult, result]);

  const setDatePreset = useCallback((years: number | 'all') => {
    if (years === 'all') { setDateFrom(''); setDateTo(''); return; }
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - years);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDateFrom(iso(from)); setDateTo(iso(to));
  }, []);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const r = await fetch('https://ointment-handcraft-payee.ngrok-free.dev/health', {
          method: 'GET',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        setServerOnline(r.ok);
      } catch {
        setServerOnline(false);
      }
    };
    checkServer();
    const id = setInterval(checkServer, 30000);
    return () => clearInterval(id);
  }, []);

  const [histSymbol, setHistSymbol] = useState('');
  const [histBroker, setHistBroker] = useState<'all' | BrokerKey>('all');

  const symbolsForBroker = useMemo(
    () => {
      const specs = CONTRACT_SPECS.filter(s => s.broker === broker);
      if (broker !== 'octx') return specs.map(s => s.symbol);
      // OCTX operativo: solo Forex, Índices y Metales/Energía (XAU, XAG, XTI, XNG).
      // Excluye acciones y ETFs.
      return specs
        .filter(s => {
          const t = classifyInstrument(s.symbol).type;
          return t === 'forex' || t === 'index' || t === 'metal' || t === 'energy';
        })
        .map(s => s.symbol);
    },
    [broker]
  );
  const symbolSuggestions = useMemo(() => {
    if (!symbolQuery) return [];
    const q = symbolQuery.toUpperCase();
    return symbolsForBroker.filter(s => s.toUpperCase().includes(q)).slice(0, 8);
  }, [symbolQuery, symbolsForBroker]);

  const sessionsQuery = useQuery({
    queryKey: ['backtest_sessions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('backtest_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SavedSession[];
    },
  });

  const filteredSessions = useMemo(() => {
    const list = sessionsQuery.data ?? [];
    return list.filter(s => {
      if (histBroker !== 'all' && s.broker !== histBroker) return false;
      if (histSymbol && !s.symbol.toUpperCase().includes(histSymbol.toUpperCase())) return false;
      return true;
    });
  }, [sessionsQuery.data, histSymbol, histBroker]);

  async function runBacktest() {
    setError(null);
    if (!symbol) { setError('Selecciona un símbolo'); return; }
    if (!user) { setError('Sesión no iniciada'); return; }

    const params: BacktestParams = {
      symbol,
      direction,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      adx_min: adxMin,
      atr_sl: atrSl,
      tp_mult: tpMult,
      stoch_buy: stochBuy,
      stoch_sell: stochSell,
      breakeven_enabled: beEnabled,
      breakeven_mult: beMult,
      trailing_enabled: trEnabled,
      trailing_mult: trMult,
    };

    const payload = {
      symbol,
      direction: direction === 'BUY' ? 1 : -1,
      date_from: dateFrom ? dateFrom : null,
      date_to: dateTo ? dateTo : null,
      adx_min: Number(adxMin),
      atr_mult: Number(atrSl),
      tp_mult: Number(tpMult),
      stoch_buy: Number(stochBuy),
      stoch_sell: Number(stochSell),
      use_be: Boolean(beEnabled),
      be_mult: Number(beMult),
      use_trail: Boolean(trEnabled),
      trail_mult: Number(trMult),
    };

    setRunning(true);
    setResult(null);
    try {
      console.log('[backtest] POST payload:', JSON.stringify(payload, null, 2));
      const res = await fetch(`${SERVER_URL}/backtest/${broker}`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[backtest] Server error', res.status, errText);
        throw new Error(`HTTP ${res.status} — ${errText || 'sin detalle'}`);
      }
      const raw = await res.json();
      const data = normalizeBacktestResult(raw);
      setResult(data);

      const { error: insertErr } = await (supabase as any).from('backtest_sessions').insert({
        user_id: user.id,
        symbol,
        broker,
        direction,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        params,
        metrics: data.metrics ?? {},
        equity_curve: data.equity_curve ?? [],
        trades: data.trades ?? [],
      });
      if (insertErr) {
        toast.error(`Backtest OK pero no se guardó: ${insertErr.message}`);
      } else {
        toast.success(`Sesión guardada: ${symbol} (${(data.trades ?? []).length} trades)`);
      }
      qc.invalidateQueries({ queryKey: ['backtest_sessions'] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Error del servidor: ${msg}`);
      console.error('[backtest] Fetch failed:', e);
    } finally {
      setRunning(false);
    }
  }


  async function deleteSession(id: string) {
    await (supabase as any).from('backtest_sessions').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['backtest_sessions'] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Backtester</h1>
        <p className="text-base text-muted-foreground mt-1">Ejecuta y guarda backtests del sistema CAP Trend Following</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Cuenta */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Cuenta</span>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {(['nkis', 'octx'] as BrokerKey[]).map(b => (
                <button
                  key={b}
                  onClick={() => switchBroker(b)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    broker === b
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {b === 'nkis' ? 'NK' : 'OX'}
                </button>
              ))}
            </div>
          </div>

          {/* Símbolo — picker estilo Radar */}
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground font-medium">Símbolo</Label>
            <RadarSymbolPicker
              broker={broker}
              selected={symbol}
              onSelect={(s) => { setSymbol(s); setSymbolQuery(s); }}
            />
            {symbol && (
              <div className="mt-2 text-xs text-primary">
                Seleccionado: <span className="font-data font-semibold">{symbol}</span>
              </div>
            )}
          </div>

          {/* Dirección */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Dirección</span>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {(['BUY', 'SELL'] as Direction[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    direction === d
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-transparent text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>


          {/* Fechas */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {([
                { l: 'Último año', y: 1 as const },
                { l: 'Últimos 3 años', y: 3 as const },
                { l: 'Últimos 10 años', y: 10 as const },
                { l: 'Todo el historial', y: 'all' as const },
              ]).map(p => (
                <button
                  key={p.l}
                  type="button"
                  onClick={() => setDatePreset(p.y)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  {p.l}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Desde (opcional)</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Hasta (opcional)</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <SliderRow label="ADX mínimo" value={adxMin} min={15} max={35} step={1} onChange={setAdxMin} />
            <SliderRow label="ATR × SL" value={atrSl} min={1.0} max={3.0} step={0.1} decimals={1} onChange={setAtrSl} />
            <SliderRow label="Take Profit (× ATR)" value={tpMult} min={1.0} max={6.0} step={0.1} decimals={1} onChange={setTpMult} />
            <SliderRow label="Stoch BUY nivel" value={stochBuy} min={60} max={85} step={1} onChange={setStochBuy} />
            <SliderRow label="Stoch SELL nivel" value={stochSell} min={15} max={40} step={1} onChange={setStochSell} />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <ToggleSliderRow
              label="Breakeven" enabled={beEnabled} onToggle={setBeEnabled}
              value={beMult} min={0.5} max={2.0} step={0.1} onChange={setBeMult} suffix="×"
            />
            <ToggleSliderRow
              label="Trailing ATR" enabled={trEnabled} onToggle={setTrEnabled}
              value={trMult} min={1.0} max={3.0} step={0.1} onChange={setTrMult} suffix="×"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button onClick={runBacktest} disabled={running || !symbol} className="w-full" size="lg">
            <Play className="w-4 h-4" />
            {running ? 'Ejecutando…' : 'Ejecutar Backtest'}
          </Button>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${serverOnline === null ? 'bg-muted-foreground' : serverOnline ? 'bg-emerald-500' : 'bg-destructive'}`} />
            {serverOnline === null ? 'Comprobando servidor…' : serverOnline ? 'Servidor online' : 'Servidor offline — abre RUN_BACKTEST_SERVER.bat en tu PC'}
          </div>
        </CardContent>
      </Card>

      {result && (
        <ResultsView
          result={result}
          exportMeta={{ symbol, broker, direction }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de sesiones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Filtrar por símbolo…"
              value={histSymbol}
              onChange={e => setHistSymbol(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex gap-1 p-0.5 rounded-md bg-secondary">
              {(['all', 'nkis', 'octx'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setHistBroker(b)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    histBroker === b
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {b === 'all' ? 'Todos' : b.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {sessionsQuery.isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
          {!sessionsQuery.isLoading && filteredSessions.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin sesiones guardadas.</p>
          )}
          <div className="space-y-2">
            {filteredSessions.map(s => (
              <SessionRow key={s.id} session={s} onDelete={() => deleteSession(s.id)} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, decimals = 0 }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono font-semibold text-primary">{value.toFixed(decimals)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={v => onChange(v[0])} />
    </div>
  );
}

function ToggleSliderRow({ label, enabled, onToggle, value, min, max, step, onChange, suffix = '' }: {
  label: string; enabled: boolean; onToggle: (v: boolean) => void;
  value: number; min: number; max: number; step: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5 items-center">
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onToggle} />
          <Label className="text-xs">{label}</Label>
        </div>
        <span className="text-xs font-mono font-semibold text-primary">{value.toFixed(1)}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={v => onChange(v[0])} disabled={!enabled} />
    </div>
  );
}

function ResultsView({ result, exportMeta }: { result: BacktestResult; exportMeta?: { symbol: string; broker: string; direction: string } }) {
  const m = result.metrics ?? {};
  const trades = result.trades ?? [];
  const equity = result.equity_curve ?? [];
  const resultsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const analysis = useMemo(() => computeAnalysis(trades, equity), [trades, equity]);
  const initialEquity = equity[0]?.equity ?? 0;
  const finalEquity = equity[equity.length - 1]?.equity ?? initialEquity;
  const equityUp = finalEquity >= initialEquity;
  const lineColor = equityUp ? 'hsl(var(--success))' : 'hsl(var(--destructive))';

  const handleExportPdf = async () => {
    const el = resultsRef.current;
    if (!el || !exportMeta) return;
    setExporting(true);
    try {
      await exportPdfBySections(
        el,
        `backtest_${exportMeta.symbol}_${exportMeta.broker}_${exportMeta.direction}.pdf`
      );
    } catch (e) {
      console.error('[exportPDF] failed', e);
      toast.error('Error al exportar el PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card id="backtest-results" ref={resultsRef}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Resultados</CardTitle>
        {exportMeta && (
          <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting} data-html2canvas-ignore="true">
            <FileText className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Exportar PDF'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Métricas principales */}
        <div data-pdf-section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="PnL Total" value={fmtUsd(analysis.pnlTotal)} positive={analysis.pnlTotal >= 0} />
          <Metric label="Win Rate" value={fmtPct(m.win_rate)} />
          <Metric label="Profit Factor" value={fmtNum(m.profit_factor)} />
          <Metric label="Sharpe" value={fmtNum(m.sharpe)} />
          <Metric label="Trades" value={String(m.trades ?? trades.length)} />
          <Metric label="Drawdown Máx" value={`${fmtPct(analysis.maxDdPct)} · ${fmtUsd(-analysis.maxDdUsd)}`} positive={false} />
          <Metric label="Expectancy" value={fmtUsd(analysis.expectancy)} positive={analysis.expectancy >= 0} />
          <Metric label="Duración media" value={`${analysis.avgDays.toFixed(1)} d`} />
          <Metric label="MFE medio" value={fmtUsd(analysis.avgMfe)} />
          <Metric label="Salidas STOCH" value={fmtPct(analysis.exitPct.STOCH)} />
          <Metric label="Salidas SL" value={fmtPct(analysis.exitPct.SL)} positive={false} />
          <Metric label="Salidas BE" value={fmtPct(analysis.exitPct.BE)} />
          <Metric label="Trades revertidos" value={`${analysis.reverted} (${fmtPct(analysis.revertedPct)})`} positive={false} />
        </div>

        {/* Curva de equity */}
        {equity.length > 0 && (
          <div data-pdf-section>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Curva de equity</div>
            <div className="h-64 rounded-md overflow-hidden" style={{ background: CHART_BG }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={equity} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={equityUp ? COLORS.green : COLORS.red} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={equityUp ? COLORS.green : COLORS.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} domain={['auto', 'auto']} tickFormatter={(v) => `$${Math.round(v).toLocaleString('es-ES')}`} />
                  <Tooltip {...tooltipProps} formatter={(v: number) => fmtUsd(v)} />
                  <ReferenceLine y={initialEquity} stroke={COLORS.axis} strokeDasharray="4 4" label={{ value: 'Balance inicial', position: 'right', fontSize: 10, fill: COLORS.axis }} />
                  <Area type="monotone" dataKey="equity" stroke="none" fill="url(#equityFill)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="equity" stroke={equityUp ? COLORS.green : COLORS.red} strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ¿Qué mejoraría? */}
        {trades.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">¿Qué mejoraría?</h3>
              <p className="text-xs text-muted-foreground">Análisis avanzado para identificar puntos débiles del sistema.</p>
            </div>

            <div data-pdf-section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Captura MFE" value={fmtPct(analysis.mfeCaptureRatio)} positive={analysis.mfeCaptureRatio >= 0.6} />
              <Metric label="Racha ganadora máx" value={String(analysis.maxWinStreak)} />
              <Metric label="Racha perdedora máx" value={String(analysis.maxLossStreak)} positive={false} />
              <Metric label="Mejor / Peor trade" value={`${fmtUsd(analysis.bestTrade)} / ${fmtUsd(analysis.worstTrade)}`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Distribución de salidas */}
              <ChartCard title="Distribución de salidas">
                <BarChart data={analysis.exitDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis dataKey="reason" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {analysis.exitDist.map((d, i) => (
                      <Cell key={i} fill={exitColor(d.reason)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartCard>

              {/* Curva de rachas */}
              <ChartCard title="Balance trade a trade (rachas)">
                <ComposedChart data={analysis.runningBalance}>
                  <defs>
                    <linearGradient id="streakFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis dataKey="i" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} tickFormatter={(v) => `$${Math.round(v).toLocaleString('es-ES')}`} />
                  <Tooltip {...tooltipProps} formatter={(v: number) => fmtUsd(v)} />
                  <ReferenceLine y={0} stroke={COLORS.axis} strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="balance" stroke="none" fill="url(#streakFill)" isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const color = (payload?.balance ?? 0) >= 0 ? COLORS.green : COLORS.red;
                      return <circle key={index} cx={cx} cy={cy} r={3} fill={color} stroke={color} />;
                    }}
                  />
                </ComposedChart>
              </ChartCard>

              {/* Histograma duración */}
              <ChartCard title="Histograma de duración (días)">
                <BarChart data={analysis.durationHist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="count" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>

              {/* Scatter PnL vs MFE */}
              <ChartCard title="PnL vs MFE (dinero dejado encima de la mesa)">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis type="number" dataKey="mfe" name="MFE" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} tickFormatter={(v) => `$${Math.round(v)}`} />
                  <YAxis type="number" dataKey="pnl" name="PnL" tick={{ fontSize: 10, fill: COLORS.axis }} stroke={COLORS.grid} tickFormatter={(v) => `$${Math.round(v)}`} />
                  <ZAxis range={[40, 40]} />
                  <ReferenceLine
                    segment={[
                      { x: analysis.scatterMin, y: analysis.scatterMin },
                      { x: analysis.scatterMax, y: analysis.scatterMax },
                    ]}
                    stroke={COLORS.yellow}
                    strokeDasharray="4 4"
                  />
                  <Tooltip {...tooltipProps} formatter={(v: number) => fmtUsd(v)} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={analysis.scatter}>
                    {analysis.scatter.map((p, i) => (
                      <Cell key={i} fill={p.pnl >= 0 ? COLORS.green : COLORS.red} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ChartCard>
            </div>
          </div>
        )}

        {trades.length > 0 && <TradesTable trades={trades} />}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div data-pdf-section className="border border-border rounded-md p-3 bg-secondary/30">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function exitColor(reason: string) {
  const r = reason.toUpperCase();
  if (r.includes('STOCH')) return COLORS.green;
  if (r.includes('SL')) return COLORS.red;
  if (r.includes('BE')) return COLORS.yellow;
  if (r.includes('TRAIL')) return COLORS.purple;
  return COLORS.gray;
}

function normalizeReason(raw: string | undefined): string {
  const r = (raw ?? '').toUpperCase().trim();
  if (r.includes('STOCH') || r.includes('SIGNAL') || r.includes('CROSS') || r.includes('EXIT')) return 'STOCH';
  if (r.includes('BREAKEVEN') || r === 'BE' || r.includes('_BE') || r.includes('BE_')) return 'BE';
  if (r.includes('TRAIL')) return 'TRAIL';
  if (r.includes('SL') || r.includes('STOP') || r.includes('LOSS')) return 'SL';
  // El sistema solo sale por SL o STOCH: cualquier salida no clasificada se asume STOCH (take por señal)
  return 'STOCH';
}

function computeAnalysis(trades: BacktestTrade[], equity: BacktestResult['equity_curve']) {
  const n = trades.length;
  const pnlTotal = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const avgDays = n ? trades.reduce((s, t) => s + (t.days ?? 0), 0) / n : 0;
  const avgMfe = n ? trades.reduce((s, t) => s + (t.mfe ?? 0), 0) / n : 0;
  const expectancy = n ? pnlTotal / n : 0;

  // Drawdown sobre equity_curve
  let peak = equity[0]?.equity ?? 0;
  let maxDdUsd = 0;
  let maxDdPct = 0;
  for (const p of equity) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak - p.equity;
    if (dd > maxDdUsd) {
      maxDdUsd = dd;
      maxDdPct = peak > 0 ? dd / peak : 0;
    }
  }

  // Distribución salidas
  const reasonCount: Record<string, number> = { STOCH: 0, SL: 0, BE: 0, TRAIL: 0 };
  for (const t of trades) {
    const r = normalizeReason(t.reason);
    reasonCount[r] = (reasonCount[r] ?? 0) + 1;
  }
  const exitDist = Object.entries(reasonCount).map(([reason, count]) => ({ reason, count }));
  const exitPct = {
    STOCH: n ? reasonCount.STOCH / n : 0,
    SL: n ? reasonCount.SL / n : 0,
    BE: n ? reasonCount.BE / n : 0,
    TRAIL: n ? (reasonCount.TRAIL ?? 0) / n : 0,
  };

  // Trades revertidos: MFE > 0 favorable y cerraron en SL con pnl < 0
  const reverted = trades.filter(t => (t.mfe ?? 0) > 0 && (t.pnl ?? 0) < 0 && normalizeReason(t.reason) === 'SL').length;
  const revertedPct = n ? reverted / n : 0;

  // Captura MFE
  const mfeCaptureRatio = avgMfe > 0 ? Math.max(0, expectancy / avgMfe) : 0;

  // Rachas
  let curW = 0, curL = 0, maxWinStreak = 0, maxLossStreak = 0;
  for (const t of trades) {
    if ((t.pnl ?? 0) >= 0) { curW++; curL = 0; if (curW > maxWinStreak) maxWinStreak = curW; }
    else { curL++; curW = 0; if (curL > maxLossStreak) maxLossStreak = curL; }
  }

  // Running balance trade a trade
  let bal = 0;
  const runningBalance = trades.map((t, i) => { bal += (t.pnl ?? 0); return { i: i + 1, balance: Math.round(bal * 100) / 100 }; });

  // Histograma duración
  const buckets = [
    { bucket: '0-1d', min: 0, max: 1 },
    { bucket: '2-3d', min: 2, max: 3 },
    { bucket: '4-7d', min: 4, max: 7 },
    { bucket: '8-14d', min: 8, max: 14 },
    { bucket: '15-30d', min: 15, max: 30 },
    { bucket: '>30d', min: 31, max: Infinity },
  ];
  const durationHist = buckets.map(b => ({
    bucket: b.bucket,
    count: trades.filter(t => (t.days ?? 0) >= b.min && (t.days ?? 0) <= b.max).length,
  }));

  // Scatter
  const scatter = trades.map(t => ({ mfe: t.mfe ?? 0, pnl: t.pnl ?? 0 }));
  const allVals = scatter.flatMap(p => [p.mfe, p.pnl]);
  const scatterMin = allVals.length ? Math.min(...allVals, 0) : 0;
  const scatterMax = allVals.length ? Math.max(...allVals, 0) : 0;

  const bestTrade = trades.reduce((m, t) => Math.max(m, t.pnl ?? 0), 0);
  const worstTrade = trades.reduce((m, t) => Math.min(m, t.pnl ?? 0), 0);

  return {
    pnlTotal, expectancy, avgDays, avgMfe,
    maxDdUsd, maxDdPct,
    exitDist, exitPct,
    reverted, revertedPct,
    mfeCaptureRatio,
    maxWinStreak, maxLossStreak,
    runningBalance,
    durationHist,
    scatter, scatterMin, scatterMax,
    bestTrade, worstTrade,
  };
}

function fmtUsd(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TradesTable({ trades }: { trades: BacktestTrade[] }) {
  const CHUNK = 20;
  const chunks: BacktestTrade[][] = [];
  if (trades.length === 0) {
    chunks.push([]);
  } else {
    for (let i = 0; i < trades.length; i += CHUNK) {
      chunks.push(trades.slice(i, i + CHUNK));
    }
  }
  return (
    <div className="space-y-3">
      {chunks.map((chunk, ci) => (
        <div
          key={ci}
          data-pdf-section
          className="rounded-lg border border-border bg-card overflow-x-auto"
        >
          <table className="w-full text-base">
            <thead className="bg-muted/40 border-b border-border">
              <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Entrada</th>
                <th className="px-3 py-3">Salida</th>
                <th className="px-3 py-3 text-right">Precio</th>
                <th className="px-3 py-3 text-right">SL</th>
                <th className="px-3 py-3 text-right">TP</th>
                <th className="px-3 py-3 text-right">Lotes</th>
                <th className="px-3 py-3 text-right">Días</th>
                <th className="px-3 py-3 text-right">MFE</th>
                <th className="px-3 py-3 text-right">P&L</th>
                <th className="px-3 py-3">Razón</th>
              </tr>
            </thead>
            <tbody>
              {chunk.map((t, idx) => {
                const i = ci * CHUNK + idx;
                const win = t.pnl >= 0;
                const rowBg = win ? 'bg-success/15 hover:bg-success/25' : 'bg-destructive/15 hover:bg-destructive/25';
                const pnlColor = win ? 'text-success' : 'text-destructive';
                const reason = (t.reason ?? '—').toUpperCase();
                const reasonBg = reason.includes('STOCH')
                  ? 'bg-success/30 text-success'
                  : reason.includes('SL') || reason.includes('STOP')
                  ? 'bg-destructive/30 text-destructive'
                  : reason.includes('BE')
                  ? 'bg-warning/30 text-warning'
                  : reason.includes('TRAIL')
                  ? 'bg-primary/30 text-primary'
                  : 'bg-muted/50 text-muted-foreground';
                return (
                  <tr key={i} className={`border-b border-border transition-colors ${rowBg}`}>
                    <td className="px-3 py-3 font-data text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-3 font-data">{fmtDate(t.entry_date)}</td>
                    <td className="px-3 py-3 font-data">{fmtDate(t.exit_date)}</td>
                    <td className="px-3 py-3 font-data text-right">{fmtNum(t.entry_price, 4)}</td>
                    <td className="px-3 py-3 font-data text-right">{fmtNum(t.sl_price, 4)}</td>
                    <td className="px-3 py-3 font-data text-right">{t.tp_price == null ? '—' : fmtNum(t.tp_price, 4)}</td>
                    <td className="px-3 py-3 font-data text-right">{fmtNum(t.lot_size, 2)}</td>
                    <td className="px-3 py-3 font-data text-right">{t.days ?? '—'}</td>
                    <td className="px-3 py-3 font-data text-right">{fmtNum(t.mfe, 2)}</td>
                    <td className={`px-3 py-3 font-data font-bold text-right ${pnlColor}`}>{fmtNum(t.pnl, 2)}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-data font-bold ${reasonBg}`}>{reason}</span>
                    </td>
                  </tr>
                );
              })}
              {chunk.length === 0 && (
                <tr><td colSpan={11} className="p-12 text-center text-muted-foreground text-sm">Sin trades.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}


function SessionRow({ session, onDelete }: { session: SavedSession; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'xlsx'>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const m = session.metrics ?? {};

  const sessionAsResult: BacktestResult = useMemo(() => ({
    metrics: session.metrics ?? {},
    equity_curve: session.equity_curve ?? [],
    trades: session.trades ?? [],
  }), [session]);

  const handlePdf = async () => {
    setBusy('pdf');
    try {
      if (!open) {
        setOpen(true);
        await new Promise(r => setTimeout(r, 600));
      }
      // ensure panelRef is mounted (in case open just toggled)
      for (let i = 0; i < 20 && !panelRef.current; i++) {
        await new Promise(r => setTimeout(r, 50));
      }
      const el = panelRef.current;
      if (!el) {
        toast.error('No se pudo capturar el contenido');
        return;
      }
      await exportPdf(session, el);
    } catch (e) {
      console.error('[handlePdf] failed', e);
      toast.error('Error al exportar el PDF');
    } finally { setBusy(null); }
  };
  const handleXlsx = async () => {
    setBusy('xlsx');
    try {
      await exportXlsx(session);
      toast.success('Excel descargado');
    } catch (e) {
      console.error('[handleXlsx] failed', e);
      toast.error('Error al descargar el archivo Excel');
    } finally { setBusy(null); }
  };

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center gap-2 p-2.5">
        <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs items-center">
          <div className="font-mono font-semibold">{session.symbol}</div>
          <div className="text-muted-foreground">{session.broker.toUpperCase()} · {session.direction}</div>
          <div>WR: <span className="font-mono">{fmtPct(m.win_rate)}</span></div>
          <div>PF: <span className="font-mono">{fmtNum(m.profit_factor)}</span></div>
          <div className={m.pnl != null && m.pnl >= 0 ? 'text-success' : 'text-destructive'}>
            PnL: <span className="font-mono font-semibold">{fmtNum(m.pnl, 2)}</span>
          </div>
          <div className="text-muted-foreground text-[10px]">{new Date(session.created_at).toLocaleString('es-ES')}</div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={handleXlsx} disabled={busy !== null} title="Exportar Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handlePdf} disabled={busy !== null} title="Exportar PDF (mismo aspecto)">
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Eliminar">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {open && (
        <div ref={panelRef} className="border-t border-border p-4 bg-background space-y-3">
          <SessionHeader
            symbol={session.symbol}
            broker={session.broker}
            direction={session.direction}
            dateFrom={session.date_from}
            dateTo={session.date_to}
            createdAt={session.created_at}
            params={session.params}
          />
          <ResultsView result={sessionAsResult} />
        </div>
      )}
    </div>
  );
}

function RadarSymbolPicker({ broker, selected, onSelect }: {
  broker: BrokerKey;
  selected: string;
  onSelect: (s: string) => void;
}) {
  const brokerFilter = broker === 'nkis' ? 'darwinex' : 'octx';
  const all = useUnifiedInstruments(brokerFilter);
  const [filters, setFilters] = useState<RadarFilterState>(EMPTY_FILTERS);

  const annotated = useMemo(() => all.map(it => {
    const cls = classifyFamily(it.symbol);
    return { ...it, _family: cls?.family ?? null, _subfamily: cls?.subfamily ?? null };
  }), [all]);

  const familyCounts = useMemo(() => {
    const c: Partial<Record<Family, number>> = {};
    for (const a of annotated) if (a._family) c[a._family] = (c[a._family] ?? 0) + 1;
    return c;
  }, [annotated]);

  const familyFiltered = useMemo(() => annotated.filter(a => {
    if (filters.family && a._family !== filters.family) return false;
    if (filters.subfamily && a._subfamily !== filters.subfamily) return false;
    return true;
  }), [annotated, filters.family, filters.subfamily]);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { elite: 0, solido: 0, observar: 0 };
    for (const it of familyFiltered) c[tierOfScore(it.score)]++;
    return c;
  }, [familyFiltered]);

  const items = useMemo(() => {
    let arr = familyFiltered;
    if (filters.tier) arr = arr.filter(it => tierOfScore(it.score) === filters.tier);
    if (filters.search.trim()) {
      arr = arr.filter(it => matchSearch(filters.search, [it.symbol, classifyInstrument(it.symbol).description]));
    }
    return [...arr].sort((a, b) => b.score - a.score);
  }, [familyFiltered, filters.tier, filters.search]);

  const availableSubs = useMemo(() => buildSubsList(annotated, filters.family), [annotated, filters.family]);

  const suggestions: Suggestion[] = useMemo(() => annotated.map(it => ({
    value: it.symbol,
    label: it.symbol,
    description: classifyInstrument(it.symbol).description,
  })), [annotated]);

  // Si el usuario teclea (o elige una sugerencia) un símbolo exacto del radar, lo seleccionamos
  useEffect(() => {
    const q = filters.search.trim().toUpperCase();
    if (!q) return;
    const exact = annotated.find(a => a.symbol.toUpperCase() === q);
    if (exact && exact.symbol !== selected) onSelect(exact.symbol);
  }, [filters.search, annotated, selected, onSelect]);

  return (
    <div className="space-y-2">
      <RadarFiltersBar
        state={filters}
        onChange={setFilters}
        totalCount={annotated.length}
        familyCounts={familyCounts}
        availableSubs={availableSubs}
        tierCounts={tierCounts}
        suggestions={suggestions}
      />
      <div className="rounded-md border border-border bg-card max-h-72 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {all.length === 0 ? 'Sin instrumentos del radar para esta cuenta.' : 'Sin resultados con los filtros actuales.'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map(it => {
              const tier = tierOfScore(it.score);
              const tierCls = tier === 'elite'
                ? 'border-l-primary text-primary'
                : tier === 'solido'
                ? 'border-l-success text-success'
                : 'border-l-muted-foreground text-muted-foreground';
              const isSel = selected === it.symbol;
              const desc = classifyInstrument(it.symbol).description;
              return (
                <li key={`${it.symbol}::${it.broker}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(it.symbol)}
                    className={`w-full text-left px-3 py-2 border-l-2 ${tierCls} hover:bg-accent/40 transition-colors flex items-center justify-between gap-2 ${isSel ? 'bg-primary/10' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs">{it.symbol}</span>
                        <span className={`text-[10px] font-bold ${
                          (it.direction ?? '').toLowerCase() === 'alcista' || (it.direction ?? '').toLowerCase() === 'buy'
                            ? 'text-success' : 'text-destructive'
                        }`}>
                          {(it.direction ?? '').toLowerCase() === 'alcista' || (it.direction ?? '').toLowerCase() === 'buy' ? '▲ BUY' : '▼ SELL'}
                        </span>
                      </div>
                      {desc && <div className="text-[10px] text-muted-foreground truncate">{desc}</div>}
                    </div>
                    <div className="text-xs font-data font-bold tabular-nums">{Math.round(it.score)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {items.length} de {annotated.length} instrumentos del radar
      </div>
    </div>
  );
}


function SessionHeader({ symbol, broker, direction, dateFrom, dateTo, createdAt, params }: {
  symbol: string; broker: string; direction: string;
  dateFrom: string | null; dateTo: string | null; createdAt: string;
  params?: BacktestParams;
}) {
  const periodo = dateFrom || dateTo
    ? `${dateFrom ?? '—'}  →  ${dateTo ?? '—'}`
    : 'Todo el historial disponible';
  return (
    <div className="border border-border rounded-md p-3 bg-secondary/30">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-base font-bold font-mono">{symbol}</div>
          <div className="text-xs text-muted-foreground">
            {broker.toUpperCase()} · {direction} · Periodo: <span className="font-mono">{periodo}</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">
          Generado: {new Date(createdAt).toLocaleString('es-ES')}
        </div>
      </div>
      {params && (
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <div>ADX mín: <span className="font-mono text-foreground">{params.adx_min}</span></div>
          <div>ATR×SL: <span className="font-mono text-foreground">{params.atr_sl}</span></div>
          <div>Stoch BUY: <span className="font-mono text-foreground">{params.stoch_buy}</span></div>
          <div>Stoch SELL: <span className="font-mono text-foreground">{params.stoch_sell}</span></div>
          <div>Breakeven: <span className="font-mono text-foreground">{params.breakeven_enabled ? `ON ×${params.breakeven_mult}` : 'OFF'}</span></div>
          <div>Trailing: <span className="font-mono text-foreground">{params.trailing_enabled ? `ON ×${params.trailing_mult}` : 'OFF'}</span></div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const colorClass = positive == null ? 'text-foreground' : positive ? 'text-success' : 'text-destructive';
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-2xl font-data font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}


function fmtNum(v: number | null | undefined, decimals = 2) {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  const val = Math.abs(v) <= 1 ? v * 100 : v;
  return `${val.toFixed(1)}%`;
}
function fmtDate(s: string | undefined) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return s; }
}

async function exportXlsx(session: SavedSession) {
  const wb = XLSX.utils.book_new();
  const trades = session.trades ?? [];
  const equity = session.equity_curve ?? [];
  const a = computeAnalysis(trades, equity);

  const p = session.params ?? ({} as Partial<BacktestParams>);
  const meta: any[][] = [
    ['BACKTEST — Resultado completo'],
    [],
    ['Símbolo', session.symbol],
    ['Broker', session.broker],
    ['Dirección', session.direction],
    ['Periodo desde', session.date_from ?? 'Todo el historial'],
    ['Periodo hasta', session.date_to ?? 'Todo el historial'],
    ['Creado', new Date(session.created_at).toLocaleString('es-ES')],
    [],
    ['— Parámetros —'],
    ['ADX mínimo', p.adx_min ?? ''],
    ['ATR × SL', p.atr_sl ?? ''],
    ['Stoch BUY', p.stoch_buy ?? ''],
    ['Stoch SELL', p.stoch_sell ?? ''],
    ['Breakeven', p.breakeven_enabled ? `ON ×${p.breakeven_mult}` : 'OFF'],
    ['Trailing', p.trailing_enabled ? `ON ×${p.trailing_mult}` : 'OFF'],
    [],
    ['— Métricas principales —'],
    ['PnL Total', a.pnlTotal],
    ['Win Rate', session.metrics?.win_rate ?? ''],
    ['Profit Factor', session.metrics?.profit_factor ?? ''],
    ['Sharpe', session.metrics?.sharpe ?? ''],
    ['Trades', session.metrics?.trades ?? trades.length],
    ['Drawdown Máx %', a.maxDdPct],
    ['Drawdown Máx USD', a.maxDdUsd],
    ['Expectancy', a.expectancy],
    ['Duración media (d)', a.avgDays],
    ['MFE medio', a.avgMfe],
    ['Salidas STOCH %', a.exitPct.STOCH],
    ['Salidas SL %', a.exitPct.SL],
    ['Salidas BE %', a.exitPct.BE],
    ['Salidas TRAIL %', a.exitPct.TRAIL],
    ['Trades revertidos', a.reverted],
    ['Trades revertidos %', a.revertedPct],
    [],
    ['— ¿Qué mejoraría? —'],
    ['Captura MFE', a.mfeCaptureRatio],
    ['Racha ganadora máx', a.maxWinStreak],
    ['Racha perdedora máx', a.maxLossStreak],
    ['Mejor trade', a.bestTrade],
    ['Peor trade', a.worstTrade],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trades), 'Trades');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(equity), 'Equity');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(a.exitDist), 'Distribución salidas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(a.durationHist), 'Duración (histograma)');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(a.runningBalance), 'Balance trade a trade');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(a.scatter), 'Scatter PnL vs MFE');
  XLSX.writeFile(wb, `backtest_${session.symbol}_${session.id.slice(0, 8)}.xlsx`);
}

async function exportPdfBySections(root: HTMLElement, filename: string) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 0;

  let sections = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-section]'));
  if (sections.length === 0) sections = [root];

  let currentY = 0;
  let firstPage = true;

  for (const section of sections) {
    const canvas = await html2canvas(section, {
      backgroundColor: '#0a0e1a',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    // If the section itself is taller than a page, slice it across pages
    if (imgH > pageH) {
      if (!firstPage) { pdf.addPage(); currentY = 0; }
      const pxPerMm = canvas.width / imgW;
      const pageHpx = pageH * pxPerMm;
      let y = 0;
      while (y < canvas.height) {
        const sliceH = Math.min(pageHpx, canvas.height - y);
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = sliceH;
        const ctx = tmp.getContext('2d')!;
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, tmp.width, tmp.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (y > 0) pdf.addPage();
        pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', margin, 0, imgW, sliceH / pxPerMm);
        y += sliceH;
      }
      currentY = pageH; // force new page for next section
      firstPage = false;
      continue;
    }

    if (!firstPage && currentY + imgH > pageH) {
      pdf.addPage();
      currentY = 0;
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, currentY, imgW, imgH);
    currentY += imgH + 3;
    firstPage = false;
  }

  pdf.save(filename);
}

async function exportPdf(session: SavedSession, node: HTMLElement) {
  try {
    await exportPdfBySections(node, `backtest_${session.symbol}_${session.id.slice(0, 8)}.pdf`);
  } catch (e) {
    console.error('[exportPdf] failed', e);
    toast.error('No se pudo exportar el PDF');
  }
}
