import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { RadarCollapseContext } from '@/components/radar/radar-collapse-context';
import { Radar } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { ScannerListView, VigilanciaView, useVigilanciaCount } from '@/components/radar/ScannerListView';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { useEnTendenciaCount } from '@/components/radar/EnTendenciaBlock';
import { useAllTrades } from '@/hooks/use-trades';
import { filterByBroker } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { ViewSwitcher, type RadarView } from '@/components/radar/ViewSwitcher';

export const Route = createFileRoute('/radar')({
  component: RadarPage,
  head: () => ({
    meta: [
      { title: 'Escáner — CAP Trading' },
      { name: 'description', content: 'Escáner de tendencias, vigilancia EA y posiciones abiertas.' },
    ],
  }),
});


function RadarPage() {
  const { broker } = useBrokerFilter();
  const { openTrades } = useAllTrades();
  const filteredOpen = filterByBroker(openTrades, broker);
  const tendenciaCount = useEnTendenciaCount(broker);
  const vigCount = useVigilanciaCount(broker);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<RadarView>('escaneado');

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

  const switcher = (
    <ViewSwitcher
      value={view}
      onChange={setView}
      counts={{ escaneado: tendenciaCount, vigilancia: vigCount, posiciones: filteredOpen.length }}
    />
  );

  return (
    <RadarCollapseContext.Provider value={collapsed}>
      <div className="space-y-4">
        <div className={`lg:!max-h-none lg:!opacity-100 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-64 opacity-100'}`}>
          <StatusBar brokerFilter={broker} />

          <div className="flex items-center gap-2 mt-4">
            <Radar className="w-5 h-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Escáner</h1>
          </div>
        </div>

        {view === 'escaneado' && <ScannerListView brokerFilter={broker} viewSwitcher={switcher} />}
        {view === 'vigilancia' && <VigilanciaView brokerFilter={broker} viewSwitcher={switcher} />}
        {view === 'posiciones' && <OpenPositionsTable brokerFilter={broker} viewSwitcher={switcher} />}
      </div>
    </RadarCollapseContext.Provider>
  );
}
