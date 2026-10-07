/**
 * Cuenta única CWND (Darwinex Zero · Futuros MT5).
 * Los valores por defecto se usan si aún no se han guardado en Ajustes.
 */
export const CWND_DEFAULTS = {
  nombre: 'CWND · Darwinex Zero · Futuros MT5',
  numero: '4000100512',
  saldoInicial: 1000000,
  moneda: 'USD',
  fechaInicio: '2026-10-07',
  riesgoPct: 0.25,
};

export type AccountConfig = typeof CWND_DEFAULTS;

/** Lee la configuración de cuenta desde la fila de user_settings (tolerante a columnas aún no creadas). */
export function accountFromSettings(s: any): AccountConfig {
  return {
    nombre: s?.cuenta_nombre || CWND_DEFAULTS.nombre,
    numero: s?.account_number || CWND_DEFAULTS.numero,
    saldoInicial: s?.saldo_inicial != null ? Number(s.saldo_inicial) : CWND_DEFAULTS.saldoInicial,
    moneda: s?.moneda || CWND_DEFAULTS.moneda,
    fechaInicio: (s?.fecha_inicio as string | null)?.slice(0, 10) || CWND_DEFAULTS.fechaInicio,
    riesgoPct: s?.riesgo_pct != null ? Number(s.riesgo_pct) : CWND_DEFAULTS.riesgoPct,
  };
}

/** Raíz del mercado: lo que va antes del "_" (NQ_Z → NQ). Sin "_" → símbolo entero. */
export function raiz(symbol: string | null | undefined): string {
  const s = (symbol ?? '').trim().toUpperCase();
  const i = s.indexOf('_');
  return i > 0 ? s.slice(0, i) : s;
}

/** Fila de trade válida para CWND: no archivada, broker futuros (nkis/darwinex) y desde la fecha de inicio. */
export function isCwndTradeRow(row: any, fechaInicio: string): boolean {
  if (row?.archivada === true) return false;
  const b = String(row?.broker ?? 'darwinex').toLowerCase();
  if (b !== 'darwinex' && b !== 'nkis' && b !== 'cwnd') return false;
  const d = String(row?.entry_date ?? '').slice(0, 10);
  return d >= fechaInicio;
}

/** Cabeceras para el servidor local de backtest (ngrok). */
export function backtestServerHeaders(key: string): Record<string, string> {
  return { 'X-API-Key': key, 'ngrok-skip-browser-warning': 'true' };
}
