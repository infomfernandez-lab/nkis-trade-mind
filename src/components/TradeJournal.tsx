import { useState } from 'react';
import { Loader2, Save, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Trade } from '@/lib/trade-utils';
import { exportTradePdf } from '@/lib/trade-pdf';

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
  interventionReason: string | null;
  duringTradeNotes: string | null;
  feelingResult: string | null;
  respectedSystem: string | null;
  whatDoDifferently: string | null;
  postTradeNotes: string | null;
}

interface TradeJournalProps {
  trade: Trade;
  scannerInfo?: { rank: number | null; total: number | null; score: number | null };
  vixValue?: number | null;
  onSaved?: (data: JournalData) => void;
}

const MANUAL_INTERVENTION_OPTIONS = [
  'EA gestionando solo',
  'Sin intervención',
  'SL a breakeven',
  'SL a beneficio',
  'Amplié SL inicial',
  'Cerré antes de tiempo',
  'Añadí posición',
];

const INTERVENTION_REASON_OPTIONS = [
  'Sin intervenir',
  'Para proteger beneficio',
  'Tenía miedo de perder',
  'Cambió el contexto de mercado',
  'Sin razón clara — impulso',
];

const RESPECTED_SYSTEM_OPTIONS = ['Sí completamente', 'No al 100%', 'No'];

const WHAT_DIFFERENT_OPTIONS = [
  'Nada, todo correcto',
  'Entrar antes',
  'Esperar más confirmación',
  'Respetar los stops',
  'Respetar las correlaciones',
  'Operación incorrecta desde el inicio',
];

/**
 * Parse intervention reason out of `during_trade_notes` using a sentinel prefix.
 * Format stored: "[REASON:<value>]\n<rest of notes>"
 */
function parseDuringNotes(raw: string | null): { reason: string | null; notes: string | null } {
  if (!raw) return { reason: null, notes: null };
  const m = raw.match(/^\[REASON:([^\]]+)\]\n?([\s\S]*)$/);
  if (!m) return { reason: null, notes: raw };
  return { reason: m[1] || null, notes: m[2] || null };
}

function serializeDuringNotes(reason: string | null, notes: string | null): string | null {
  const cleanNotes = notes?.trim() ?? '';
  if (!reason && !cleanNotes) return null;
  if (reason) return `[REASON:${reason}]\n${cleanNotes}`;
  return cleanNotes || null;
}

/** Same trick for "respected system" stored inside post_trade_notes */
function parsePostNotes(raw: string | null): { respected: string | null; notes: string | null } {
  if (!raw) return { respected: null, notes: null };
  const m = raw.match(/^\[RESPECTED:([^\]]+)\]\n?([\s\S]*)$/);
  if (!m) return { respected: null, notes: raw };
  return { respected: m[1] || null, notes: m[2] || null };
}

function serializePostNotes(respected: string | null, notes: string | null): string | null {
  const cleanNotes = notes?.trim() ?? '';
  if (!respected && !cleanNotes) return null;
  if (respected) return `[RESPECTED:${respected}]\n${cleanNotes}`;
  return cleanNotes || null;
}

export function TradeJournal({ trade, scannerInfo, vixValue, onSaved }: TradeJournalProps) {
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const initialDuring = parseDuringNotes(trade.duringTradeNotes);
  const initialPost = parsePostNotes(trade.postTradeNotes);

  const [data, setData] = useState<JournalData>({
    emotionalState: trade.emotionalState,
    reasonForEntry: trade.reasonForEntry,
    systemCompliance: trade.systemCompliance,
    setupDoubts: trade.setupDoubts,
    preTradeNotes: trade.preTradeNotes,
    managingWait: trade.managingWait,
    manualIntervention: trade.manualIntervention,
    interventionReason: initialDuring.reason,
    duringTradeNotes: initialDuring.notes,
    feelingResult: trade.feelingResult,
    respectedSystem: initialPost.respected,
    whatDoDifferently: trade.whatDoDifferently,
    postTradeNotes: initialPost.notes,
  });

  const set = <K extends keyof JournalData>(key: K, val: JournalData[K]) =>
    setData(prev => ({ ...prev, [key]: val }));

  const showInterventionReason =
    data.manualIntervention !== null &&
    data.manualIntervention !== 'EA gestionando solo' &&
    data.manualIntervention !== 'Sin intervención';

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
          during_trade_notes: serializeDuringNotes(
            showInterventionReason ? data.interventionReason : null,
            data.duringTradeNotes,
          ),
          feeling_result: data.feelingResult,
          what_do_differently: data.whatDoDifferently,
          post_trade_notes: serializePostNotes(data.respectedSystem, data.postTradeNotes),
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

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportTradePdf({ trade, journal: data, scannerInfo, vixValue });
      toast.success('PDF exportado');
    } catch (err: any) {
      toast.error(`Error al exportar: ${err.message}`);
    } finally {
      setExporting(false);
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
          options={MANUAL_INTERVENTION_OPTIONS}
          value={data.manualIntervention}
          onChange={v => set('manualIntervention', v)}
        />
        {showInterventionReason && (
          <ChipField
            label="¿Por qué intervine?"
            options={INTERVENTION_REASON_OPTIONS}
            value={data.interventionReason}
            onChange={v => set('interventionReason', v)}
          />
        )}
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
          options={['Bien proceso correcto', 'Bien proceso correcto aunque perdi', 'Mal aunque gané', 'Mal no seguí el sistema']}
          value={data.feelingResult}
          onChange={v => set('feelingResult', v)}
        />
        <ChipField
          label="¿Respeté el sistema?"
          options={RESPECTED_SYSTEM_OPTIONS}
          value={data.respectedSystem}
          onChange={v => set('respectedSystem', v)}
        />
        <ChipField
          label="¿Qué haría diferente?"
          options={WHAT_DIFFERENT_OPTIONS}
          value={data.whatDoDifferently}
          onChange={v => set('whatDoDifferently', v)}
        />
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">Notas libres</div>
          <Textarea
            placeholder="Reflexión post-trade..."
            value={data.postTradeNotes ?? ''}
            onChange={e => set('postTradeNotes', e.target.value || null)}
            className="min-h-[80px]"
          />
        </div>
      </Section>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar
        </Button>
        <Button onClick={handleExportPdf} disabled={exporting} variant="outline" className="flex-1">
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
          Exportar PDF
        </Button>
      </div>
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
