import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { rowToTrade } from '@/lib/trade-utils';
import { classifyInstrument } from '@/lib/instrument-classify';
import { TradeDetail } from './trades';

export const Route = createFileRoute('/trades/$tradeId')({
  component: TradeDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Trade ${params.tradeId.slice(0, 8)} — CAP Trading` }],
  }),
});

function TradeDetailPage() {
  const { tradeId } = Route.useParams();
  const router = useRouter();

  const { data: trade, isLoading, error } = useQuery({
    queryKey: ['trade-detail', tradeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToTrade(data) : null;
    },
  });

  const { data: scannerSessions = [] } = useQuery({
    queryKey: ['scanner_sessions', 'lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('session_date, broker, top_instruments')
        .order('session_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver
      </button>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive p-4 border border-destructive/40 rounded-md bg-destructive/5">
          Error: {(error as Error).message}
        </div>
      ) : !trade ? (
        <div className="text-sm text-muted-foreground italic p-8">
          No se encontró el trade.{' '}
          <Link to="/trades" className="text-primary underline">Volver al registro</Link>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-display font-bold">
                {trade.symbol}{' '}
                <span className="text-sm text-muted-foreground font-normal">
                  — {classifyInstrument(trade.symbol).description}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ticket #{trade.ticket} · {trade.direction} · {trade.broker}
              </p>
            </div>
          </div>
          <TradeDetail trade={trade} scannerSessions={scannerSessions} />
        </>
      )}
    </div>
  );
}
