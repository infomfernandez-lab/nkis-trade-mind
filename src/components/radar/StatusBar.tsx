import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, AlertTriangle } from 'lucide-react';
import { useAllTrades } from '@/hooks/use-trades';
import { filterByBroker, type BrokerFilter } from '@/lib/trade-utils';

interface ScannerSessionMeta {
  id: string;
  session_date: string;
  broker: string | null;
  vix: number | null;
  created_at: string;
}

function useLatestScannerSessions() {
  return useQuery({
    queryKey: ['scanner-sessions-meta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('id, session_date, broker, vix, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ScannerSessionMeta[];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

function latestForBroker(rows: ScannerSessionMeta[], broker: 'darwinex' | 'octx') {
  return rows.find(r => {
    const v = (r.broker ?? '').toLowerCase();
    if (broker === 'octx') return v.includes('octx') || v.includes('octx');
    return v.includes('darwinex') || v.includes('nkis') || v === '';
  }) ?? null;
}

function dateTimeShort(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 24 * 3600 * 1000;
}

interface Props {
  brokerFilter: BrokerFilter;
}

export function StatusBar({ brokerFilter }: Props) {
  const { data: sessions } = useLatestScannerSessions();
  const { openTrades } = useAllTrades();

  const darwinex = sessions ? latestForBroker(sessions, 'darwinex') : null;
  const octx = sessions ? latestForBroker(sessions, 'octx') : null;

  // VIX comes from whichever scanner ran today; prefer the active broker's scan
  const vixSource = brokerFilter === 'octx' ? octx : (darwinex ?? octx);
  const vix = vixSource?.vix ?? null;

  const vixColor = vix == null ? 'text-muted-foreground'
    : vix < 25 ? 'text-success'
    : vix <= 35 ? 'text-orange-400'
    : 'text-destructive';
  const vixLabel = vix == null ? 'SIN DATOS'
    : vix < 25 ? 'OPERABLE ✓'
    : vix <= 35 ? 'PRECAUCIÓN'
    : 'BLOQUEADO ✗';

  const dwOpen = filterByBroker(openTrades, 'darwinex').length;
  const fxOpen = filterByBroker(openTrades, 'octx').length;

  const dwStale = darwinex ? isStale(darwinex.created_at) : true;
  const octxStale = octx ? isStale(octx.created_at) : true;

  const showDarwinex = brokerFilter !== 'octx';
  const showOctx = brokerFilter !== 'darwinex';

  return (
    <div className="sticky top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {/* VIX */}
        <div className="flex items-center gap-1.5">
          <Activity className={`w-3.5 h-3.5 ${vixColor}`} />
          <span className="text-muted-foreground">VIX</span>
          <span className={`font-data font-bold ${vixColor}`}>{vix != null ? vix : '—'}</span>
          <span className={`text-[10px] font-bold ${vixColor}`}>{vixLabel}</span>
        </div>

        <span className="text-muted-foreground/40">|</span>

        {/* Open positions per broker */}
        {showDarwinex && (
          <span className="text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800 mr-1">NKIS</span>
            <span className="font-data font-bold text-foreground">{dwOpen}</span> pos
          </span>
        )}
        {showOctx && (
          <span className="text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-900/40 text-orange-300 border border-orange-700/50 mr-1">OCTX</span>
            <span className="font-data font-bold text-foreground">{fxOpen}</span> pos
          </span>
        )}

        <span className="text-muted-foreground/40 hidden md:inline">|</span>

        {/* Last scan */}
        <span className="text-muted-foreground hidden md:inline">
          Último scan:{' '}
          {showDarwinex && (
            <>
              NKIS{' '}
              {darwinex ? (
                <span className={`font-data ${dwStale ? 'text-destructive' : 'text-foreground'}`}>{dateTimeShort(darwinex.session_date ?? darwinex.created_at)}</span>
              ) : <span className="text-destructive font-data">—</span>}
            </>
          )}
          {showDarwinex && showOctx && ' · '}
          {showOctx && (
            <>
              OCTX{' '}
              {octx ? (
                <span className={`font-data ${octxStale ? 'text-destructive' : 'text-foreground'}`}>{timeShort(octx.created_at)}</span>
              ) : <span className="text-destructive font-data">—</span>}
            </>
          )}
        </span>

        <span className="text-muted-foreground/40 hidden lg:inline">|</span>
        <span className="hidden lg:inline text-[10px] text-muted-foreground italic">
          Scanner v18 — Medias+Estructura+Stoch(14,3,3)+ADX
        </span>

        {((showDarwinex && dwStale) || (showOctx && octxStale)) && (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
            <AlertTriangle className="w-3 h-3" /> SCANNER DESACTUALIZADO
          </span>
        )}
      </div>
    </div>
  );
}
