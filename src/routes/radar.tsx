import { createFileRoute } from '@tanstack/react-router';
import { Radar } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { ScannerListView } from '@/components/radar/ScannerListView';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { useEnTendenciaCount } from '@/components/radar/EnTendenciaBlock';
import { useAllTrades } from '@/hooks/use-trades';
import { filterByBroker } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Radar — CAP Trading' },
      { name: 'description', content: 'Centro de mando: escáner y posiciones abiertas.' },
    ],
  }),
});

function RadarPage() {
  const { broker } = useBrokerFilter();
  const { openTrades } = useAllTrades();
  const filteredOpen = filterByBroker(openTrades, broker);
  const tendenciaCount = useEnTendenciaCount(broker);

  return (
    <div className="space-y-4">
      <StatusBar brokerFilter={broker} />

      <div className="flex items-center gap-2">
        <Radar className="w-5 h-5 text-primary" />
        <h1 className="font-display text-xl font-bold">Centro de mando</h1>
      </div>

      <Tabs defaultValue="escaneado" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="escaneado" className="flex-1 sm:flex-none">
            📡 Escaneado <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-data">{tendenciaCount}</span>
          </TabsTrigger>
          <TabsTrigger value="posiciones" className="flex-1 sm:flex-none">
            📈 Posiciones Abiertas <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-data">{filteredOpen.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escaneado" className="mt-4">
          <ScannerListView brokerFilter={broker} />
        </TabsContent>

        <TabsContent value="posiciones" className="mt-4">
          <OpenPositionsTable brokerFilter={broker} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
