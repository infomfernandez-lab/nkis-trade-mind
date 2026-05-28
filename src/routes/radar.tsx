import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { RadarCollapseContext } from '@/components/radar/radar-collapse-context';
import { Radar, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusBar } from '@/components/radar/StatusBar';
import { ScannerListView, VigilanciaView, useVigilanciaCount } from '@/components/radar/ScannerListView';
import { OpenPositionsTable } from '@/components/radar/OpenPositionsTable';
import { useEnTendenciaCount, useUnifiedInstruments } from '@/components/radar/EnTendenciaBlock';
import { useAllTrades } from '@/hooks/use-trades';
import { filterByBroker } from '@/lib/trade-utils';
import { useBrokerFilter } from '@/components/layout/AppLayout';
import { ViewSwitcher, type RadarView } from '@/components/radar/ViewSwitcher';
import {
  AssetsStyleFiltersBar,
  EMPTY_SCANNER_FILTERS,
  aggregateTradesByKey,
  type ScannerFilterState,
} from '@/components/radar/AssetsStyleFiltersBar';
import { useAssetMap } from '@/hooks/use-asset-map';

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
  const { openTrades, closedTrades } = useAllTrades();
  const filteredOpen = filterByBroker(openTrades, broker);
  const tendenciaCount = useEnTendenciaCount(broker);
  const vigCount = useVigilanciaCount(broker);
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<RadarView>('escaneado');
  const [filters, setFilters] = useState<ScannerFilterState>(EMPTY_SCANNER_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filtros, mercados/sectores y trade-agg compartidos entre las 3 vistas.
  const scannerAll = useUnifiedInstruments(broker);
  const assetMap = useAssetMap();
  const tradeAgg = useMemo(
    () => aggregateTradesByKey([...openTrades, ...closedTrades]),
    [openTrades, closedTrades],
  );

  const mercados = useMemo(() => {
    const s = new Set<string>();
    for (const it of scannerAll) {
      const m = assetMap.classify(it.symbol).mercado;
      if (m) s.add(m);
    }
    return Array.from(s).sort();
  }, [scannerAll, assetMap]);

  const sectores = useMemo(() => {
    const s = new Set<string>();
    for (const it of scannerAll) {
      const c = assetMap.classify(it.symbol);
      if (filters.mercado !== 'all' && c.mercado !== filters.mercado) continue;
      if (c.sector) s.add(c.sector);
    }
    return Array.from(s).sort();
  }, [scannerAll, assetMap, filters.mercado]);

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

        {/* Filtro único compartido por las 3 vistas. La sección no cambia al pulsar
            los botones del view switcher: son simplemente otro filtro más. */}
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(o => !o)}
          className="md:hidden inline-flex items-center gap-2 px-3 h-8 rounded-md border border-border bg-card text-xs font-medium hover:border-primary/40"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filtros y búsqueda</span>
          {mobileFiltersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block sticky top-[44px] lg:top-[52px] z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 bg-background/95 backdrop-blur border-b border-border overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-out lg:!max-h-none lg:!opacity-100 lg:!py-2 ${collapsed ? 'max-h-0 opacity-0 py-0 border-transparent' : 'max-h-[600px] opacity-100'}`}>
          <AssetsStyleFiltersBar
            state={filters}
            onChange={setFilters}
            mercados={mercados}
            sectores={sectores}
            viewSwitcher={switcher}
          />
        </div>

        {view === 'escaneado' && (
          <ScannerListView brokerFilter={broker} filters={filters} tradeAgg={tradeAgg} assetMap={assetMap} />
        )}
        {view === 'vigilancia' && (
          <VigilanciaView brokerFilter={broker} filters={filters} tradeAgg={tradeAgg} assetMap={assetMap} />
        )}
        {view === 'posiciones' && (
          <OpenPositionsTable brokerFilter={broker} filters={filters} tradeAgg={tradeAgg} assetMap={assetMap} />
        )}
      </div>
    </RadarCollapseContext.Provider>
  );
}
