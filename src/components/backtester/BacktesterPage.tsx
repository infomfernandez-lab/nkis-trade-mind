import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FlaskConical, Play, AlertTriangle, FileSpreadsheet, FileText, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const SERVER_URL = 'https://ointment-handcraft-payee.ngrok-free.dev';

type BrokerKey = 'nkis' | 'octx';
type Direction = 'BUY' | 'SELL';

interface BacktestParams {
  symbol: string;
  direction: Direction;
  date_from?: string;
  date_to?: string;
  adx_min: number;
  atr_sl: number;
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

  const [broker, setBroker] = useState<BrokerKey>('nkis');
  const [symbol, setSymbol] = useState('');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [adxMin, setAdxMin] = useState(23);
  const [atrSl, setAtrSl] = useState(1.5);
  const [stochBuy, setStochBuy] = useState(70);
  const [stochSell, setStochSell] = useState(30);
  const [beEnabled, setBeEnabled] = useState(true);
  const [beMult, setBeMult] = useState(1.0);
  const [trEnabled, setTrEnabled] = useState(true);
  const [trMult, setTrMult] = useState(2.0);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

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
    () => CONTRACT_SPECS.filter(s => s.broker === broker).map(s => s.symbol),
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
      const data = (await res.json()) as BacktestResult;
      setResult(data);

      await (supabase as any).from('backtest_sessions').insert({
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
    <div className="space-y-6 text-sm font-sans">
      <header className="flex items-center gap-3">
        <FlaskConical className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Backtester</h1>
          <p className="text-xs text-muted-foreground">Ejecuta y guarda backtests del sistema CAP Trend Following</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Cuenta */}
          <div>
            <Label className="mb-2 block">Cuenta</Label>
            <div className="flex gap-2">
              {(['nkis', 'octx'] as BrokerKey[]).map(b => (
                <button
                  key={b}
                  onClick={() => { setBroker(b); setSymbol(''); setSymbolQuery(''); }}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    broker === b
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {b === 'nkis' ? 'NKIS' : 'OCTX'}
                </button>
              ))}
            </div>
          </div>

          {/* Símbolo */}
          <div className="relative">
            <Label className="mb-2 block">Símbolo</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={symbolQuery}
                onChange={e => { setSymbolQuery(e.target.value); setSymbol(''); }}
                placeholder={`Buscar entre ${symbolsForBroker.length} instrumentos…`}
                className="pl-8"
              />
            </div>
            {symbol && (
              <div className="mt-1.5 text-xs text-primary">Seleccionado: <span className="font-mono font-semibold">{symbol}</span></div>
            )}
            {symbolQuery && !symbol && symbolSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-64 overflow-y-auto">
                {symbolSuggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSymbol(s); setSymbolQuery(s); }}
                    className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dirección */}
          <div>
            <Label className="mb-2 block">Dirección</Label>
            <div className="flex gap-2">
              {(['BUY', 'SELL'] as Direction[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    direction === d
                      ? d === 'BUY'
                        ? 'bg-success/20 text-success border-success/40'
                        : 'bg-destructive/20 text-destructive border-destructive/40'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
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

          {/* Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <SliderRow label="ADX mínimo" value={adxMin} min={15} max={35} step={1} onChange={setAdxMin} />
            <SliderRow label="ATR × SL" value={atrSl} min={1.0} max={3.0} step={0.1} decimals={1} onChange={setAtrSl} />
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

      {result && <ResultsView result={result} />}

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

function ResultsView({ result }: { result: BacktestResult }) {
  const m = result.metrics ?? {};
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resultados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Metric label="Win Rate" value={fmtPct(m.win_rate)} />
          <Metric label="Profit Factor" value={fmtNum(m.profit_factor)} />
          <Metric label="Sharpe" value={fmtNum(m.sharpe)} />
          <Metric label="PnL" value={fmtNum(m.pnl)} positive={(m.pnl ?? 0) >= 0} />
          <Metric label="Drawdown" value={fmtPct(m.drawdown)} positive={false} />
          <Metric label="Trades" value={String(m.trades ?? result.trades?.length ?? 0)} />
        </div>

        {result.equity_curve?.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.equity_curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {result.trades?.length > 0 && <TradesTable trades={result.trades} />}
      </CardContent>
    </Card>
  );
}

function TradesTable({ trades }: { trades: BacktestTrade[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entrada</TableHead>
            <TableHead>Salida</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Lotes</TableHead>
            <TableHead className="text-right">Días</TableHead>
            <TableHead className="text-right">MFE</TableHead>
            <TableHead className="text-right">PnL</TableHead>
            <TableHead>Razón</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((t, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{fmtDate(t.entry_date)}</TableCell>
              <TableCell className="font-mono text-xs">{fmtDate(t.exit_date)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtNum(t.entry_price, 4)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtNum(t.sl_price, 4)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtNum(t.lot_size, 2)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{t.days ?? '—'}</TableCell>
              <TableCell className="text-right font-mono text-xs">{fmtNum(t.mfe, 2)}</TableCell>
              <TableCell className={`text-right font-mono text-xs font-semibold ${t.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>{fmtNum(t.pnl, 2)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.reason ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SessionRow({ session, onDelete }: { session: SavedSession; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const m = session.metrics ?? {};
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
          <Button size="sm" variant="ghost" onClick={() => exportXlsx(session)} title="Exportar Excel">
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportPdf(session)} title="Exportar PDF">
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Eliminar">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border p-3 space-y-3 bg-secondary/30">
          {session.equity_curve?.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={session.equity_curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {session.trades?.length > 0 && <TradesTable trades={session.trades} />}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const colorClass = positive == null ? 'text-foreground' : positive ? 'text-success' : 'text-destructive';
  return (
    <div className="p-3 rounded-md border border-border bg-secondary/40">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-data font-bold ${colorClass}`}>{value}</div>
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

function exportXlsx(session: SavedSession) {
  const wb = XLSX.utils.book_new();
  const meta = [
    ['Símbolo', session.symbol],
    ['Broker', session.broker],
    ['Dirección', session.direction],
    ['Desde', session.date_from ?? ''],
    ['Hasta', session.date_to ?? ''],
    ['Creado', session.created_at],
    [],
    ['— Métricas —'],
    ...Object.entries(session.metrics ?? {}).map(([k, v]) => [k, v as any]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(session.trades ?? []), 'Trades');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(session.equity_curve ?? []), 'Equity');
  XLSX.writeFile(wb, `backtest_${session.symbol}_${session.id.slice(0, 8)}.xlsx`);
}

function exportPdf(session: SavedSession) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Backtest — ${session.symbol} (${session.broker.toUpperCase()} ${session.direction})`, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date(session.created_at).toLocaleString('es-ES')}`, 14, 22);

  const m = session.metrics ?? {};
  autoTable(doc, {
    startY: 28,
    head: [['Métrica', 'Valor']],
    body: Object.entries(m).map(([k, v]) => [k, String(v)]),
    styles: { fontSize: 8 },
  });

  const trades = session.trades ?? [];
  if (trades.length > 0) {
    autoTable(doc, {
      head: [['Entrada', 'Salida', 'Precio', 'SL', 'Lotes', 'Días', 'MFE', 'PnL', 'Razón']],
      body: trades.map(t => [
        fmtDate(t.entry_date), fmtDate(t.exit_date),
        fmtNum(t.entry_price, 4), fmtNum(t.sl_price, 4),
        fmtNum(t.lot_size, 2), t.days ?? '—',
        fmtNum(t.mfe, 2), fmtNum(t.pnl, 2),
        t.reason ?? '—',
      ]),
      styles: { fontSize: 7 },
    });
  }

  doc.save(`backtest_${session.symbol}_${session.id.slice(0, 8)}.pdf`);
}
