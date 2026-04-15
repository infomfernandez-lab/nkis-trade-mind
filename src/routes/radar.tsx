import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Radar, Eye, AlertTriangle,
  ChevronDown, ChevronUp, Clock, Check
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useAddToWatchlist, useWatchlist } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { formatDate } from '@/lib/trade-utils';
import { TradingViewChartDialog } from '@/components/TradingViewChart';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Radar — CAP Trading' },
      { name: 'description', content: 'Resultados completos del scanner de instrumentos.' },
    ],
  }),
});

interface ScannerInstrument {
  rank: number;
  symbol: string;
  direction: string;
  score: number;
  adx_value?: number;
  adx_state?: string;
  distance_to_ma50?: number;
  distance_to_ma50_label?: string;
  momentum_20d?: number;
  momentum_aligned?: boolean;
  pendiente_medias?: string;
}

interface Correlation {
  pair: string[];
  value: number;
}

interface ScannerSession {
  id: string;
  session_date: string;
  top_instruments: unknown;
  correlations_detected: unknown;
  notes: string | null;
  user_id: string;
  broker?: string;
}

function useScannerSessions() {
  return useQuery({
    queryKey: ['scanner-sessions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('*')
        .order('session_date', { ascending: false });
      if (error) throw error;
      return data as ScannerSession[];
    },
  });
}

function matchesBroker(session: ScannerSession, broker: string): boolean {
  const val = (session.broker ?? '').toLowerCase();
  if (broker === 'fxpro') return val.includes('fxpro') || val === '';
  // darwinex matches 'darwinex' or empty/missing broker
  return val.includes('darwinex') || val === '';
}

function getLatestForBroker(sessions: ScannerSession[], broker: string): ScannerSession | null {
  // For darwinex, empty broker matches; for fxpro only explicit matches unless broker is empty
  const matching = sessions.filter(s => {
    const val = (s.broker ?? '').toLowerCase();
    if (broker === 'fxpro') return val.includes('fxpro');
    return val.includes('darwinex') || val === '';
  });
  return matching[0] || null;
}

function getHistoryForBroker(sessions: ScannerSession[], broker: string): ScannerSession[] {
  const matching = sessions.filter(s => {
    const val = (s.broker ?? '').toLowerCase();
    if (broker === 'fxpro') return val.includes('fxpro');
    return val.includes('darwinex') || val === '';
  });
  return matching;
}

const ADX_STATE_STYLES: Record<string, string> = {
  'ACELERANDO': 'bg-success/20 text-success',
  'SUBIENDO': 'bg-emerald-400/20 text-emerald-400',
  'ESTABLE': 'bg-yellow-400/20 text-yellow-400',
  'AGOTANDO': 'bg-destructive/20 text-destructive',
};

const MA50_STYLES: Record<string, string> = {
  'MUY CERCA': 'bg-success/20 text-success',
  'CERCA': 'bg-yellow-400/20 text-yellow-400',
  'ALEJADO': 'bg-orange-400/20 text-orange-400',
  'SOBREEXTEND': 'bg-destructive/20 text-destructive',
};

function RadarPage() {
  const { data: sessions, isLoading } = useScannerSessions();
  const { data: watchlistItems } = useWatchlist();
  const { openTrades } = useAllTrades();
  const [broker, setBroker] = useState('darwinex');

  const openSymbols = new Set((openTrades || []).map(t => t.symbol));
  const watchlistSymbols = new Set((watchlistItems || []).map(w => w.symbol));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Radar className="w-5 h-5 text-primary" /> Radar
        </h1>
        <div className="text-sm text-muted-foreground text-center py-16">Cargando...</div>
      </div>
    );
  }

  const allSessions = sessions || [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold flex items-center gap-2">
        <Radar className="w-5 h-5 text-primary" /> Radar
      </h1>

      <Tabs value={broker} onValueChange={setBroker}>
        <TabsList>
          <TabsTrigger value="darwinex">Darwinex</TabsTrigger>
          <TabsTrigger value="fxpro">FXPro</TabsTrigger>
        </TabsList>

        <TabsContent value="darwinex">
          <BrokerScanView sessions={allSessions} broker="darwinex" openSymbols={openSymbols} watchlistSymbols={watchlistSymbols} />
        </TabsContent>
        <TabsContent value="fxpro">
          <BrokerScanView sessions={allSessions} broker="fxpro" openSymbols={openSymbols} watchlistSymbols={watchlistSymbols} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrokerScanView({ sessions, broker, openSymbols, watchlistSymbols }: {
  sessions: ScannerSession[];
  broker: string;
  openSymbols: Set<string>;
  watchlistSymbols: Set<string>;
}) {
  const latest = getLatestForBroker(sessions, broker);
  const history = getHistoryForBroker(sessions, broker);
  const [selectedSession, setSelectedSession] = useState<ScannerSession | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chartInstrument, setChartInstrument] = useState<ScannerInstrument | null>(null);

  const activeSession = selectedSession || latest;

  if (!activeSession) {
    return (
      <div className="text-center py-16 space-y-2">
        <Radar className="w-10 h-10 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">Sin resultados para este broker.</p>
        <p className="text-xs text-muted-foreground">
          Ejecuta el scanner y sincroniza con SYNC_{broker.toUpperCase()}.bat
        </p>
      </div>
    );
  }

  const instruments: ScannerInstrument[] = Array.isArray(activeSession.top_instruments)
    ? (activeSession.top_instruments as unknown as ScannerInstrument[]).slice(0, 20)
    : [];

  const correlations: Correlation[] = Array.isArray(activeSession.correlations_detected)
    ? (activeSession.correlations_detected as unknown as Correlation[])
    : [];

  return (
    <div className="space-y-4 mt-4">
      {/* Date/time */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Última sesión: <span className="font-data font-semibold text-foreground">{formatDate(activeSession.session_date)}</span></span>
        {selectedSession && (
          <button onClick={() => setSelectedSession(null)} className="ml-2 text-xs text-primary hover:underline">
            ← Volver a la última
          </button>
        )}
      </div>

      {/* Correlation warnings */}
      {correlations.length > 0 && (
        <div className="space-y-2">
          {correlations.map((c, i) => (
            <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold text-yellow-400">Correlación detectada:</span>{' '}
                {c.pair?.join(' y ')} ({c.value?.toFixed(2)}) — operar los dos duplica el riesgo
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table header */}
      {instruments.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Sin instrumentos en esta sesión.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="hidden lg:grid grid-cols-[3rem_1fr_5.5rem_4.5rem_9rem_9rem_5.5rem_5rem_6rem_6.5rem] items-center px-3 py-2 bg-muted/50 text-xs text-muted-foreground font-medium border-b border-border">
            <span>#</span>
            <span>Símbolo</span>
            <span>Dir.</span>
            <span>Score</span>
            <span>ADX</span>
            <span>Dist MA50</span>
            <span>Mom.</span>
            <span>Pend.</span>
            <span>Estado</span>
            <span className="text-right">Acción</span>
          </div>
          <div className="divide-y divide-border">
            {instruments.map((inst, i) => (
              <InstrumentRow
                key={`${inst.symbol}-${i}`}
                instrument={inst}
                index={i}
                isOpen={openSymbols.has(inst.symbol)}
                isWatched={watchlistSymbols.has(inst.symbol)}
                onClickChart={() => setChartInstrument(inst)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {activeSession.notes && (
        <div className="p-3 rounded-md bg-secondary text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Notas:</span> {activeSession.notes}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
            {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Historial de Sesiones ({history.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 mt-2">
              {history.map(s => {
                const count = Array.isArray(s.top_instruments) ? (s.top_instruments as unknown[]).length : 0;
                const isActive = s.id === activeSession.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    <span className="font-data">{formatDate(s.session_date)}</span>
                    <span className="text-xs">{count} instrumentos</span>
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <TradingViewChartDialog
        open={!!chartInstrument}
        onOpenChange={(open) => { if (!open) setChartInstrument(null); }}
        instrument={chartInstrument}
        broker={broker}
      />
    </div>
  );
}

function InstrumentRow({ instrument: inst, index, isOpen, isWatched, onClickChart }: {
  instrument: ScannerInstrument;
  index: number;
  isOpen: boolean;
  isWatched: boolean;
  onClickChart: () => void;
}) {
  const addToWatchlist = useAddToWatchlist();
  const { user } = useAuth();
  const isAlcista = inst.direction?.toLowerCase() === 'alcista' || inst.direction?.toLowerCase() === 'buy';
  const adxStyle = ADX_STATE_STYLES[inst.adx_state?.toUpperCase() || ''] || 'bg-muted text-muted-foreground';
  const ma50Style = MA50_STYLES[inst.distance_to_ma50_label?.toUpperCase() || ''] || 'bg-muted text-muted-foreground';
  const isEven = index % 2 === 0;

  const handleWatch = () => {
    if (!user) return;
    addToWatchlist.mutate({
      symbol: inst.symbol,
      direction: isAlcista ? 'alcista' : 'bajista',
      watch_reason: `Desde Radar — Score ${inst.score}/100`,
      stochastic_level: null,
      scanner_score: inst.score,
      adx_value: inst.adx_value ?? null,
      adx_state: inst.adx_state ?? null,
      distance_to_ma50: inst.distance_to_ma50 ?? null,
      status: 'Vigilando',
      added_from_scanner: true,
      trade_id: null,
    }, {
      onSuccess: () => toast.success(`${inst.symbol} añadido a la watchlist`),
      onError: () => toast.error('Error al añadir a watchlist'),
    });
  };

  return (
    <div className={`
      ${isEven ? 'bg-card' : 'bg-muted/20'}
      ${isOpen ? 'border-l-2 border-l-yellow-400' : ''}
      hover:bg-accent/50 transition-colors
    `}>
      {/* Desktop row */}
      <div className="hidden lg:grid grid-cols-[3rem_1fr_5.5rem_4.5rem_9rem_9rem_5.5rem_5rem_6rem_6.5rem] items-center px-3 py-2.5">
        {/* Rank */}
        <span className="font-mono font-bold text-sm text-yellow-400">#{inst.rank}</span>

        {/* Symbol */}
        <span className="font-semibold text-sm text-foreground">{inst.symbol}</span>

        {/* Direction */}
        <span>
          <Badge className={`text-[10px] px-1.5 py-0 border ${isAlcista ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
            {isAlcista ? 'ALCISTA' : 'BAJISTA'}
          </Badge>
        </span>

        {/* Score */}
        <span className="font-data font-bold text-base text-yellow-400">
          {inst.score}<span className="text-xs text-muted-foreground font-normal">/100</span>
        </span>

        {/* ADX */}
        <span className="flex items-center gap-1.5 text-xs">
          {inst.adx_value != null ? (
            <>
              <span className="font-data font-semibold text-foreground">{inst.adx_value}</span>
              {inst.adx_state && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${adxStyle}`}>
                  {inst.adx_state}
                </span>
              )}
            </>
          ) : <span className="text-muted-foreground">—</span>}
        </span>

        {/* Dist MA50 */}
        <span className="flex items-center gap-1.5 text-xs">
          {inst.distance_to_ma50 != null ? (
            <>
              <span className="font-data text-foreground">{inst.distance_to_ma50}%</span>
              {inst.distance_to_ma50_label && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ma50Style}`}>
                  {inst.distance_to_ma50_label}
                </span>
              )}
            </>
          ) : <span className="text-muted-foreground">—</span>}
        </span>

        {/* Momentum */}
        <span className="text-xs font-data">
          {inst.momentum_20d != null ? (
            <>
              {inst.momentum_20d}%{' '}
              <span className={inst.momentum_aligned ? 'text-success' : 'text-destructive'}>
                {inst.momentum_aligned ? '✓' : '✗'}
              </span>
            </>
          ) : <span className="text-muted-foreground">—</span>}
        </span>

        {/* Pendiente */}
        <span className="text-xs text-muted-foreground">
          {inst.pendiente_medias || '—'}
        </span>

        {/* Status badges */}
        <span>
          {isOpen && (
            <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/40 border">
              EN POSICIÓN
            </Badge>
          )}
        </span>

        {/* Action */}
        <span className="text-right">
          {isWatched ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <Check className="w-3 h-3" /> Vigilando
            </span>
          ) : (
            <button
              onClick={handleWatch}
              disabled={addToWatchlist.isPending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3 h-3" />
              Vigilar +
            </button>
          )}
        </span>
      </div>

      {/* Mobile row */}
      <div className="lg:hidden px-3 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-sm text-yellow-400 w-8">#{inst.rank}</span>
          <span className="font-semibold text-sm text-foreground flex-1">{inst.symbol}</span>
          <Badge className={`text-[10px] px-1.5 py-0 border ${isAlcista ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
            {isAlcista ? 'ALCISTA' : 'BAJISTA'}
          </Badge>
          <span className="font-data font-bold text-base text-yellow-400">
            {inst.score}<span className="text-xs text-muted-foreground font-normal">/100</span>
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs">
          {inst.adx_value != null && (
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">ADX</span>
              <span className="font-data font-semibold">{inst.adx_value}</span>
              {inst.adx_state && <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${adxStyle}`}>{inst.adx_state}</span>}
            </span>
          )}
          {inst.distance_to_ma50 != null && (
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">MA50</span>
              <span className="font-data">{inst.distance_to_ma50}%</span>
              {inst.distance_to_ma50_label && <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${ma50Style}`}>{inst.distance_to_ma50_label}</span>}
            </span>
          )}
          {inst.momentum_20d != null && (
            <span className="font-data">
              Mom {inst.momentum_20d}% <span className={inst.momentum_aligned ? 'text-success' : 'text-destructive'}>{inst.momentum_aligned ? '✓' : '✗'}</span>
            </span>
          )}
          {inst.pendiente_medias && <span className="text-muted-foreground">{inst.pendiente_medias}</span>}
          {isOpen && (
            <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/40 border">EN POSICIÓN</Badge>
          )}
        </div>
        <div className="flex justify-end">
          {isWatched ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <Check className="w-3 h-3" /> Vigilando
            </span>
          ) : (
            <button
              onClick={handleWatch}
              disabled={addToWatchlist.isPending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3 h-3" /> Vigilar +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
