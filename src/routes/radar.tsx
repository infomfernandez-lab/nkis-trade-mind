import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Radar, Eye, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useAddToWatchlist } from '@/hooks/use-watchlist';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { formatDate } from '@/lib/trade-utils';

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

function getLatestForBroker(sessions: ScannerSession[], broker: string): ScannerSession | null {
  // Try matching broker field first, then fallback to first session if no broker field exists
  const withBroker = sessions.filter(s => (s as any).broker === broker);
  if (withBroker.length > 0) return withBroker[0];
  // If no sessions have broker field, show all for 'darwinex' tab as default
  if (broker === 'darwinex') {
    const withoutBroker = sessions.filter(s => !(s as any).broker);
    return withoutBroker[0] || null;
  }
  return null;
}

function getHistoryForBroker(sessions: ScannerSession[], broker: string): ScannerSession[] {
  const withBroker = sessions.filter(s => (s as any).broker === broker);
  if (withBroker.length > 0) return withBroker;
  if (broker === 'darwinex') {
    return sessions.filter(s => !(s as any).broker);
  }
  return [];
}

const ADX_COLORS: Record<string, string> = {
  'ACELERANDO': 'text-success',
  'SUBIENDO': 'text-emerald-400',
  'ESTABLE': 'text-yellow-400',
  'AGOTANDO': 'text-destructive',
};

const MA50_COLORS: Record<string, string> = {
  'MUY CERCA': 'text-success',
  'CERCA': 'text-emerald-400',
  'ALEJADO': 'text-yellow-400',
  'SOBREEXTEND': 'text-destructive',
};

function RadarPage() {
  const { data: sessions, isLoading } = useScannerSessions();
  const [broker, setBroker] = useState('darwinex');

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
          <BrokerScanView sessions={allSessions} broker="darwinex" />
        </TabsContent>
        <TabsContent value="fxpro">
          <BrokerScanView sessions={allSessions} broker="fxpro" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BrokerScanView({ sessions, broker }: { sessions: ScannerSession[]; broker: string }) {
  const latest = getLatestForBroker(sessions, broker);
  const history = getHistoryForBroker(sessions, broker);
  const [selectedSession, setSelectedSession] = useState<ScannerSession | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

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
          <button
            onClick={() => setSelectedSession(null)}
            className="ml-2 text-xs text-primary hover:underline"
          >
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

      {/* Instruments grid */}
      {instruments.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Sin instrumentos en esta sesión.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {instruments.map((inst, i) => (
            <InstrumentCard key={`${inst.symbol}-${i}`} instrument={inst} />
          ))}
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
    </div>
  );
}

function InstrumentCard({ instrument: inst }: { instrument: ScannerInstrument }) {
  const addToWatchlist = useAddToWatchlist();
  const { user } = useAuth();
  const isAlcista = inst.direction?.toLowerCase() === 'alcista' || inst.direction?.toLowerCase() === 'buy';
  const adxColor = ADX_COLORS[inst.adx_state?.toUpperCase() || ''] || 'text-muted-foreground';
  const ma50Color = MA50_COLORS[inst.distance_to_ma50_label?.toUpperCase() || ''] || 'text-muted-foreground';

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
    <div className={`rounded-lg border p-3 transition-colors ${
      isAlcista ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-data text-muted-foreground">#{inst.rank}</span>
        <Badge className={`text-[10px] px-1.5 py-0 ${isAlcista ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
          {isAlcista ? 'ALCISTA' : 'BAJISTA'}
        </Badge>
      </div>

      {/* Symbol */}
      <div className="font-semibold text-base mb-1">{inst.symbol}</div>

      {/* Score */}
      <div className="text-2xl font-bold font-data text-yellow-400 mb-3">
        {inst.score}<span className="text-xs text-muted-foreground font-normal">/100</span>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 text-xs">
        {inst.adx_value != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ADX</span>
            <span className={`font-data font-semibold ${adxColor}`}>
              {inst.adx_value} {inst.adx_state && <span className="text-[10px]">({inst.adx_state})</span>}
            </span>
          </div>
        )}
        {inst.distance_to_ma50 != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dist MA50</span>
            <span className={`font-data ${ma50Color}`}>
              {inst.distance_to_ma50}% {inst.distance_to_ma50_label && <span className="text-[10px]">({inst.distance_to_ma50_label})</span>}
            </span>
          </div>
        )}
        {inst.momentum_20d != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Momentum 20d</span>
            <span className="font-data">
              {inst.momentum_20d}%{' '}
              <span className={inst.momentum_aligned ? 'text-success' : 'text-destructive'}>
                {inst.momentum_aligned ? '✓' : '✗'}
              </span>
            </span>
          </div>
        )}
        {inst.pendiente_medias && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pendiente</span>
            <span className={`font-data ${inst.pendiente_medias === 'AMBAS' ? 'text-success' : inst.pendiente_medias === 'UNA' ? 'text-yellow-400' : 'text-destructive'}`}>
              {inst.pendiente_medias}
            </span>
          </div>
        )}
      </div>

      {/* Watch button */}
      <button
        onClick={handleWatch}
        disabled={addToWatchlist.isPending}
        className="mt-3 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        <Eye className="w-3 h-3" />
        Vigilar +
      </button>
    </div>
  );
}
