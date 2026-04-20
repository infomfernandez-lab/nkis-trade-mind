import { Eye, Trash2, TrendingUp, TrendingDown, Star, Zap, AlertCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useWatchlist, useDeleteWatchlistItem, useUpdateWatchlistItem, type WatchlistItem } from '@/hooks/use-watchlist';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';

interface Props {
  openSymbols: Set<string>;
  brokerFilter: string;
}

interface EnrichedItem extends WatchlistItem {
  pullback: boolean;
  stochZone: 'overbought' | 'mid' | 'entry' | 'unknown';
  stochValue: number | null;
  signalNear: boolean;
  inEntryZone: boolean;
  inPosition: boolean;
}

function deriveStochZone(value: number | null): 'overbought' | 'mid' | 'entry' | 'unknown' {
  if (value == null) return 'unknown';
  if (value > 70) return 'overbought';
  if (value < 30) return 'entry';
  return 'mid';
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days}d`;
}

export function WatchlistSection({ openSymbols, brokerFilter }: Props) {
  const { data: items, isLoading } = useWatchlist();
  const deleteItem = useDeleteWatchlistItem();
  const updateItem = useUpdateWatchlistItem();

  const enriched: EnrichedItem[] = useMemo(() => {
    let list = (items ?? []).filter(i =>
      i.status === 'Vigilando' ||
      i.status === '⚡ Señal próxima' ||
      i.status === '⭐ En zona entrada' ||
      i.status === 'EN POSICIÓN' ||
      i.status === 'Señal Dada — En posición'
    );
    if (brokerFilter !== 'all') {
      list = list.filter(i => (i.broker ?? 'darwinex').toLowerCase() === brokerFilter);
    }

    return list.map(item => {
      const pullback = (item.watch_reason ?? '').toLowerCase().includes('pullback');
      const stochValue = item.stochastic_level;
      const stochZone = deriveStochZone(stochValue);
      const inPosition = openSymbols.has(item.symbol) || item.status === 'EN POSICIÓN' || item.status === 'Señal Dada — En posición';
      const signalNear = stochZone === 'entry' || stochZone === 'overbought';
      const inEntryZone = stochZone === 'entry' && !inPosition;
      return { ...item, pullback, stochZone, stochValue, signalNear, inEntryZone, inPosition };
    }).sort((a, b) => {
      // Priority: pullback > signal near > score desc
      if (a.pullback !== b.pullback) return a.pullback ? -1 : 1;
      if (a.signalNear !== b.signalNear) return a.signalNear ? -1 : 1;
      return (b.scanner_score ?? 0) - (a.scanner_score ?? 0);
    });
  }, [items, brokerFilter, openSymbols]);

  const nearCount = enriched.filter(i => (i.signalNear || i.pullback) && !i.inPosition).length;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-8">Cargando...</div>;
  }

  if (enriched.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <Eye className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No hay instrumentos en seguimiento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {nearCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 text-sm text-yellow-300">
          <Zap className="w-4 h-4 shrink-0 animate-pulse" />
          <span><span className="font-semibold">{nearCount} instrumento{nearCount > 1 ? 's' : ''}</span> con señal próxima — revisa antes de dormir</span>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/50">
              <TableHead className="text-[10px] uppercase tracking-wider">Símbolo</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider w-[80px] hidden md:table-cell">Broker</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-right w-[80px]">Score</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider w-[110px] hidden md:table-cell">ADX</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider w-[200px]">Stoch Estado</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-right w-[90px] hidden lg:table-cell">Dist MA50</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider w-[90px] hidden lg:table-cell">Añadido</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider w-[140px]">Estado</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider w-[160px] text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enriched.map(item => {
              const isAlcista = item.direction?.toLowerCase() === 'alcista' || item.direction?.toLowerCase() === 'buy';
              const score = item.scanner_score;
              const isElite = score != null && score >= 75;
              const isSolid = score != null && score >= 60 && score < 75;

              const adxState = item.adx_state?.toUpperCase() ?? '';
              const adxColor = adxState === 'ACELERANDO' ? 'text-success'
                : adxState === 'SUBIENDO' ? 'text-yellow-400'
                : adxState === 'ESTABLE' ? 'text-muted-foreground'
                : adxState === 'AGOTANDO' ? 'text-destructive'
                : 'text-muted-foreground';

              const distMa = item.distance_to_ma50;
              const distColor = distMa == null ? 'text-muted-foreground'
                : distMa < 10 ? 'text-success'
                : distMa < 20 ? 'text-orange-400'
                : 'text-destructive';

              // status badge
              let statusLabel: string;
              let statusClasses: string;
              if (item.inPosition) {
                statusLabel = 'EN POSICIÓN';
                statusClasses = 'bg-success/20 text-success border-success/40';
              } else if (item.inEntryZone) {
                statusLabel = '⭐ En zona entrada';
                statusClasses = 'bg-yellow-500/25 text-yellow-300 border-yellow-500/50';
              } else if (item.signalNear || item.pullback) {
                statusLabel = '⚡ Señal próxima';
                statusClasses = 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse';
              } else {
                statusLabel = 'Esperando señal';
                statusClasses = 'bg-muted text-muted-foreground border-border';
              }

              return (
                <TableRow
                  key={item.id}
                  className={item.pullback ? 'bg-yellow-500/[0.04] hover:bg-yellow-500/[0.07]' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {item.pullback && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />}
                      {isAlcista ? (
                        <TrendingUp className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                      )}
                      <span className="font-bold text-sm text-foreground">{item.symbol}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      (item.broker ?? 'darwinex') === 'darwinex'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : 'bg-orange-900/40 text-orange-300 border border-orange-700/50'
                    }`}>
                      {(item.broker ?? 'darwinex') === 'darwinex' ? 'Darwinex' : 'FXPro'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {score != null ? (
                      <span className={`font-data font-bold text-sm inline-flex items-center gap-1 ${
                        isElite ? 'text-yellow-400' : isSolid ? 'text-success' : 'text-muted-foreground'
                      }`}>
                        {isElite && '★'}
                        {isSolid && '●'}
                        {!isElite && !isSolid && '◌'}
                        {score}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.adx_value != null ? (
                      <div className="leading-tight">
                        <div className="font-data text-xs text-foreground">{item.adx_value}</div>
                        {adxState && <div className={`text-[10px] font-semibold ${adxColor}`}>{adxState}</div>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <StochCell zone={item.stochZone} value={item.stochValue} pullback={item.pullback} />
                  </TableCell>
                  <TableCell className={`text-right font-data text-xs hidden lg:table-cell ${distColor}`}>
                    {distMa != null ? `${distMa}%` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                    {timeAgo(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] px-1.5 py-0.5 border font-bold ${statusClasses}`}>
                      {statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {!item.inPosition && (
                        <button
                          onClick={() => {
                            updateItem.mutate({ id: item.id, status: 'EN POSICIÓN' });
                            toast.success(`${item.symbol} marcado en posición`);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-success hover:bg-success/10 border border-success/30 transition-colors"
                        >
                          EN POSICIÓN
                        </button>
                      )}
                      <button
                        onClick={() => {
                          deleteItem.mutate(item.id);
                          toast.success('Retirado de la watchlist');
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
                        title="Retirar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StochCell({ zone, value, pullback }: { zone: 'overbought'|'mid'|'entry'|'unknown'; value: number|null; pullback: boolean }) {
  if (pullback) {
    return (
      <div className="flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
        <span className="text-[11px] text-yellow-300 font-semibold">⭐ PULLBACK ACTIVO</span>
      </div>
    );
  }
  if (zone === 'unknown') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const dot = zone === 'overbought' ? '🔴' : zone === 'entry' ? '🟢' : '🟡';
  const label = zone === 'overbought' ? 'SOBRECOMPRADO' : zone === 'entry' ? 'ZONA ENTRADA' : 'ZONA MEDIA';
  const note = zone === 'overbought' ? 'esperar bajada' : zone === 'entry' ? '⚡ SEÑAL PRÓXIMA' : 'neutral';
  const color = zone === 'overbought' ? 'text-destructive' : zone === 'entry' ? 'text-success' : 'text-yellow-400';
  return (
    <div className="leading-tight">
      <div className={`text-[11px] font-bold ${color} flex items-center gap-1`}>
        <span>{dot}</span>{label}
      </div>
      <div className="text-[10px] text-muted-foreground font-data">
        Stoch ~{value != null ? Math.round(value) : '?'} — {note}
      </div>
    </div>
  );
}
