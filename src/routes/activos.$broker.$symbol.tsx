import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { assetsSupabase } from '@/components/activos/assets-supabase-client';
import { getContractSpec } from '@/lib/contract-specs';

export const Route = createFileRoute('/activos/$broker/$symbol')({
  component: AssetDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `${params.symbol} — Activos` }],
  }),
});

function AssetDetailPage() {
  const { broker, symbol } = Route.useParams();

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset-detail', symbol, broker],
    queryFn: async () => {
      const { data, error } = await assetsSupabase
        .from('assets')
        .select('*')
        .eq('symbol', symbol)
        .eq('broker', broker)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const spec = getContractSpec(symbol);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Link
        to="/activos"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Activos
      </Link>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="text-sm text-destructive p-4 border border-destructive/40 rounded-md bg-destructive/5">
          Error al cargar: {(error as Error).message}
        </div>
      ) : !asset ? (
        <div className="text-sm text-muted-foreground italic p-8">
          No se encontró el instrumento {symbol} ({broker}).
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                {asset.symbol}
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  {asset.broker}
                </span>
              </h1>
              {(asset.description || spec?.description) && (
                <p className="text-sm text-muted-foreground mt-1">
                  {asset.description ?? spec?.description}
                </p>
              )}
            </div>
            <ScoreBadge score={asset.last_score} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Familia" value={asset.familia} />
            <Stat label="Sector" value={asset.sector} />
            <Stat label="Dirección" value={<DirectionCell value={asset.last_direction} />} />
            <Stat label="ATR estado" value={<AtrBadge value={asset.last_atr_state} />} />
            <Stat label="ADX" value={asset.last_adx != null ? Number(asset.last_adx).toFixed(2) : null} />
            <Stat label="Stoch" value={asset.last_stoch != null ? Number(asset.last_stoch).toFixed(2) : null} />
            <Stat label="Precio" value={asset.last_price != null ? Number(asset.last_price).toFixed(4) : null} />
            <Stat
              label="Activo en escáner"
              value={asset.is_active_scanner ? 'Sí' : 'No'}
            />
            <Stat
              label="Última vez visto"
              value={asset.last_seen_scanner
                ? new Date(asset.last_seen_scanner).toLocaleString('es-ES')
                : null}
            />
          </div>

          {spec && (
            <div className="rounded-md border border-border bg-card p-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Contrato
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label="Tick size" value={spec.tickSize} />
                <Stat label="Tick value" value={`${spec.tickValue} ${spec.profitCurrency}`} />
                <Stat label="Contract size" value={spec.contractSize} />
                <Stat label="Volume min" value={spec.volumeMin} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-data text-sm mt-1">{value != null && value !== '' ? value : '—'}</div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const s = Number(score);
  const cls =
    s >= 75 ? 'bg-yellow-500/15 text-yellow-500 border-yellow-500/40' :
    s >= 60 ? 'bg-success/15 text-success border-success/40' :
    s >= 40 ? 'bg-muted text-muted-foreground border-border' :
    'bg-muted text-muted-foreground border-border';
  const icon = s >= 75 ? '★' : s >= 60 ? '●' : '◌';
  return (
    <div className={`px-3 py-2 rounded-md border ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">Score</div>
      <div className="text-2xl font-bold font-data">{icon} {s.toFixed(0)}</div>
    </div>
  );
}

function DirectionCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toUpperCase();
  if (v === 'ALCISTA') return <span className="inline-flex items-center gap-1 text-success font-semibold"><ArrowUp className="w-3.5 h-3.5" /> ALCISTA</span>;
  if (v === 'BAJISTA') return <span className="inline-flex items-center gap-1 text-destructive font-semibold"><ArrowDown className="w-3.5 h-3.5" /> BAJISTA</span>;
  return <span>{value}</span>;
}

function AtrBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toUpperCase();
  const style =
    v === 'BAJA' ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' :
    v === 'COHERENTE' ? 'bg-muted text-muted-foreground border-border' :
    v === 'ELEVADA' ? 'bg-orange-500/15 text-orange-500 border-orange-500/40' :
    v === 'ANORMAL' ? 'bg-destructive/15 text-destructive border-destructive/40' :
    'bg-muted text-muted-foreground border-border';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${style}`}>{v}</span>;
}
