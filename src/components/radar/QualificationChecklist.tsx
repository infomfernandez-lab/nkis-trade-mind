import { useEffect, useState } from 'react';
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

function isBuy(d: string) {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

/** Inline progress badge shown in the scanner row. */
export function QualificationProgressBadge({ score }: { score: number }) {
  const stage = stageFromScore(score);
  const meta = STAGE_META[stage];
  const tone =
    meta.tone === 'green'
      ? 'bg-success/20 text-success border-success/40'
      : meta.tone === 'orange'
        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
        : meta.tone === 'yellow'
          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
          : 'bg-muted/40 text-muted-foreground border-border';
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${tone}`}
      title={`${meta.emoji} ${meta.label}`}
    >
      <span>{meta.emoji}</span>
      <span className="font-data">{score}/20</span>
    </span>
  );
}

export function QualificationChecklist({
  symbol,
  broker,
  direction,
  scannerScore,
  existing,
}: Props) {
  const [open, setOpen] = useState(false);
  const upsert = useUpsertQualification();
  const calcUsed = useCalculatorUsedToday(symbol);

  const c1Auto = scannerScore >= 75;
  const c6Auto = calcUsed;

  // Effective state: auto criteria override stored value
  const state = {
    c1_elite: c1Auto || (existing?.c1_elite ?? false),
    c2_direction: existing?.c2_direction ?? false,
    c3_signal_candle: existing?.c3_signal_candle ?? false,
    c4_prev_candle: existing?.c4_prev_candle ?? false,
    c5_adx: existing?.c5_adx ?? false,
    c6_sizing: c6Auto || (existing?.c6_sizing ?? false),
    c7_sl_mt5: existing?.c7_sl_mt5 ?? false,
  };

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

  const keys = ['c1_elite', 'c2_direction', 'c3_signal_candle', 'c4_prev_candle', 'c5_adx', 'c6_sizing', 'c7_sl_mt5'] as const;

  const handleToggle = (idx: number) => {
    if (AUTO_INDICES.has(idx)) {
      toast.info('Este criterio se marca automáticamente');
      return;
    }
    // Sequential rule: previous criteria must all be true
    for (let i = 0; i < idx; i++) {
      if (!flags[i]) {
        toast.error(`Marca primero el criterio ${i + 1}`);
        return;
      }
    }
    const key = keys[idx];
    const newValue = !flags[idx];

    // If unchecking, also uncheck all subsequent (manual) criteria
    const patch: Record<string, boolean> = { [key]: newValue };
    if (!newValue) {
      for (let i = idx + 1; i < keys.length; i++) {
        if (!AUTO_INDICES.has(i)) patch[keys[i]] = false;
      }
    }

    upsert.mutate({
      symbol,
      broker,
      direction,
      patch,
      existing,
    });
  };

  // Persist auto changes (élite / calculadora) when they differ from stored
  useEffect(() => {
    const needsAutoSync =
      (existing?.c1_elite ?? false) !== c1Auto || (existing?.c6_sizing ?? false) !== c6Auto;
    if (needsAutoSync && !upsert.isPending) {
      upsert.mutate({
        symbol,
        broker,
        direction,
        patch: { c1_elite: c1Auto, c6_sizing: c6Auto },
        existing,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c1Auto, c6Auto, existing?.id, existing?.c1_elite, existing?.c6_sizing]);

  return (
    <div className="inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
      >
        Evaluar {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-[420px] max-w-[92vw] right-0 rounded-lg border border-border bg-popover shadow-lg p-3 text-left">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border">
            <div className="text-xs font-bold text-foreground">
              {meta.emoji} {meta.label}
            </div>
            <div className="font-data text-xs font-bold">
              {score}/20 pts
            </div>
          </div>

          <div className="space-y-1.5">
            {CRITERIA_LABELS.map((label, idx) => {
              const checked = flags[idx];
              const isAuto = AUTO_INDICES.has(idx);
              const prevDone = idx === 0 || flags.slice(0, idx).every(Boolean);
              const locked = !prevDone && !checked && !isAuto;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleToggle(idx)}
                  disabled={locked || isAuto}
                  className={`w-full flex items-start gap-2 px-2 py-1.5 rounded text-left text-[11px] transition-colors ${
                    checked
                      ? 'bg-success/10 border border-success/30'
                      : locked
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-secondary/50 border border-transparent'
                  }`}
                >
                  <span
                    className={`shrink-0 w-4 h-4 rounded grid place-content-center border ${
                      checked
                        ? 'bg-success/30 border-success/60 text-success'
                        : 'border-border'
                    }`}
                  >
                    {checked ? <Check className="w-3 h-3" /> : locked ? <Lock className="w-2.5 h-2.5" /> : null}
                  </span>
                  <span className="flex-1 leading-snug">
                    <span className="font-medium text-foreground">
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

          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {flags.filter(Boolean).length}/7 criterios
            </span>
            <button
              onClick={() => setOpen(false)}
              className="px-2 py-0.5 rounded hover:bg-secondary text-foreground"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
