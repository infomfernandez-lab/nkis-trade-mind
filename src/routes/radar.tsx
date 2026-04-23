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

  // Mobile order: ④ → ① → ③ → ②. Desktop order: ① → ② → ③ → ④
  return (
    <div className="space-y-4">
      <StatusBar brokerFilter={broker} />

      <div className="flex items-center gap-2">
        <Radar className="w-5 h-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Centro de mando</h1>
      </div>

      {/* Mobile: ④ first if there are signals */}
      {proximoCount > 0 && (
        <div className="md:hidden">
          <CollapsibleBlock
            id="proximo"
            title="④ PRÓXIMO A ENTRADA"
            countLabel={`${proximoCount}`}
            tone="alert"
            defaultOpen
          >
            <ProximoEntradaBlock brokerFilter={broker} />
          </CollapsibleBlock>
        </div>
      )}

      {/* ① Posiciones abiertas */}
      <CollapsibleBlock
        id="posiciones"
        title="① POSICIONES ABIERTAS"
        countLabel={`${filteredOpen.length}`}
        defaultOpen
      >
        <OpenPositionsTable brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ② En tendencia (desktop primero, en móvil al final) */}
      <div className="hidden md:block">
        <CollapsibleBlock
          id="tendencia"
          title="② EN TENDENCIA"
          countLabel={`${tendenciaCount} instrumentos`}
          defaultOpen
        >
          <EnTendenciaBlock brokerFilter={broker} />
        </CollapsibleBlock>
      </div>

      {/* ③ Vigilando */}
      <CollapsibleBlock
        id="vigilando"
        title="③ VIGILANDO"
        defaultOpen
      >
        <WatchlistSection openSymbols={openSymbols} brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ② En tendencia en móvil (al final) */}
      <div className="md:hidden">
        <CollapsibleBlock
          id="tendencia-m"
          title="② EN TENDENCIA"
          countLabel={`${tendenciaCount}`}
          defaultOpen={false}
        >
          <EnTendenciaBlock brokerFilter={broker} />
        </CollapsibleBlock>
      </div>

      {/* ④ Próximo a entrada — desktop al final (siempre visible) */}
      <div className="hidden md:block">
        <CollapsibleBlock
          id="proximo-d"
          title="④ PRÓXIMO A ENTRADA"
          countLabel={proximoCount > 0 ? `${proximoCount} ⚡` : '0'}
          tone={proximoCount > 0 ? 'alert' : undefined}
          defaultOpen
        >
          <ProximoEntradaBlock brokerFilter={broker} />
        </CollapsibleBlock>
      </div>

      {/* ⑤ Momentum — siempre visible, debajo del ④ */}
      <MomentumCollapsible broker={broker} />
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
