import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Radar, Eye, AlertTriangle, ChevronDown, ChevronUp, Clock, Check,
  RefreshCw, Crosshair, BarChart3, Star, TrendingUp, TrendingDown,
} from 'lucide-react';
import { WatchlistSection } from '@/components/radar/WatchlistSection';
import { OpenPositionsSection } from '@/components/radar/OpenPositionsSection';
import { AnchorNav, type AnchorItem } from '@/components/radar/AnchorNav';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useAddToWatchlist, useWatchlist } from '@/hooks/use-watchlist';
import { useAllTrades } from '@/hooks/use-trades';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { formatDate } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Radar — CAP Trading' },
      { name: 'description', content: 'Centro de mando del scanner de instrumentos.' },
    ],
  }),
});

interface ScannerInstrumentRaw {
  rank?: number;
  symbol: string;
  direction: string;
  score: number;
  adx?: number;
  adx_value?: number;
  adx_state?: string;
  dist_ma50?: number;
  distance_to_ma50?: number;
  distance_to_ma50_label?: string;
  momentum?: number;
  momentum_20d?: number;
  momentum_aligned?: boolean;
  pendiente?: string;
  pendiente_medias?: string;
  // Nuevos campos
  pullback_active?: boolean;
  pullback_bars?: number;
  stoch_k?: number;
  trend_age_bars?: number;
  volume?: number;
  atr?: number;
  structure?: string;
  breakout?: string;
}

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
  pullback_active?: boolean;
  pullback_bars?: number;
  stoch_k?: number;
  trend_age_bars?: number;
  volume?: number;
  atr?: number;
  structure?: string;
  breakout?: string;
}

function normalizeInstrument(raw: ScannerInstrumentRaw, index: number): ScannerInstrument {
  return {
    rank: raw.rank ?? index + 1,
    symbol: raw.symbol,
    direction: raw.direction,
    score: raw.score,
    adx_value: raw.adx ?? raw.adx_value,
    adx_state: raw.adx_state,
    distance_to_ma50: raw.dist_ma50 ?? raw.distance_to_ma50,
    distance_to_ma50_label: raw.distance_to_ma50_label,
    momentum_20d: raw.momentum ?? raw.momentum_20d,
    momentum_aligned: raw.momentum_aligned,
    pendiente_medias: raw.pendiente ?? raw.pendiente_medias,
    pullback_active: raw.pullback_active,
    pullback_bars: raw.pullback_bars,
    stoch_k: raw.stoch_k,
    trend_age_bars: raw.trend_age_bars,
    volume: raw.volume,
    atr: raw.atr,
    structure: raw.structure,
    breakout: raw.breakout,
  };
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
  timeframe?: string | null;
  vix?: number | null;
  total_analyzed?: number | null;
  discarded?: number | null;
  tradeable?: number | null;
}

function useScannerSessions() {
  return useQuery({
    queryKey: ['scanner-sessions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ScannerSession[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });
}

function getLatestForBroker(sessions: ScannerSession[], broker: string): ScannerSession | null {
  const matching = sessions.filter(s => {
    const val = (s.broker ?? '').toLowerCase();
    if (broker === 'fxpro') return val.includes('fxpro');
    return val.includes('darwinex') || val === '';
  });
  return matching[0] || null;
}

function getHistoryForBroker(sessions: ScannerSession[], broker: string): ScannerSession[] {
  return sessions.filter(s => {
    const val = (s.broker ?? '').toLowerCase();
    if (broker === 'fxpro') return val.includes('fxpro');
    return val.includes('darwinex') || val === '';
  });
}

function RadarPage() {
  const { broker } = useBrokerFilter();
  const { data: sessions, isLoading, refetch, isFetching } = useScannerSessions();
  const { data: watchlistItems } = useWatchlist();
  const { openTrades } = useAllTrades();

  const openSymbols = new Set((openTrades || []).map(t => t.symbol));
  const watchlistSymbols = new Set((watchlistItems || []).map(w => w.symbol));

  const showDarwinex = broker === 'all' || broker === 'darwinex';
  const showFxpro = broker === 'all' || broker === 'fxpro';

  const anchorItems: AnchorItem[] = useMemo(() => {
    const items: AnchorItem[] = [];
    if (showDarwinex) items.push({ id: 'radar-darwinex', label: 'Radar Darwinex' });
    if (showFxpro) items.push({ id: 'radar-fxpro', label: 'Radar FXPro' });
    items.push({ id: 'vigilando', label: 'Vigilando' });
    items.push({ id: 'posiciones-abiertas', label: 'Posiciones Abiertas' });
    return items;
  }, [showDarwinex, showFxpro]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold flex items-center gap-2">
          <Radar className="w-5 h-5 text-primary" /> Radar
        </h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <AnchorNav items={anchorItems} />

      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-primary" /> Scanner
        </h2>

        {showDarwinex && (
          <section id="radar-darwinex" className="scroll-mt-24">
            <BrokerScanView sessions={allSessions} broker="darwinex" openSymbols={openSymbols} watchlistSymbols={watchlistSymbols} />
          </section>
        )}
        {showFxpro && (
          <section id="radar-fxpro" className="scroll-mt-24">
            <BrokerScanView sessions={allSessions} broker="fxpro" openSymbols={openSymbols} watchlistSymbols={watchlistSymbols} />
          </section>
        )}
      </div>

      <Separator className="my-2" />

      <section id="vigilando" className="space-y-3 scroll-mt-24">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Eye className="w-5 h-5 text-yellow-400" /> Vigilando
        </h2>
        <WatchlistSection openSymbols={openSymbols} brokerFilter={broker} />
      </section>

      <Separator className="my-2" />

      <section id="posiciones-abiertas" className="space-y-3 scroll-mt-24">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Posiciones Abiertas
        </h2>
        <OpenPositionsSection brokerFilter={broker} />
      </section>
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
  const brokerLabel = broker === 'darwinex' ? 'Darwinex' : 'FXPro';

  const activeSession = selectedSession || latest;

  if (!activeSession) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center space-y-2">
        <Radar className="w-10 h-10 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">
          Sin resultados para {brokerLabel}.
        </p>
        <p className="text-xs text-muted-foreground/70">
          Ejecuta el scanner y sube los resultados para ver el radar.
        </p>
      </div>
    );
  }

  const instruments: ScannerInstrument[] = Array.isArray(activeSession.top_instruments)
    ? (activeSession.top_instruments as unknown as ScannerInstrumentRaw[]).slice(0, 30).map((raw, i) => normalizeInstrument(raw, i))
    : [];

  const correlations: Correlation[] = Array.isArray(activeSession.correlations_detected)
    ? (activeSession.correlations_detected as unknown as Correlation[])
    : [];

  // Sort: pullback first, then score desc
  const sorted = [...instruments].sort((a, b) => {
    if (!!a.pullback_active !== !!b.pullback_active) return a.pullback_active ? -1 : 1;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  const elite = sorted.filter(i => i.score >= 75);
  const solid = sorted.filter(i => i.score >= 60 && i.score < 75);
  const observe = sorted.filter(i => i.score >= 40 && i.score < 60);

  return (
    <div className="space-y-4">
      <ScanHeader session={activeSession} brokerLabel={brokerLabel} />

      {selectedSession && (
        <button onClick={() => setSelectedSession(null)} className="text-xs text-primary hover:underline">
          ← Volver a la última sesión
        </button>
      )}

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

      {sorted.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Sin instrumentos en esta sesión.</div>
      ) : (
        <div className="space-y-5">
          <ScanZone
            title="ÉLITE"
            icon="★"
            tone="elite"
            description="Score ≥ 75 — máxima prioridad"
            items={elite}
            openSymbols={openSymbols}
            watchlistSymbols={watchlistSymbols}
            broker={broker}
          />
          <ScanZone
            title="SÓLIDO"
            icon="●"
            tone="solid"
            description="Score 60-74 — operables"
            items={solid}
            openSymbols={openSymbols}
            watchlistSymbols={watchlistSymbols}
            broker={broker}
          />
          <ScanZone
            title="OBSERVAR"
            icon="◌"
            tone="observe"
            description="Score 40-59 — vigilar evolución"
            items={observe}
            openSymbols={openSymbols}
            watchlistSymbols={watchlistSymbols}
            broker={broker}
          />
        </div>
      )}

      {activeSession.notes && (
        <div className="p-3 rounded-md bg-secondary text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Notas:</span> {activeSession.notes}
        </div>
      )}

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

function ScanHeader({ session, brokerLabel }: { session: ScannerSession; brokerLabel: string }) {
  const vix = session.vix;
  const vixColor = vix == null ? 'text-muted-foreground'
    : vix < 25 ? 'text-success'
    : vix <= 35 ? 'text-orange-400'
    : 'text-destructive';

  const brokerBadge = brokerLabel === 'Darwinex'
    ? 'bg-blue-950 text-blue-300 border-blue-800'
    : 'bg-orange-900/40 text-orange-300 border-orange-700/50';

  return (
    <div className="rounded-lg border border-border bg-card p-3 lg:p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-data text-foreground">{formatDate(session.session_date)}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${brokerBadge}`}>{brokerLabel}</span>
        {session.timeframe && (
          <span className="text-muted-foreground">TF: <span className="font-data text-foreground">{session.timeframe}</span></span>
        )}
        {vix != null && (
          <span className="text-muted-foreground">VIX: <span className={`font-data font-bold ${vixColor}`}>{vix}</span></span>
        )}
        {session.total_analyzed != null && (
          <span className="text-muted-foreground">Analizados: <span className="font-data text-foreground">{session.total_analyzed}</span></span>
        )}
        {session.discarded != null && (
          <span className="text-muted-foreground">Descartados: <span className="font-data text-destructive/80">{session.discarded}</span></span>
        )}
        {session.tradeable != null && (
          <span className="text-muted-foreground">Operables: <span className="font-data text-success">{session.tradeable}</span></span>
        )}
      </div>
    </div>
  );
}

function ScanZone({ title, icon, tone, description, items, openSymbols, watchlistSymbols, broker }: {
  title: string;
  icon: string;
  tone: 'elite' | 'solid' | 'observe';
  description: string;
  items: ScannerInstrument[];
  openSymbols: Set<string>;
  watchlistSymbols: Set<string>;
  broker: string;
}) {
  if (items.length === 0) return null;

  const headerColor = tone === 'elite' ? 'text-yellow-400' : tone === 'solid' ? 'text-success' : 'text-muted-foreground';

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className={`font-display text-sm font-bold ${headerColor}`}>{icon} {title}</h3>
        <span className="text-[11px] text-muted-foreground">— {description} ({items.length})</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {items.map((inst, i) => (
          <InstrumentCard
            key={`${inst.symbol}-${i}`}
            instrument={inst}
            tone={tone}
            isOpen={openSymbols.has(inst.symbol)}
            isWatched={watchlistSymbols.has(inst.symbol)}
            broker={broker}
          />
        ))}
      </div>
    </div>
  );
}

const ADX_STATE_STYLES: Record<string, string> = {
  'ACELERANDO': 'bg-success/20 text-success',
  'SUBIENDO': 'bg-emerald-400/20 text-emerald-400',
  'ESTABLE': 'bg-yellow-400/20 text-yellow-400',
  'AGOTANDO': 'bg-destructive/20 text-destructive',
};

function InstrumentCard({ instrument: inst, tone, isOpen, isWatched, broker }: {
  instrument: ScannerInstrument;
  tone: 'elite' | 'solid' | 'observe';
  isOpen: boolean;
  isWatched: boolean;
  broker: string;
}) {
  const addToWatchlist = useAddToWatchlist();
  const { user } = useAuth();
  const isAlcista = inst.direction?.toLowerCase() === 'alcista' || inst.direction?.toLowerCase() === 'buy';
  const adxStyle = ADX_STATE_STYLES[inst.adx_state?.toUpperCase() || ''] || 'bg-muted text-muted-foreground';
  const pullback = !!inst.pullback_active;

  const borderClass = pullback
    ? 'border-yellow-500/60 border-l-[3px] border-l-yellow-400 bg-yellow-500/[0.04]'
    : tone === 'elite'
      ? 'border-yellow-500/40 bg-yellow-500/[0.02]'
      : tone === 'solid'
        ? 'border-success/30'
        : 'border-border';

  const handleWatch = () => {
    if (!user) return;
    addToWatchlist.mutate({
      symbol: inst.symbol,
      direction: isAlcista ? 'alcista' : 'bajista',
      watch_reason: pullback
        ? `Pullback activo — Score ${inst.score}/100`
        : `Desde Radar — Score ${inst.score}/100`,
      stochastic_level: inst.stoch_k ?? null,
      scanner_score: inst.score,
      adx_value: inst.adx_value ?? null,
      adx_state: inst.adx_state ?? null,
      distance_to_ma50: inst.distance_to_ma50 ?? null,
      status: 'Vigilando',
      added_from_scanner: true,
      trade_id: null,
      broker: broker === 'fxpro' ? 'fxpro' : 'darwinex',
    }, {
      onSuccess: () => toast.success(`${inst.symbol} añadido a Vigilando`),
      onError: () => toast.error('Error al añadir a la watchlist'),
    });
  };

  return (
    <div className={`rounded-lg border p-3 ${borderClass} transition-colors`}>
      {/* Línea 1 */}
      <div className="flex items-center gap-2 flex-wrap">
        {pullback && (
          <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/25 text-yellow-300 border-yellow-500/50 border font-bold gap-1">
            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" /> PULLBACK
          </Badge>
        )}
        <span className="font-display font-bold text-base text-foreground">{inst.symbol}</span>
        <Badge className={`text-[10px] px-1.5 py-0 border ${
          isAlcista ? 'bg-success/20 text-success border-success/40' : 'bg-destructive/20 text-destructive border-destructive/40'
        }`}>
          {isAlcista ? <><TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />BUY</> : <><TrendingDown className="w-2.5 h-2.5 inline mr-0.5" />SELL</>}
        </Badge>
        <span className="ml-auto font-data font-bold text-base text-yellow-400">
          {inst.score}<span className="text-[10px] text-muted-foreground font-normal">/100</span>
        </span>
        {isOpen && (
          <Badge className="text-[9px] px-1 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/40 border">POS</Badge>
        )}
      </div>

      {/* Línea 2 */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {inst.adx_value != null && (
          <span>ADX <span className="font-data text-foreground">{inst.adx_value}</span>
            {inst.adx_state && <span className={`ml-1 px-1 rounded text-[9px] font-semibold ${adxStyle}`}>{inst.adx_state}</span>}
          </span>
        )}
        {inst.distance_to_ma50 != null && (
          <span>MA50 <span className="font-data text-foreground">{inst.distance_to_ma50}%</span></span>
        )}
        {inst.momentum_20d != null && (
          <span>Mom <span className={`font-data ${inst.momentum_aligned ? 'text-success' : 'text-destructive'}`}>{inst.momentum_20d}%</span></span>
        )}
        {inst.trend_age_bars != null && (
          <span>Edad <span className="font-data text-foreground">{inst.trend_age_bars}v</span></span>
        )}
      </div>

      {/* Línea 3 */}
      {(inst.volume != null || inst.atr != null || inst.structure || inst.breakout) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {inst.volume != null && <span>Vol <span className="font-data text-foreground">{inst.volume}</span></span>}
          {inst.atr != null && <span>ATR <span className="font-data text-foreground">{Number(inst.atr).toFixed(5)}</span></span>}
          {inst.structure && <span>Estr <span className="text-foreground">{inst.structure}</span></span>}
          {inst.breakout && <span>Rupt <span className="text-foreground">{inst.breakout}</span></span>}
        </div>
      )}

      {/* Línea 4 — pullback alert */}
      {pullback && (
        <div className="mt-2 px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-[11px] text-yellow-300 font-semibold flex items-center gap-1.5">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          ⭐ PULLBACK ACTIVO{inst.pullback_bars ? ` — ${inst.pullback_bars} velas corrigiendo` : ''} — Vigilar estocástico
        </div>
      )}

      {/* Acción */}
      <div className="mt-2 flex justify-end">
        {isWatched ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
            <Check className="w-3 h-3" /> En Vigilando
          </span>
        ) : (
          <button
            onClick={handleWatch}
            disabled={addToWatchlist.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
          >
            <Eye className="w-3 h-3" />
            + Añadir a Vigilando
          </button>
        )}
      </div>
    </div>
  );
}
