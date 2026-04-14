import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Trade } from '@/lib/trade-utils';

interface ChipFieldProps {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}

function ChipField({ label, options, value, onChange }: ChipFieldProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              value === opt
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-foreground border-border hover:border-primary/50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

interface JournalData {
  emotionalState: string | null;
  reasonForEntry: string | null;
  systemCompliance: string | null;
  setupDoubts: string | null;
  preTradeNotes: string | null;
  managingWait: string | null;
  manualIntervention: string | null;
  duringTradeNotes: string | null;
  feelingResult: string | null;
  whatDoDifferently: string | null;
  postTradeNotes: string | null;
}

interface TradeJournalProps {
  trade: Trade;
  onSaved?: (data: JournalData) => void;
}

export function TradeJournal({ trade, onSaved }: TradeJournalProps) {
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<JournalData>({
    emotionalState: trade.emotionalState,
    reasonForEntry: trade.reasonForEntry,
    systemCompliance: trade.systemCompliance,
    setupDoubts: trade.setupDoubts,
    preTradeNotes: trade.preTradeNotes,
    managingWait: trade.managingWait,
    manualIntervention: trade.manualIntervention,
    duringTradeNotes: trade.duringTradeNotes,
    feelingResult: trade.feelingResult,
    whatDoDifferently: trade.whatDoDifferently,
    postTradeNotes: trade.postTradeNotes,
  });

  const set = <K extends keyof JournalData>(key: K, val: JournalData[K]) =>
    setData(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('trades')
        .update({
          emotional_state: data.emotionalState,
          reason_for_entry: data.reasonForEntry,
          system_compliance: data.systemCompliance,
          setup_doubts: data.setupDoubts,
          pre_trade_notes: data.preTradeNotes,
          managing_wait: data.managingWait,
          manual_intervention: data.manualIntervention,
          during_trade_notes: data.duringTradeNotes,
          feeling_result: data.feelingResult,
          what_do_differently: data.whatDoDifferently,
          post_trade_notes: data.postTradeNotes,
        })
        .eq('id', trade.id);

      if (error) throw error;
      toast.success('Diario guardado correctamente');
      onSaved?.(data);
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Antes de Entrar */}
      <Section title="Antes de Entrar">
        <ChipField
          label="Estado Emocional"
          options={['Tranquilo', 'Ansioso', 'Eufórico', 'Cansado', 'Presionado']}
          value={data.emotionalState}
          onChange={v => set('emotionalState', v)}
        />
        <ChipField
          label="Razón de Entrada"
          options={['Scanner + señal estocástico', 'Solo el scanner', 'Solo el estocástico', 'Intuición', 'Otra razón']}
          value={data.reasonForEntry}
          onChange={v => set('reasonForEntry', v)}
        />
        <ChipField
          label="Cumplimiento del Sistema"
          options={['Sí al 100%', 'Casi', 'No del todo', 'No']}
          value={data.systemCompliance}
          onChange={v => set('systemCompliance', v)}
        />
        <ChipField
          label="Dudas sobre el setup"
          options={['Ninguna todo claro', 'Sí pero entro igual', 'Sí tengo dudas serias']}
          value={data.setupDoubts}
          onChange={v => set('setupDoubts', v)}
        />
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">Notas libres</div>
          <Textarea
            placeholder="Notas antes de entrar al trade..."
            value={data.preTradeNotes ?? ''}
            onChange={e => set('preTradeNotes', e.target.value || null)}
            className="min-h-[80px]"
          />
        </div>
      </Section>

      {/* Durante el Trade */}
      <Section title="Durante el Trade">
        <ChipField
          label="Gestión de la Espera"
          options={['Tranquilo sin mirar', 'Mirando bastante', 'Mirando demasiado', 'Con ganas de cerrar']}
          value={data.managingWait}
          onChange={v => set('managingWait', v)}
        />
        <ChipField
          label="Intervención Manual"
          options={['No EA gestionando solo', 'Moví el SL', 'Cerré antes de tiempo', 'Añadí posición']}
          value={data.manualIntervention}
          onChange={v => set('manualIntervention', v)}
        />
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">Notas libres</div>
          <Textarea
            placeholder="Notas durante el trade..."
            value={data.duringTradeNotes ?? ''}
            onChange={e => set('duringTradeNotes', e.target.value || null)}
            className="min-h-[80px]"
          />
        </div>
      </Section>

      {/* Después del Cierre */}
      <Section title="Después del Cierre">
        <ChipField
          label="Sensación"
          options={['Bien proceso correcto', 'Bien aunque perdí', 'Mal aunque gané', 'Mal no seguí el sistema']}
          value={data.feelingResult}
          onChange={v => set('feelingResult', v)}
        />
        <ChipField
          label="Qué Haría Diferente"
          options={['Nada repetiría igual', 'Entrar antes', 'Esperar más confirmación', 'No haber entrado', 'Dejar correr más el TP']}
          value={data.whatDoDifferently}
          onChange={v => set('whatDoDifferently', v)}
        />
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">Post-mortem</div>
          <Textarea
            placeholder="Reflexión post-trade..."
            value={data.postTradeNotes ?? ''}
            onChange={e => set('postTradeNotes', e.target.value || null)}
            className="min-h-[80px]"
          />
        </div>
      </Section>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Guardar
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
