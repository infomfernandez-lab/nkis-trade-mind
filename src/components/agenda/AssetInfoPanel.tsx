import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getContractSpec } from '@/lib/contract-specs';

interface Props {
  symbol: string;
  broker?: string | null;
}

export function AssetInfoPanel({ symbol, broker }: Props) {
  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', symbol, broker ?? null],
    queryFn: async () => {
      let q = supabase.from('assets').select('*').eq('symbol', symbol);
      if (broker) q = q.eq('broker', broker);
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const spec = getContractSpec(symbol);

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="font-bold text-base">{symbol}</div>
        {(asset?.description || spec?.description) && (
          <div className="text-xs text-muted-foreground">{asset?.description ?? spec?.description}</div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando datos del escáner…
        </div>
      ) : asset ? (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Escáner</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Familia" value={asset.familia} />
            <Field label="Sector" value={asset.sector} />
            <Field label="Broker" value={asset.broker?.toUpperCase()} />
            <Field label="Último score" value={asset.last_score != null ? Number(asset.last_score).toFixed(2) : null} />
            <Field label="Dirección" value={asset.last_direction} />
            <Field label="ADX" value={asset.last_adx != null ? Number(asset.last_adx).toFixed(1) : null} />
            <Field label="ATR estado" value={asset.last_atr_state} />
            <Field label="Stoch" value={asset.last_stoch != null ? Number(asset.last_stoch).toFixed(1) : null} />
            <Field label="Precio" value={asset.last_price != null ? Number(asset.last_price).toFixed(4) : null} />
            <Field
              label="Último scan"
              value={asset.last_seen_scanner
                ? new Date(asset.last_seen_scanner).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
                : null}
            />
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">Sin datos del escáner para este activo.</div>
      )}

      {spec && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contrato</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Tick" value={spec.tickSize} />
            <Field label="Tick value" value={`${spec.tickValue} ${spec.profitCurrency}`} />
            <Field label="Contract size" value={spec.contractSize} />
            <Field label="Volume min" value={spec.volumeMin} />
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-data">{value != null && value !== '' ? value : '—'}</div>
    </div>
  );
}
