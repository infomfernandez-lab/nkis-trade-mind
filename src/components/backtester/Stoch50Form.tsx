import { useCallback, useMemo, useState } from 'react';
import { CONTRACT_SPECS } from '@/lib/contract-specs';

import { useQuery } from '@tanstack/react-query';
import { Play, AlertTriangle } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SliderRow, ToggleSliderRow } from './controls';
import { SERVER_URL, normalizeBacktestResult, type BacktestResult } from './backtest-api';

interface Props {
  onResult: (r: BacktestResult | null, symbol: string) => void;
}

export default function Stoch50Form({ onResult }: Props) {
  const [symbol, setSymbol] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [riesgoPct, setRiesgoPct] = useState(0.8);
  const [atrSl, setAtrSl] = useState(1.5);
  const [beEnabled, setBeEnabled] = useState(false);
  const [beMult, setBeMult] = useState(1.0);
  const [trEnabled, setTrEnabled] = useState(false);
  const [trMult, setTrMult] = useState(1.5);
  const [maxRiesgo, setMaxRiesgo] = useState(6.0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbolsQuery = useQuery({
    queryKey: ['stoch50_symbols'],
    queryFn: async () => {
      const res = await fetch(`${SERVER_URL}/symbols/stoch50`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const list: any[] = Array.isArray(raw) ? raw : (raw?.symbols ?? []);
      return list.map((s) => (typeof s === 'string' ? s : String(s?.symbol ?? ''))).filter(Boolean);
    },
  });

  // Todos los instrumentos disponibles: los que devuelve el servidor primero,
  // y a continuación el resto del catálogo OCTX para poder probarlos igualmente.
  const allSymbols = useMemo(() => {
    const fromServer = symbolsQuery.data ?? [];
    const seen = new Set(fromServer.map(s => s.toUpperCase()));
    const extra = CONTRACT_SPECS
      .filter(s => s.broker === 'octx' && !seen.has(s.symbol.toUpperCase()))
      .map(s => s.symbol);
    return [...fromServer, ...Array.from(new Set(extra))];
  }, [symbolsQuery.data]);


  const setDatePreset = useCallback((years: number | 'all') => {
    if (years === 'all') { setDateFrom(''); setDateTo(''); return; }
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - years);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDateFrom(iso(from)); setDateTo(iso(to));
  }, []);

  async function run() {
    setError(null);
    if (!symbol) { setError('Selecciona un símbolo'); return; }
    const payload = {
      symbol,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      riesgo_pct: Number(riesgoPct),
      atr_mult_sl: Number(atrSl),
      use_be: Boolean(beEnabled),
      be_mult: Number(beMult),
      use_trail: Boolean(trEnabled),
      trail_mult: Number(trMult),
      max_riesgo_total_pct: Number(maxRiesgo),
    };
    setRunning(true);
    onResult(null, symbol);
    try {
      const res = await fetch(`${SERVER_URL}/backtest/stoch50`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${errText || 'sin detalle'}`);
      }
      onResult(normalizeBacktestResult(await res.json()), symbol);
    } catch (e) {
      setError(`Error del servidor: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuración — Stoch 50 Cruce</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Reglas fijas del sistema: </span>
          Entrada: Stoch(5,3,3) cruza el nivel 50, con las 2 velas anteriores al otro lado + medias 50/200 alineadas
          + precio en el lado correcto. Salida: SL fijo (ATR×mult) y TP fijo por la distancia entre el precio y la MA50
          en el momento de la señal. Sin ADX como filtro. Permite varias posiciones simultáneas en el mismo símbolo.
        </div>

        {/* Símbolo */}
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground font-medium">Símbolo</Label>
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-full sm:max-w-xs">
              <SelectValue placeholder={symbolsQuery.isLoading ? 'Cargando símbolos…' : 'Selecciona un símbolo'} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {(symbolsQuery.data ?? []).map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {symbolsQuery.isError && (
            <p className="mt-1.5 text-[11px] text-destructive">No se pudo cargar la lista de símbolos del servidor.</p>
          )}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <SliderRow label="Riesgo por operación (%)" value={riesgoPct} min={0.2} max={3.0} step={0.1} decimals={1} onChange={setRiesgoPct} />
          <SliderRow label="ATR × SL" value={atrSl} min={0.5} max={4.0} step={0.1} decimals={1} onChange={setAtrSl} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <ToggleSliderRow
            label="Breakeven" enabled={beEnabled} onToggle={setBeEnabled}
            value={beMult} min={0.5} max={2.0} step={0.1} onChange={setBeMult} suffix="×"
          />
          <ToggleSliderRow
            label="Trailing ATR" enabled={trEnabled} onToggle={setTrEnabled}
            value={trMult} min={0.5} max={4.0} step={0.1} onChange={setTrMult} suffix="×"
          />
        </div>

        <div className="pt-2">
          <SliderRow label="Riesgo total máximo (%)" value={maxRiesgo} min={2.0} max={15.0} step={0.5} decimals={1} onChange={setMaxRiesgo} />
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
            Este sistema permite varias posiciones a la vez en el mismo símbolo — este límite frena el riesgo conjunto
            de todas las que estén abiertas.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button onClick={run} disabled={running || !symbol} className="w-full" size="lg">
          <Play className="w-4 h-4" />
          {running ? 'Ejecutando…' : 'Ejecutar Backtest'}
        </Button>
      </CardContent>
    </Card>
  );
}
