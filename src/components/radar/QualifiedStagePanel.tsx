import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ClipboardCheck, ArrowRight } from 'lucide-react';
import { useQualificationMap, type QualificationStage, STAGE_META } from '@/hooks/use-qualification';
import { useUnifiedInstruments, SymbolName, SymbolMeta, PriceCell, type UnifiedInstrument } from './EnTendenciaBlock';
import { QualificationProgressBadge, QualificationChecklist } from './QualificationChecklist';
import type { BrokerFilter } from '@/lib/trade-utils';
import { toast } from 'sonner';

interface Props {
  stage: QualificationStage;
  brokerFilter: BrokerFilter;
}

interface Row {
  inst: UnifiedInstrument;
  score: number;
  rowId: string;
}

function isAlcistaDir(d: string): boolean {
  const v = (d ?? '').toLowerCase();
  return v === 'alcista' || v === 'buy';
}

/**
 * Returns the set of `${symbol}::${broker}` keys that have *any* qualification
 * record today (regardless of stage). Used by legacy blocks to avoid showing
 * the same instrument twice — if the funnel is tracking it, the funnel panel
 * is the canonical view.
 */
export function useQualifiedKeySet(): Set<string> {
  const qmap = useQualificationMap();
  return useMemo(() => {
    const s = new Set<string>();
    for (const k of qmap.keys()) s.add(k);
    return s;
  }, [qmap]);
}

/**
 * Lists instruments whose qualification checklist score puts them in the given stage.
 * Mounted inside each Radar block so instruments climb the funnel automatically.
 */
export function QualifiedStagePanel({ stage, brokerFilter }: Props) {
  const qmap = useQualificationMap();
  const instruments = useUnifiedInstruments(brokerFilter);
  const navigate = useNavigate();

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const inst of instruments) {
      const key = `${inst.symbol}::${inst.broker}`;
      const q = qmap.get(key);
      if (!q) continue;
      if (q.stage !== stage) continue;
      out.push({ inst, score: q.score, rowId: q.id });
    }
    return out.sort((a, b) => b.score - a.score);
  }, [instruments, qmap, stage]);

  if (rows.length === 0) return null;

  const meta = STAGE_META[stage];

  const handleRegister = (inst: UnifiedInstrument) => {
    try {
      sessionStorage.setItem(
        'calculator:prefill',
        JSON.stringify({
          symbol: inst.symbol,
          direction: isAlcistaDir(inst.direction) ? 'alcista' : 'bajista',
          broker: inst.broker,
          source: 'qualification',
          ts: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
    toast.success(`Abriendo calculadora con ${inst.symbol} prellenado`);
    navigate({ to: '/calculator' });
  };

  return (
    <div className={`rounded-lg border ${meta.border} bg-card overflow-visible mb-3`}>
      <div className={`px-3 py-1.5 border-b ${meta.border} ${meta.header} text-[10px] uppercase tracking-wider flex items-center gap-2`}>
        <ClipboardCheck className="w-3.5 h-3.5" />
        <span className="font-bold">Embudo — {meta.emoji} {meta.label}</span>
        <span className="ml-auto font-data">{rows.length}</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ inst, score }, idx) => {
          const isBuy = isAlcistaDir(inst.direction);
          return (
            <div
              key={inst.symbol + '::' + inst.broker}
              className={`px-3 py-2 flex items-center gap-2 flex-wrap text-sm border-l-2 ${meta.accent} bg-card`}
            >
              <span className="font-data text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
              <div className="flex flex-col gap-0.5 min-w-[140px]">
                <SymbolName symbol={inst.symbol} />
                <SymbolMeta symbol={inst.symbol} compact />
              </div>
              <PriceCell price={inst.current_price} />
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                inst.broker === 'darwinex' ? 'bg-blue-950 text-blue-300 border-blue-800' : 'bg-orange-900/40 text-orange-300 border-orange-700/50'
              }`}>{inst.broker === 'darwinex' ? 'NK' : 'OX'}</span>
              <span className={`text-xs font-bold ${isBuy ? 'text-success' : 'text-destructive'}`}>
                {isBuy ? 'BUY' : 'SELL'}
              </span>
              <span className="font-data text-xs text-muted-foreground" title="Score del escáner">
                Sc {inst.score}
              </span>
              <QualificationProgressBadge score={score} />
              <div className="ml-auto flex items-center gap-2">
                <QualificationChecklist
                  symbol={inst.symbol}
                  broker={inst.broker}
                  direction={inst.direction}
                  scannerScore={inst.score}
                  existing={qmap.get(`${inst.symbol}::${inst.broker}`)}
                />
                {stage === 'en_cartera' && (
                  <button
                    onClick={() => handleRegister(inst)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-success text-success-foreground hover:bg-success/90 transition-colors"
                    title="Abrir calculadora con datos prellenados"
                  >
                    Registrar trade <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
