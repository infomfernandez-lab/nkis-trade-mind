import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Radar, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { EnTendenciaBlock, useEnTendenciaCount } from '@/components/radar/EnTendenciaBlock';
import { ProximoEntradaBlock, useProximoEntradaCount } from '@/components/radar/ProximoEntradaBlock';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { WatchlistSection } from '@/components/radar/WatchlistSection';
import { useAllTrades } from '@/hooks/use-trades';
import { filterByBroker } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { CollapsibleBlock } from '@/components/radar/CollapsibleBlock';
import { MomentumBlock, useMomentumCount } from '@/components/radar/MomentumBlock';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Radar — CAP Trading' },
      { name: 'description', content: 'Centro de mando del scanner: posiciones, tendencia, vigilando y próximas señales.' },
    ],
  }),
});

function RadarPage() {
  const { broker } = useBrokerFilter();
  const { openTrades } = useAllTrades();
  const filteredOpen = filterByBroker(openTrades, broker);
  const openSymbols = new Set(filteredOpen.map(t => t.symbol));

  const tendenciaCount = useEnTendenciaCount(broker);
  const proximoCount = useProximoEntradaCount(broker);

  const [showMore, setShowMore] = useState(false);

  return (
    <div className="space-y-4">
      <StatusBar brokerFilter={broker} />

      <div className="flex items-center gap-2">
        <Radar className="w-5 h-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Centro de mando</h1>
      </div>

      {/* ① Posiciones abiertas */}
      <CollapsibleBlock
        id="posiciones"
        title="① POSICIONES ABIERTAS"
        countLabel={`${filteredOpen.length}`}
        defaultOpen
      >
        <OpenPositionsTable brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ② En tendencia */}
      <CollapsibleBlock
        id="tendencia"
        title="② EN TENDENCIA"
        countLabel={`${tendenciaCount} instrumentos`}
        defaultOpen
      >
        <EnTendenciaBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* Separador "Más información" */}
      <div className="pt-4">
        <button
          onClick={() => setShowMore(v => !v)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-border text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showMore ? 'Ocultar más información' : '— Más información —'}
        </button>
      </div>

      {showMore && (
        <div className="space-y-4">
          {/* ③ Vigilando */}
          <CollapsibleBlock
            id="vigilando"
            title="③ VIGILANDO"
            defaultOpen
          >
            <WatchlistSection openSymbols={openSymbols} brokerFilter={broker} />
          </CollapsibleBlock>

          {/* ④ Próximo a entrada */}
          <CollapsibleBlock
            id="proximo"
            title="④ PRÓXIMO A ENTRADA"
            countLabel={proximoCount > 0 ? `${proximoCount} ⚡` : '0'}
            tone={proximoCount > 0 ? 'alert' : undefined}
            defaultOpen
          >
            <ProximoEntradaBlock brokerFilter={broker} />
          </CollapsibleBlock>

          {/* ⑤ Momentum */}
          <MomentumCollapsible broker={broker} />
        </div>
      )}
    </div>
  );
}

function MomentumCollapsible({ broker }: { broker: ReturnType<typeof useBrokerFilter>['broker'] }) {
  const { total } = useMomentumCount(broker);
  return (
    <CollapsibleBlock
      id="momentum"
      title="⑤ MOMENTUM"
      countLabel={`${total}`}
      defaultOpen
    >
      <MomentumBlock brokerFilter={broker} />
    </CollapsibleBlock>
  );
}
