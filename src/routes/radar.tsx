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
import { QualifiedStagePanel } from '@/components/radar/QualifiedStagePanel';

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
          { id: 'escaner', label: `📡 Escáner (${tendenciaCount})` },
          { id: 'seguimiento', label: `🔍 Calificado (${seguimientoCount})` },
          { id: 'proximo', label: `⚡ Señal activa (${proximoCount})` },
          { id: 'posiciones', label: `📈 En cartera (${filteredOpen.length})` },
        ]}
      />

      {/* ① Escáner */}
      <CollapsibleBlock
        id="escaner"
        title="📡 ESCANEADO"
        countLabel={`${tendenciaCount} instrumentos`}
        stage="escaneado"
        defaultOpen
      >
        <EnTendenciaBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ② Calificado */}
      <CollapsibleBlock
        id="seguimiento"
        title="🔍 CALIFICADO"
        countLabel={`${seguimientoCount}`}
        stage="calificado"
        defaultOpen
      >
        <QualifiedStagePanel stage="calificado" brokerFilter={broker} />
        <SeguimientoBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ③ Señal activa */}
      <CollapsibleBlock
        id="proximo"
        title="⚡ SEÑAL ACTIVA"
        countLabel={proximoCount > 0 ? `${proximoCount} ⚡` : '0'}
        stage="senal_activa"
        tone={proximoCount > 0 ? 'alert' : undefined}
        defaultOpen
      >
        <QualifiedStagePanel stage="senal_activa" brokerFilter={broker} />
        <ProximoEntradaBlock brokerFilter={broker} />
      </CollapsibleBlock>

      {/* ④ En cartera */}
      <CollapsibleBlock
        id="posiciones"
        title="📈 EN CARTERA"
        countLabel={`${filteredOpen.length}`}
        stage="en_cartera"
        defaultOpen
      >
        <QualifiedStagePanel stage="en_cartera" brokerFilter={broker} />
        <OpenPositionsTable brokerFilter={broker} />
      </CollapsibleBlock>
    </div>
  );
}
