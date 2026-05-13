// Family classification for statistics sections.
// Order matters — apply rules in sequence.

export type StatFamily =
  | 'Divisas' | 'Energía' | 'Metales' | 'Índices' | 'Granos'
  | 'Ganadería' | 'Bonos' | 'Forex' | 'ETFs' | 'Acciones';

export const STAT_FAMILIES: StatFamily[] = [
  'Divisas','Energía','Metales','Índices','Granos','Ganadería','Bonos','Forex','ETFs','Acciones',
];

const FUT_DIVISAS = new Set(['6A','6B','6C','6E','6J','6N','6S']);
const FUT_ENERGIA = new Set(['CL','BZ','HO','RB','NG']);
const FUT_METALES = new Set(['GC','SI','HG','PL']);
const FUT_INDICES = new Set(['ES','NQ','RTY','YM','FDAX','FESX']);
const FUT_GRANOS = new Set(['ZC','ZS','ZL','ZM','KE']);
const FUT_GANADERIA = new Set(['HE','LE']);
const FUT_BONOS = new Set(['ZN','FGBL']);

const FOREX_PAIRS = new Set([
  'EURUSD','GBPUSD','USDJPY','AUDJPY','EURNOK','GBPNOK','USDNOK','EURSEK','GBPSEK','USDSEK',
  'EURMXN','GBPMXN','USDMXN','USDSGD','AUDCAD','AUDCHF','AUDNZD','AUDUSD','CADCHF','CADJPY',
  'CHFJPY','EURAUD','EURCAD','EURCHF','EURGBP','EURJPY','EURNZD','GBPAUD','GBPCAD','GBPCHF',
  'GBPJPY','GBPNZD','NZDCAD','NZDCHF','NZDJPY','NZDUSD','USDCAD','USDCHF',
]);

const ETFS = new Set([
  'EWT','SOXX','EWY','IYW','QQQ','IWN','IVW','SPYG','IJR','ESGU','IWB','SPY','IWM','VPL',
  'IJH','IWD','MDY','VXF','IYR','VT','GLD','SLV','GDX','GDXJ','XLE','VDE','XLV','VHT','IBB',
  'XBI','IHI','XLF','KRE','XLI','XLB','XLY','XLP','XLU','XLC','VNQ','MTUM','VLUE','QUAL',
  'USMV','SPLV','TLT','TIP','EMB','EEM','VWO','EFA','EFAV','EFG','EFV','SCZ','VEA','SPDW',
  'SCHF','VXUS','ICLN','ARKK','ARKG','SCHD','HDV','DVY','FVD','DGRO','INDA','MCHI','AAXJ',
  'EWJ','EWZ','EZU','RSP','SCHB','OEF','DIA','VTI','ITOT','VOE','SPYV','IVE','IWF','IWO',
  'IWS','GSLC','SKYY','FDN','SMH',
]);

const INDICES_CFD = new Set([
  'NDX','SP500','WS30','STOXX50E','GDAXI','NI225','AUS200','FCHI40','SPA35','UK100',
]);

/** Strip future month/year suffix: CL_M → CL, NQ_M → NQ, ZL_N → ZL, RB_K_24 → RB. */
export function stripFutureSuffix(sym: string): string {
  const s = sym.toUpperCase();
  const m = s.match(/^([A-Z0-9]+?)_[A-Z](?:_\d+)?$/);
  return m ? m[1] : s;
}

export function classifyStatFamily(symbol: string): StatFamily {
  const base = stripFutureSuffix(symbol);
  if (FUT_DIVISAS.has(base)) return 'Divisas';
  if (FUT_ENERGIA.has(base)) return 'Energía';
  if (FUT_METALES.has(base)) return 'Metales';
  if (FUT_INDICES.has(base)) return 'Índices';
  if (FUT_GRANOS.has(base)) return 'Granos';
  if (FUT_GANADERIA.has(base)) return 'Ganadería';
  if (FUT_BONOS.has(base)) return 'Bonos';
  if (FOREX_PAIRS.has(base)) return 'Forex';
  if (ETFS.has(base)) return 'ETFs';
  if (INDICES_CFD.has(base)) return 'Índices';
  return 'Acciones';
}
