import { createFileRoute } from '@tanstack/react-router';
import { Radar } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { EnTendenciaBlock, useEnTendenciaCount } from '@/components/radar/EnTendenciaBlock';
import { ProximoEntradaBlock, useProximoEntradaCount } from '@/components/radar/ProximoEntradaBlock';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { SeguimientoBlock, useSeguimientoCount } from '@/components/radar/SeguimientoBlock';
import { useAllTrades } from '@/hooks/use-trades';
import { filterByBroker } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { CollapsibleBlock } from '@/components/radar/CollapsibleBlock';
import { AnchorNav } from '@/components/radar/AnchorNav';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Radar — CAP Trading' },
      { name: 'description', content: 'Centro de mando: escáner, seguimiento, entrada próxima y posiciones abiertas.' },
    ],
  }),
});

function RadarPage() {
  const { broker } = useBrokerFilter();
  const { openTrades } = useAllTrades();
  const filteredOpen = filterByBroker(openTrades, broker);

  const tendenciaCount = useEnTendenciaCount(broker);
  const seguimientoCount = useSeguimientoCount(broker);
  const proximoCount = useProximoEntradaCount(broker);

  return (
    <div className="space-y-4">
      <StatusBar brokerFilter={broker} />

      <div className="flex items-center gap-2">
        <Radar className="w-5 h-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Centro de mando</h1>
      </div>

      <AnchorNav
        items={[
          { id: 'escaner', label: `① Escáner (${tendenciaCount})` },
          { id: 'seguimiento', label: `② Seguimiento (${seguimientoCount})` },
          { id: 'proximo', label: `③ Entrada próxima (${proximoCount})` },
          { id: 'posiciones', label: `④ Posiciones (${filteredOpen.length})` },
        ]}
      />

      {/* ① Escáner */}
      <CollapsibleBlock
        id="escaner"
        title="① ESCÁNER"
        countLabel={`${tendenciaCount} instrumentos`}
        defaultOpen
      >
        <EnTendenciaBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ② Seguimiento */}
      <CollapsibleBlock
        id="seguimiento"
        title="② SEGUIMIENTO"
        countLabel={`${seguimientoCount}`}
        defaultOpen
      >
        <SeguimientoBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ③ Próximo a entrada */}
      <CollapsibleBlock
        id="proximo"
        title="③ ENTRADA PRÓXIMA"
        countLabel={proximoCount > 0 ? `${proximoCount} ⚡` : '0'}
        tone={proximoCount > 0 ? 'alert' : undefined}
        defaultOpen
      >
        <ProximoEntradaBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ④ Posiciones abiertas */}
      <CollapsibleBlock
        id="posiciones"
        title="④ POSICIONES ABIERTAS"
        countLabel={`${filteredOpen.length}`}
        defaultOpen
      >
        <OpenPositionsTable brokerFilter={broker} />
      </CollapsibleBlock>
    </div>
  );
}
