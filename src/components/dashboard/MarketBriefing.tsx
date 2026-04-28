import { useState } from 'react';
import { Sparkles, Loader2, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Trade } from '@/lib/trade-utils';

interface Props {
  openTrades: Trade[];
}

export function MarketBriefing({ openTrades }: Props) {
  const [contextNote, setContextNote] = useState('');
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.functions.invoke('generate-market-context', {
        body: {
          mode: 'briefing',
          date: today,
          contextNote,
          openPositions: openTrades.map(t => ({
            symbol: t.symbol,
            direction: t.direction,
            floatingPnl: t.netPnl ?? 0,
          })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const text = (data as any)?.text ?? '';
      if (!text) throw new Error('Respuesta vacía de la IA');
      setBriefing(text);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error generando briefing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Newspaper className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-sm text-foreground">BRIEFING DE MERCADO</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          placeholder="Ej: VIX 18.5, oro lateral, crudo bajando, Fed hawkish"
          className="flex-1"
          disabled={loading}
        />
        <Button onClick={handleGenerate} disabled={loading} className="gap-2 shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generando...' : 'Generar briefing'}
        </Button>
      </div>

      {briefing && (
        <Textarea
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          rows={6}
          className="bg-secondary/40 border-border text-sm leading-relaxed font-data"
        />
      )}
    </section>
  );
}
