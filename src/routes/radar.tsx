import { createFileRoute } from '@tanstack/react-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { Radar } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { ScannerListView, VigilanciaView, useVigilanciaCount } from '@/components/radar/ScannerListView';
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
      { name: 'description', content: 'Centro de mando: escáner, vigilancia y posiciones abiertas.' },
    ],
  }),
});

const RadarCollapseContext = createContext(false);
export const useRadarCollapsed = () => useContext(RadarCollapseContext);

function RadarPage() {
  const { broker } = useBrokerFilter();
  const { openTrades } = useAllTrades();
  const filteredOpen = filterByBroker(openTrades, broker);
  const tendenciaCount = useEnTendenciaCount(broker);
  const vigCount = useVigilanciaCount(broker);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    let lastY = 0;
    const onScroll = () => {
      const y = main.scrollTop;
      const delta = y - lastY;
      if (y < 40) setCollapsed(false);
      else if (delta > 6) setCollapsed(true);
      else if (delta < -6) setCollapsed(false);
      lastY = y;
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <RadarCollapseContext.Provider value={collapsed}>
      <div className="space-y-4">
        <div className={`lg:!max-h-none lg:!opacity-100 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-64 opacity-100'}`}>
          <StatusBar brokerFilter={broker} />

          <div className="flex items-center gap-2 mt-4">
            <Radar className="w-5 h-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Centro de mando</h1>
          </div>
        </div>


        <Tabs defaultValue="escaneado" className="w-full">
          <div className={`sticky top-0 z-30 -mx-4 lg:-mx-6 px-4 lg:px-6 bg-background/95 backdrop-blur border-b border-border overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out lg:!max-h-none lg:!opacity-100 lg:!py-2 ${collapsed ? 'max-h-0 opacity-0 py-0' : 'max-h-20 opacity-100 py-2'}`}>
            <TabsList className="w-full h-auto grid grid-cols-3 gap-1">
              <TabsTrigger value="escaneado" className="w-full justify-center text-xs sm:text-sm">
                📡 Escaneado <span className="ml-1.5 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-data">{tendenciaCount}</span>
              </TabsTrigger>
              <TabsTrigger value="posiciones" className="w-full justify-center text-xs sm:text-sm">
                📈 Posiciones <span className="ml-1.5 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-data">{filteredOpen.length}</span>
              </TabsTrigger>
              <TabsTrigger value="vigilancia" className="w-full justify-center text-xs sm:text-sm">
                👁 Vigilancia <span className="ml-1.5 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-data">{vigCount}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="escaneado" className="mt-4">
            <ScannerListView brokerFilter={broker} />
          </TabsContent>

          <TabsContent value="posiciones" className="mt-4">
            <OpenPositionsTable brokerFilter={broker} />
          </TabsContent>

          <TabsContent value="vigilancia" className="mt-4">
            <VigilanciaView brokerFilter={broker} />
          </TabsContent>
        </Tabs>
      </div>
    </RadarCollapseContext.Provider>
  );
}
