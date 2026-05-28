// Override de sector para acciones USA usando el mapa GICS estático.
// La BD externa marca todas las acciones como ('Acciones', 'Acción USA').
// Aquí dividimos esa concentración en los sectores reales (Tecnología, Salud,
// Energía, etc.) sin tocar la fuente.
import { classifyStockSector } from './stock-sector';

export interface AssetLike {
  symbol: string;
  familia?: string | null;
  sector?: string | null;
}

/** Devuelve el sector "real" del activo aplicando overrides de cliente. */
export function resolveSector<T extends AssetLike>(a: T): string | null {
  const fam = (a.familia ?? '').toLowerCase();
  const sec = (a.sector ?? '').toLowerCase();
  // Acciones USA → GICS sector por ticker
  if (fam === 'acciones' || sec.includes('acción usa') || sec.includes('accion usa')) {
    return classifyStockSector(a.symbol);
  }
  return a.sector ?? null;
}

/** Devuelve una copia del activo con `sector` enriquecido. */
export function enrichAsset<T extends AssetLike>(a: T): T {
  return { ...a, sector: resolveSector(a) };
}
