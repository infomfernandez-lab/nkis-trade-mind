import { Eye, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWatchlist, useDeleteWatchlistItem } from '@/hooks/use-watchlist';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  openSymbols: Set<string>;
  brokerFilter: string;
}

interface ScannerRow {
  broker: string | null;
  top_instruments: unknown;
}

function useBrokerSymbols() {
  return useQuery({
    queryKey: ['watchlist-broker-symbols'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scanner_sessions')
        .select('broker, top_instruments')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      const darwinex = new Set<string>();
      const fxpro = new Set<string>();
      (data as ScannerRow[]).forEach((row) => {
        const b = (row.broker ?? '').toLowerCase();
        const target = b.includes('fxpro') ? fxpro : darwinex;
        if (Array.isArray(row.top_instruments)) {
          (row.top_instruments as Array<{ symbol?: string }>).forEach((inst) => {
            if (inst?.symbol) target.add(inst.symbol);
          });
        }
      });
      return { darwinex, fxpro };
    },
    staleTime: 60_000,
  });
}

export function WatchlistSection({ openSymbols, brokerFilter }: Props) {
  const { data: items, isLoading } = useWatchlist();
  const { data: brokerSymbols } = useBrokerSymbols();
  const deleteItem = useDeleteWatchlistItem();

  // Filter to "Vigilando" status items only
  let watching = (items ?? []).filter(i =>
    i.status === 'Vigilando' || i.status === 'Señal Dada — En posición'
  );

  // Filter by broker (inferred from scanner sessions)
  if (brokerFilter !== 'all' && brokerSymbols) {
    const set = brokerFilter === 'fxpro' ? brokerSymbols.fxpro : brokerSymbols.darwinex;
    watching = watching.filter(i => set.has(i.symbol));
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Cargando...</div>;
  }

  if (watching.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <Eye className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No hay instrumentos en seguimiento</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/50">
            <TableHead className="text-[10px] uppercase tracking-wider">Símbolo</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider w-[70px]">Dir.</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-right w-[60px]">Score</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-right w-[70px]">ADX</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-right w-[80px]">Dist MA50</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider text-right w-[80px]">Momentum</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider w-[100px]">Añadido</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider w-[120px]">Estado</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider w-[100px]">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {watching.map(item => {
            const isAlcista = item.direction?.toLowerCase() === 'alcista' || item.direction?.toLowerCase() === 'buy';
            const inPosition = openSymbols.has(item.symbol);

            return (
              <TableRow key={item.id} className={inPosition ? 'border-l-2 border-l-yellow-400' : ''}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {isAlcista ? (
                      <TrendingUp className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                    )}
                    <span className="font-bold text-sm text-foreground">{item.symbol}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`text-[10px] px-1.5 py-0 border ${isAlcista ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
                    {isAlcista ? 'ALCISTA' : 'BAJISTA'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-data text-xs">
                  {item.scanner_score != null ? <span className="text-yellow-400 font-semibold">{item.scanner_score}</span> : '—'}
                </TableCell>
                <TableCell className="text-right font-data text-xs">
                  {item.adx_value != null ? (
                    <span>{item.adx_value} {item.adx_state && <span className="text-[10px] text-muted-foreground">({item.adx_state})</span>}</span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right font-data text-xs">
                  {item.distance_to_ma50 != null ? `${item.distance_to_ma50}%` : '—'}
                </TableCell>
                <TableCell className="text-right font-data text-xs text-muted-foreground">—</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString('es-ES')}
                </TableCell>
                <TableCell>
                  {inPosition ? (
                    <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/40 border font-bold">
                      EN POSICIÓN
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Esperando señal</span>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => {
                      deleteItem.mutate(item.id);
                      toast.success('Eliminado de la watchlist');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Dejar de vigilar
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
