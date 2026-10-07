import { raiz } from '@/lib/account';

export type CsvTrade = {
  simbolo: string;
  contrato: string;
  direccion: 'LARGO' | 'CORTO';
  fecha_entrada: string;
  fecha_salida: string;
  entrada: number;
  salida: number;
  R: number;
  motivo: string;
  velas_dentro: number | null;
  familia?: string;
  senal?: string;
  variante: string;
  [k: string]: unknown;
};

export type VariantStats = {
  variante: string;
  n: number;
  winRate: number;
  rMedio: number;
  pf: number;
  rTotal: number;
  maxDdR: number;
  pf1: number;
  pf2: number;
  anosPos: string;
  simbPos: string;
};

const FIXED = ['simbolo', 'direccion', 'fecha_entrada', 'fecha_salida', 'entrada', 'salida', 'r', 'motivo', 'velas_dentro'];
const OPTIONAL = ['familia', 'senal', 'stop_precio', 'objetivo', 'riesgo_atr', 'rr_plan'];

const toNum = (v: string | undefined) => {
  if (v == null || v.trim() === '') return NaN;
  return Number(v.trim().replace(/\./g, (m, i, s) => (s.includes(',') ? '' : m)).replace(',', '.'));
};

export function parseOperacionesCsv(text: string): { trades: CsvTrade[]; abiertas: CsvTrade[]; paramCols: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('El CSV está vacío');
  const header = lines[0].split(';').map(h => h.trim());
  const lower = header.map(h => h.toLowerCase());
  for (const f of ['simbolo', 'direccion', 'fecha_entrada', 'r', 'motivo']) {
    if (!lower.includes(f)) throw new Error(`Falta la columna obligatoria "${f}"`);
  }
  const rows = lines.slice(1).map(l => {
    const cells = l.split(';');
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
  // Columnas de parámetros: cualquier otra con ≤ 12 valores distintos
  const paramCols = header.filter(h => {
    const k = h.toLowerCase();
    if (FIXED.includes(k) || OPTIONAL.includes(k)) return false;
    const vals = new Set(rows.map(r => r[h]));
    return vals.size <= 12;
  });
  const get = (r: Record<string, string>, k: string) => {
    const idx = lower.indexOf(k);
    return idx >= 0 ? r[header[idx]] : undefined;
  };
  const all: CsvTrade[] = rows.map(r => {
    const sym = (get(r, 'simbolo') ?? '').toUpperCase();
    const t: CsvTrade = {
      simbolo: raiz(sym),
      contrato: sym,
      direccion: (get(r, 'direccion') ?? '').toUpperCase().startsWith('C') ? 'CORTO' : 'LARGO',
      fecha_entrada: get(r, 'fecha_entrada') ?? '',
      fecha_salida: get(r, 'fecha_salida') ?? '',
      entrada: toNum(get(r, 'entrada')),
      salida: toNum(get(r, 'salida')),
      R: toNum(get(r, 'r')),
      motivo: (get(r, 'motivo') ?? '').toUpperCase(),
      velas_dentro: Number.isFinite(toNum(get(r, 'velas_dentro'))) ? toNum(get(r, 'velas_dentro')) : null,
      familia: get(r, 'familia') || undefined,
      senal: get(r, 'senal') || undefined,
      variante: paramCols.length ? paramCols.map(c => `${c}=${r[c]}`).join(' · ') : 'Única',
    };
    for (const c of paramCols) t[c] = r[c];
    return t;
  });
  const abiertas = all.filter(t => t.motivo === 'ABIERTA');
  const trades = all.filter(t => t.motivo !== 'ABIERTA' && Number.isFinite(t.R));
  return { trades, abiertas, paramCols };
}

/** Fecha dd/mm/yyyy o ISO → yyyy-mm-dd para ordenar */
export function isoDate(d: string): string {
  const m = d.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return d.slice(0, 10);
}

export function pf(rs: number[]): number {
  const g = rs.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const l = Math.abs(rs.filter(r => r < 0).reduce((s, r) => s + r, 0));
  return l > 0 ? g / l : g > 0 ? Infinity : 0;
}

export function equity(trades: CsvTrade[]) {
  const sorted = [...trades].sort((a, b) => isoDate(a.fecha_entrada).localeCompare(isoDate(b.fecha_entrada)));
  let cum = 0, peak = 0, maxDd = 0;
  const pts = sorted.map(t => {
    cum += t.R; peak = Math.max(peak, cum); const dd = cum - peak; maxDd = Math.min(maxDd, dd);
    return { fecha: isoDate(t.fecha_entrada), r: +cum.toFixed(2), dd: +dd.toFixed(2) };
  });
  return { pts, maxDd, sorted };
}

export function groupR(trades: CsvTrade[], key: (t: CsvTrade) => string) {
  const m = new Map<string, number[]>();
  for (const t of trades) { const k = key(t) || '—'; m.set(k, [...(m.get(k) ?? []), t.R]); }
  return [...m.entries()].map(([k, rs]) => ({
    k, n: rs.length, rTotal: +rs.reduce((s, r) => s + r, 0).toFixed(2),
    winRate: (rs.filter(r => r > 0).length / rs.length) * 100, pf: pf(rs),
  })).sort((a, b) => a.k.localeCompare(b.k));
}

export function variantStats(trades: CsvTrade[]): VariantStats[] {
  const by = new Map<string, CsvTrade[]>();
  for (const t of trades) by.set(t.variante, [...(by.get(t.variante) ?? []), t]);
  return [...by.entries()].map(([variante, ts]) => {
    const { sorted, maxDd } = equity(ts);
    const rs = sorted.map(t => t.R);
    const half = Math.floor(rs.length / 2);
    const years = groupR(ts, t => isoDate(t.fecha_entrada).slice(0, 4));
    const syms = groupR(ts, t => t.simbolo);
    return {
      variante, n: rs.length,
      winRate: rs.length ? (rs.filter(r => r > 0).length / rs.length) * 100 : 0,
      rMedio: rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : 0,
      pf: pf(rs), rTotal: rs.reduce((s, r) => s + r, 0), maxDdR: maxDd,
      pf1: pf(rs.slice(0, half)), pf2: pf(rs.slice(half)),
      anosPos: `${years.filter(y => y.rTotal > 0).length}/${years.length}`,
      simbPos: `${syms.filter(y => y.rTotal > 0).length}/${syms.length}`,
    };
  });
}

export const fmtPf = (v: number) => (v === Infinity ? '∞' : v.toFixed(2));
