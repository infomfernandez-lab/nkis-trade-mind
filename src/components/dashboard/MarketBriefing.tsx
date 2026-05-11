import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Newspaper, Save, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Trade } from '@/lib/trade-utils';

interface Props {
  openTrades: Trade[];
}

const REGIMENES = ['Tendencia', 'Rango', 'Corrección', 'Alta volatilidad'] as const;
type Regimen = typeof REGIMENES[number];

interface BriefingRow {
  id: string;
  briefing_date: string;
  briefing_text: string;
  regimen: string;
  contexto_input: string | null;
}

export function MarketBriefing({ openTrades }: Props) {
  const { user } = useAuth();
  const [contextNote, setContextNote] = useState('');
  const [briefing, setBriefing] = useState('');
  const [regimen, setRegimen] = useState<Regimen | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<BriefingRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('market_briefings')
      .select('id, briefing_date, briefing_text, regimen, contexto_input')
      .order('briefing_date', { ascending: false })
      .limit(10);
    if (!error && data) setHistory(data as BriefingRow[]);
  };

  useEffect(() => {
    loadHistory();
  }, []);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(briefing);
      toast.success('Briefing copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const handleSave = async () => {
    console.log('[MarketBriefing] Save clicked', { user: !!user, briefingLen: briefing.length, regimen });
    if (!user) {
      toast.error('Debes iniciar sesión');
      return;
    }
    if (!briefing.trim()) {
      toast.error('Genera o escribe un briefing primero');
      return;
    }
    const regimenToSave: Regimen = regimen ?? 'Tendencia';
    if (!regimen) {
      setRegimen(regimenToSave);
      toast.message('Régimen no seleccionado: se guarda como "Tendencia" por defecto');
    }
    setSaving(true);
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const snapshot = openTrades.map(t => ({
        symbol: t.symbol,
        direction: t.direction,
        floatingPnl: Number(t.netPnl ?? 0),
      }));

      // 1. Save briefing
      const { error: insErr } = await supabase.from('market_briefings').insert({
        user_id: user.id,
        briefing_date: now.toISOString(),
        contexto_input: contextNote || null,
        briefing_text: briefing,
        regimen,
        posiciones_snapshot: snapshot,
      });
      if (insErr) {
        console.error('[MarketBriefing] Insert error:', insErr);
        throw insErr;
      }

      // 2. Upsert into daily_reports market_context for today
      const { data: existing, error: selErr } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('user_id', user.id)
        .eq('report_date', today)
        .eq('broker_filter', 'all')
        .maybeSingle();
      if (selErr) console.warn('[MarketBriefing] daily_reports select warn:', selErr);

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('daily_reports')
          .update({ market_context: briefing })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insRepErr } = await supabase.from('daily_reports').insert({
          user_id: user.id,
          report_date: today,
          broker_filter: 'all',
          market_context: briefing,
        });
        if (insRepErr) throw insRepErr;
      }

      toast.success('Briefing guardado y vinculado al informe diario');
      await loadHistory();
    } catch (e: any) {
      console.error('[MarketBriefing] Save failed:', e);
      const msg = e?.message || e?.error_description || e?.hint || 'Error guardando briefing';
      toast.error(msg);
    } finally {
      setSaving(false);
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
          className="flex-1 h-12 sm:h-9 text-base sm:text-sm"
          disabled={loading}
        />
        <Button onClick={handleGenerate} disabled={loading} size="lg" className="gap-2 shrink-0 w-full sm:w-auto h-12 sm:h-9 text-base sm:text-sm">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? 'Generando...' : 'Generar briefing'}
        </Button>
      </div>

      {briefing && (
        <>
          <div className="relative">
            <Textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              rows={6}
              className="bg-secondary/40 border-border text-base sm:text-sm leading-relaxed font-data pr-24 min-h-[180px] sm:min-h-0"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-9 sm:h-7 gap-1 text-sm sm:text-xs"
            >
              <Copy className="w-4 h-4 sm:w-3 sm:h-3" /> Copiar
            </Button>
          </div>

          {/* Régimen + Guardar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm sm:text-[11px] font-semibold text-muted-foreground mr-1 w-full sm:w-auto">
                Régimen{!regimen && <span className="text-destructive"> *</span>}:
              </span>
              {REGIMENES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegimen(r)}
                  className={`px-4 py-2.5 sm:px-2.5 sm:py-1 rounded-md text-sm sm:text-xs font-semibold border transition-colors ${
                    regimen === r
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/30 text-muted-foreground border-border hover:bg-secondary/60'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              variant="secondary"
              size="lg"
              className="gap-2 w-full sm:w-auto sm:self-start h-12 sm:h-9 text-base sm:text-sm"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Guardando...' : 'Guardar briefing'}
            </Button>
          </div>
        </>
      )}

      {/* Historial */}
      <div className="border-t border-border pt-3">
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Historial de briefings ({history.length})</span>
          {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {historyOpen && (
          <div className="mt-2 space-y-1.5">
            {history.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Aún no hay briefings guardados.</p>
            )}
            {history.map(h => {
              const isOpen = expandedId === h.id;
              const date = new Date(h.briefing_date);
              const dateStr = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
              const preview = h.briefing_text.split('\n').slice(0, 2).join(' ').slice(0, 160);
              return (
                <div key={h.id} className="rounded-md border border-border bg-secondary/20 p-2">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : h.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-data text-muted-foreground">{dateStr}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                        {h.regimen}
                      </span>
                      {isOpen ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                    </div>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{preview}{h.briefing_text.length > 160 ? '…' : ''}</p>
                    )}
                  </button>
                  {isOpen && (
                    <p className="text-xs text-foreground whitespace-pre-wrap font-data leading-relaxed mt-1">
                      {h.briefing_text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
