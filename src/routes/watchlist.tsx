import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Eye, Plus, Trash2, ArrowRightLeft, Loader2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useWatchlist, useAddToWatchlist, useUpdateWatchlistItem, useDeleteWatchlistItem, type WatchlistItem } from '@/hooks/use-watchlist';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export const Route = createFileRoute('/watchlist')({
  component: WatchlistPage,
  head: () => ({
    meta: [
      { title: 'Watchlist — CAP Trading' },
      { name: 'description', content: 'Lista de seguimiento de instrumentos para señales de entrada.' },
    ],
  }),
});

const STATUSES = ['Vigilando', 'Señal Próxima', 'Señal Dada', 'Descartado'] as const;
const STATUS_COLORS: Record<string, string> = {
  'Vigilando': 'bg-primary/10 text-primary',
  'Señal Próxima': 'bg-yellow-500/10 text-yellow-400',
  'Señal Dada': 'bg-success/10 text-success',
  'Descartado': 'bg-muted text-muted-foreground',
};

function WatchlistPage() {
  const { data: items, isLoading } = useWatchlist();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Lista de Seguimiento</h1>
          <p className="text-sm text-muted-foreground mt-1">Instrumentos en vigilancia para señales de entrada</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Añadir a Watchlist
        </button>
      </div>

      {showForm && <AddWatchlistForm onClose={() => setShowForm(false)} />}

      {(!items || items.length === 0) ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Eye className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay instrumentos en la watchlist.</p>
          <p className="text-xs text-muted-foreground mt-1">Añade instrumentos manualmente o desde el panel del Radar en el Dashboard.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map(item => (
            <WatchlistCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function WatchlistCard({ item }: { item: WatchlistItem }) {
  const updateItem = useUpdateWatchlistItem();
  const deleteItem = useDeleteWatchlistItem();
  const [editStoch, setEditStoch] = useState(false);
  const [stochValue, setStochValue] = useState(String(item.stochastic_level ?? ''));

  const isAlcista = item.direction?.toLowerCase() === 'alcista' || item.direction?.toLowerCase() === 'buy';

  // Progress toward signal: buy signal at stoch <= 30, sell at stoch >= 70
  let signalProgress = 0;
  if (item.stochastic_level != null) {
    if (isAlcista) {
      // For buy: signal at 30 or below. Progress = how close from 100 down to 30
      signalProgress = Math.min(100, Math.max(0, ((100 - item.stochastic_level) / 70) * 100));
    } else {
      // For sell: signal at 70 or above. Progress = how close from 0 up to 70
      signalProgress = Math.min(100, Math.max(0, (item.stochastic_level / 70) * 100));
    }
  }

  const handleStochSave = () => {
    const val = parseFloat(stochValue);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      updateItem.mutate({ id: item.id, stochastic_level: val } as any);
      setEditStoch(false);
      toast.success('Estocástico actualizado');
    }
  };

  const handleStatusChange = (status: string) => {
    updateItem.mutate({ id: item.id, status } as any);
    toast.success(`Estado: ${status}`);
  };

  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      isAlcista ? 'border-success/20 bg-card' : 'border-destructive/20 bg-card'
    } ${item.status === 'Descartado' ? 'opacity-50' : ''}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left: Symbol info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {isAlcista ? (
              <TrendingUp className="w-5 h-5 text-success shrink-0" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive shrink-0" />
            )}
            <span className="font-display text-lg font-bold">{item.symbol}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isAlcista ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
              {isAlcista ? 'Alcista' : 'Bajista'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status] || 'bg-muted text-muted-foreground'}`}>
              {item.status}
            </span>
            {item.added_from_scanner && (
              <span className="text-xs text-muted-foreground">📡 Scanner</span>
            )}
          </div>

          {item.watch_reason && (
            <p className="text-sm text-muted-foreground mb-2">{item.watch_reason}</p>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {item.scanner_score != null && (
              <span>Score: <span className="font-data font-semibold text-foreground">{item.scanner_score}/100</span></span>
            )}
            {item.adx_value != null && (
              <span>ADX: <span className="font-data">{item.adx_value} {item.adx_state && `(${item.adx_state})`}</span></span>
            )}
            {item.distance_to_ma50 != null && (
              <span>MA50: <span className="font-data">{item.distance_to_ma50}%</span></span>
            )}
            <span>Añadido: {new Date(item.created_at).toLocaleDateString('es-ES')}</span>
          </div>
        </div>

        {/* Middle: Stochastic + Progress */}
        <div className="w-full lg:w-56 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Estocástico</span>
            {editStoch ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={stochValue}
                  onChange={e => setStochValue(e.target.value)}
                  className="h-6 w-16 text-xs"
                  onKeyDown={e => e.key === 'Enter' && handleStochSave()}
                />
                <button onClick={handleStochSave} className="text-xs text-primary hover:underline">OK</button>
              </div>
            ) : (
              <button
                onClick={() => setEditStoch(true)}
                className="text-xs font-data font-semibold text-foreground hover:text-primary transition-colors"
              >
                {item.stochastic_level != null ? item.stochastic_level.toFixed(1) : '—'}
                <RefreshCw className="w-3 h-3 inline ml-1" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            <Progress value={signalProgress} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{isAlcista ? 'Lejos (100)' : 'Lejos (0)'}</span>
              <span>{isAlcista ? 'Señal (≤30)' : 'Señal (≥70)'}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
          {STATUSES.filter(s => s !== item.status).map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${STATUS_COLORS[s]} hover:opacity-80`}
            >
              {s}
            </button>
          ))}
          {item.status === 'Señal Dada' && !item.trade_id && (
            <Link
              to="/trades"
              className="text-xs px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Ver Trades
            </Link>
          )}
          <button
            onClick={() => {
              deleteItem.mutate(item.id);
              toast.success('Eliminado de la watchlist');
            }}
            className="text-xs px-2.5 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function AddWatchlistForm({ onClose }: { onClose: () => void }) {
  const addItem = useAddToWatchlist();
  const [form, setForm] = useState({
    symbol: '',
    direction: 'alcista',
    watch_reason: '',
    stochastic_level: '',
    scanner_score: '',
    adx_value: '',
    adx_state: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symbol.trim()) return toast.error('Símbolo requerido');
    addItem.mutate({
      symbol: form.symbol.toUpperCase(),
      direction: form.direction,
      watch_reason: form.watch_reason || null,
      stochastic_level: form.stochastic_level ? parseFloat(form.stochastic_level) : null,
      scanner_score: form.scanner_score ? parseFloat(form.scanner_score) : null,
      adx_value: form.adx_value ? parseFloat(form.adx_value) : null,
      adx_state: form.adx_state || null,
      distance_to_ma50: null,
      status: 'Vigilando',
      added_from_scanner: false,
      trade_id: null,
    }, {
      onSuccess: () => {
        toast.success('Añadido a la watchlist');
        onClose();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h3 className="font-display text-sm font-semibold">Nuevo instrumento</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Símbolo *</label>
          <Input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} placeholder="EURUSD" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Dirección</label>
          <select
            value={form.direction}
            onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="alcista">Alcista</option>
            <option value="bajista">Bajista</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Estocástico</label>
          <Input type="number" min={0} max={100} value={form.stochastic_level} onChange={e => setForm(p => ({ ...p, stochastic_level: e.target.value }))} placeholder="50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Score Scanner</label>
          <Input type="number" min={0} max={100} value={form.scanner_score} onChange={e => setForm(p => ({ ...p, scanner_score: e.target.value }))} placeholder="85" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">¿Por qué lo vigilas?</label>
        <Textarea value={form.watch_reason} onChange={e => setForm(p => ({ ...p, watch_reason: e.target.value }))} placeholder="Cerca de zona de soporte con ADX en aumento..." rows={2} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
        <button type="submit" disabled={addItem.isPending} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          {addItem.isPending ? 'Guardando...' : 'Añadir'}
        </button>
      </div>
    </form>
  );
}
