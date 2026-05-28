// Mapa compartido symbol → { mercado, sector } usando la tabla `assets`
// + override GICS para acciones USA. Lo consumen Activos, Escáner y Trades
// para que el filtro Mercado/Sector sea idéntico en toda la app.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { resolveSector } from '@/lib/asset-enrich';
import { classifyFamily } from '@/lib/instrument-family';

interface RawAsset {
  symbol: string;
  broker: string;
  familia: string | null;
  sector: string | null;
}

export interface AssetClass {
  mercado: string | null;
  sector: string | null;
}

export function useAssetMap() {
  const { data = [] } = useQuery({
    queryKey: ['assets-classify-map'],
    queryFn: async () => {
      const res = await fetch('/api/assets-proxy?select=symbol,broker,familia,sector');
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      return (await res.json()) as RawAsset[];
    },
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const bySymbol = new Map<string, AssetClass>();
    for (const a of data) {
      const mercado = a.familia ?? null;
      const sector = resolveSector(a);
      bySymbol.set(a.symbol.toUpperCase(), { mercado, sector });
    }
    return {
      bySymbol,
      classify: (symbol: string): AssetClass => {
        const k = (symbol ?? '').toUpperCase();
        const hit = bySymbol.get(k);
        if (hit && hit.mercado) return hit;
        // Fallback: clasificador local por símbolo
        const f = classifyFamily(symbol);
        return { mercado: f?.family ?? null, sector: f?.subfamily ?? null };
      },
      mercados: Array.from(
        new Set(
          [...bySymbol.values()].map(v => v.mercado).filter((x): x is string => !!x),
        ),
      ).sort(),
    };
  }, [data]);
}
