import { useEffect, useRef, useState } from 'react';
import { Check, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  CRITERIA_POINTS,
  STAGE_META,
  computeScore,
  stageFromScore,
  useCalculatorUsedToday,
  useUpsertQualification,
  type QualificationRow,
} from '@/hooks/use-qualification';
import { toast } from 'sonner';

interface Props {
  symbol: string;
  broker: string;
  direction: string;
  scannerScore: number;
  existing?: QualificationRow;
}

const CRITERIA_LABELS = [
  '¿Instrumento en sección Élite? (score ≥ 75)',
  '¿Dirección del escáner coincide con tendencia visual del gráfico?',
  '¿Vela de señal cierra bajo 30 (SELL) o sobre 70 (BUY)?',
  '¿Al menos una de las dos velas anteriores cerró al otro lado del nivel?',
  '¿ADX(14) > 23 en la vela de señal?',
  '¿Sizing calculado en la calculadora con VIX correcto aplicado?',
  '¿SL y trailing stop introducidos en MT5?',
];

const AUTO_INDICES = new Set([0, 5]); // C1 (élite) y C6 (calculadora) son automáticos
const CHECKLIST_KEYS = ['c1_elite', 'c2_direction', 'c3_signal_candle', 'c4_prev_candle', 'c5_adx', 'c6_sizing', 'c7_sl_mt5'] as const;
type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
type ChecklistState = Pick<QualificationRow, ChecklistKey>;

function getChecklistState(existing: QualificationRow | undefined, c1Auto: boolean, c6Auto: boolean): ChecklistState {
  return {
    c1_elite: c1Auto || (existing?.c1_elite ?? false),
    c2_direction: existing?.c2_direction ?? false,
    c3_signal_candle: existing?.c3_signal_candle ?? false,
    c4_prev_candle: existing?.c4_prev_candle ?? false,
    c5_adx: existing?.c5_adx ?? false,
    c6_sizing: c6Auto || (existing?.c6_sizing ?? false),
    c7_sl_mt5: existing?.c7_sl_mt5 ?? false,
  };
}

function isBuy(d: string) {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

/** Inline progress badge shown in the scanner row, colored by stage. */
export function QualificationProgressBadge({ score }: { score: number }) {
  const stage = stageFromScore(score);
  const meta = STAGE_META[stage];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${meta.badge}`}
      title={`${meta.emoji} ${meta.label}`}
    >
      <span>{meta.emoji}</span>
      <span className="font-data">{score}/20</span>
    </span>
  );
}

interface TriggerProps extends Props {
  expanded: boolean;
  onToggle: () => void;
}

/** Compact trigger button shown in the row — no popover, just toggles parent expansion. */
export function QualificationChecklistTrigger({
  scannerScore,
  existing,
  expanded,
  onToggle,
}: TriggerProps) {
  const score = existing?.score ?? (scannerScore >= 75 ? 2 : 0);
  const stage = stageFromScore(score);
  const meta = STAGE_META[stage];

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${meta.badge} hover:brightness-110`}
    >
      Evaluar {score}/20
      {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>
  );
}

/** Expanded inline panel — render directly below the row (e.g. in a second <tr>). */
export function QualificationChecklistPanel({
  symbol,
  broker,
  direction,
  scannerScore,
  existing,
}: Props) {
  const upsert = useUpsertQualification();
  const calcUsed = useCalculatorUsedToday(symbol);

  const c1Auto = scannerScore >= 75;
  const c6Auto = calcUsed;

  const [state, setState] = useState<ChecklistState>(() => getChecklistState(existing, c1Auto, c6Auto));
  const stateRef = useRef(state);

  useEffect(() => {
    const next = getChecklistState(existing, c1Auto, c6Auto);
    stateRef.current = next;
    setState(next);
  }, [existing?.id, existing?.c1_elite, existing?.c2_direction, existing?.c3_signal_candle, existing?.c4_prev_candle, existing?.c5_adx, existing?.c6_sizing, existing?.c7_sl_mt5, c1Auto, c6Auto]);

  const flags = [
    state.c1_elite,
    state.c2_direction,
    state.c3_signal_candle,
    state.c4_prev_candle,
    state.c5_adx,
    state.c6_sizing,
    state.c7_sl_mt5,
  ];

  const score = computeScore(state);
  const stage = stageFromScore(score);
  const meta = STAGE_META[stage];

  const handleToggle = (idx: number) => {
    if (AUTO_INDICES.has(idx)) {
      toast.info('Este criterio se marca automáticamente');
      return;
    }
    const key = CHECKLIST_KEYS[idx];
    const nextState: ChecklistState = {
      ...stateRef.current,
      c1_elite: c1Auto || stateRef.current.c1_elite,
      c6_sizing: c6Auto || stateRef.current.c6_sizing,
      [key]: !stateRef.current[key],
    };
    stateRef.current = nextState;
    setState(nextState);
    upsert.mutate(
      { symbol, broker, direction, patch: nextState, existing },
      {
        onError: () => {
          const reverted = getChecklistState(existing, c1Auto, c6Auto);
          stateRef.current = reverted;
          setState(reverted);
          toast.error('No se pudo guardar el marcado');
        },
      },
    );
  };

  return (
    <div
      className="p-3 bg-secondary/20 border-t border-border"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold border ${meta.badge}`}>
          <span>{meta.emoji}</span>
          <span>{meta.label}</span>
        </div>
        <div className="font-data text-xs font-bold text-foreground">
          {score}/20 pts · {flags.filter(Boolean).length}/7 criterios
        </div>
      </div>

      <div className="space-y-1.5">
        {CRITERIA_LABELS.map((label, idx) => {
          const checked = flags[idx];
          const isAuto = AUTO_INDICES.has(idx);

          const textTone = checked ? 'text-success' : 'text-foreground';

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleToggle(idx); }}
              aria-disabled={isAuto}
              className={`w-full flex items-start gap-2 px-2 py-1.5 rounded text-left text-[11px] border transition-colors ${
                checked
                  ? 'bg-success/10 border-success/30'
                  : isAuto
                    ? 'bg-secondary/30 border-border/40 cursor-default opacity-80'
                    : 'bg-card border-border/50 hover:bg-secondary/40 cursor-pointer'
              }`}
            >
              <span
                className={`shrink-0 w-4 h-4 mt-0.5 rounded grid place-content-center border ${
                  checked
                    ? 'bg-success/30 border-success/60 text-success'
                    : 'border-border'
                }`}
              >
                {checked ? <Check className="w-3 h-3" /> : isAuto ? <Lock className="w-2.5 h-2.5 text-muted-foreground/60" /> : null}
              </span>
              <span className={`flex-1 leading-snug ${textTone}`}>
                <span className="font-medium">
                  {idx + 1}. {label}
                </span>
                <span className="ml-1 text-muted-foreground font-data">
                  ({CRITERIA_POINTS[idx]} pts)
                </span>
                {isAuto && (
                  <span className="ml-1 text-[9px] text-muted-foreground italic">automático</span>
                )}
                {idx === 1 && (
                  <span className="ml-1 text-[9px] font-bold text-primary">
                    ({isBuy(direction) ? 'BUY' : 'SELL'})
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Backwards-compatible self-contained component (trigger + inline panel).
 * Used by callers that don't manage expansion state themselves.
 */
export function QualificationChecklist(props: Props) {
  const [expanded, setExpanded] = useStateLocal(false);
  return (
    <div className="w-full">
      <QualificationChecklistTrigger
        {...props}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <div className="mt-2">
          <QualificationChecklistPanel {...props} />
        </div>
      )}
    </div>
  );
}

// Tiny local useState alias to avoid extra import noise
import { useState as useStateLocal } from 'react';
