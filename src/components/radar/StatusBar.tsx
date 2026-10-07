import { AlertTriangle } from 'lucide-react';
import { useEscanerFoto, fotoDesactualizada, fmtFecha } from '@/hooks/use-escaner';
import type { BrokerFilter } from '@/lib/trade-utils';

export function StatusBar(_: { brokerFilter?: BrokerFilter }) {
  const { data: foto } = useEscanerFoto();
  const stale = fotoDesactualizada(foto?.fecha_datos);
  const n = foto?.datos?.filas?.length ?? 0;

  return (
    <div className="-mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/85 border-b border-border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {foto ? (
          <span className="text-muted-foreground">
            Datos al <span className={`font-data font-bold ${stale ? 'text-destructive' : 'text-foreground'}`}>{fmtFecha(foto.fecha_datos)}</span>
            {' · '}generado <span className="font-data text-foreground">{fmtFecha(foto.generado ?? foto.created_at)}</span>
            {' · '}<span className="font-data text-foreground">{n}</span> mercados
          </span>
        ) : (
          <span className="text-muted-foreground">Último scan: <span className="text-destructive font-data">—</span></span>
        )}
        {stale && (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
            <AlertTriangle className="w-3 h-3" /> SCANNER DESACTUALIZADO
          </span>
        )}
      </div>
    </div>
  );
}
