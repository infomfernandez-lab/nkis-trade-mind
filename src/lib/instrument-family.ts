// Clasificación de instrumentos por Familia / Subfamilia, según mapeo del usuario.
// El símbolo base de los futuros es la raíz sin la letra del mes ni el año (6A_M → 6A).

export type Family =
  | 'Divisas'
  | 'Energía'
  | 'Metales'
  | 'Índices'
  | 'Granos'
  | 'Ganadería'
  | 'Bonos'
  | 'Forex'
  | 'ETFs';

export const FAMILIES: Family[] = [
  'Divisas','Energía','Metales','Índices','Granos','Ganadería','Bonos','Forex','ETFs',
];

/** Subfamilias por familia, en el orden de presentación. */
export const SUBFAMILIES: Record<Family, string[]> = {
  Divisas: ['Futuros CME', 'Forex Spot'],
  Energía: ['Petróleo Crudo', 'Refinados', 'Gas Natural'],
  Metales: ['Preciosos', 'Industriales'],
  Índices: ['USA', 'Europa', 'Asia/Pacífico'],
  Granos: ['Cereales', 'Soja'],
  Ganadería: [],
  Bonos: ['Treasuries', 'Europeos'],
  Forex: ['Majors USD', 'Crosses EUR', 'Crosses GBP', 'Crosses AUD/NZD', 'Exóticos'],
  ETFs: [
    'Tecnología','Semiconductores','Energía','Salud','Financiero','Industrial','Materiales',
    'Consumo Discrecional','Consumo Básico','Utilities','Comunicaciones','Real Estate',
    'Metales/Oro','Mercado Amplio USA','Estilo y Factor','Dividendos','Renta Fija',
    'Emergentes Global','Emergentes Asia','Emergentes Otros','Internacional Desarrollado',
    'Energía Limpia',
  ],
};

interface FamilyEntry { family: Family; subfamily: string }

// Mapa base → familia/subfamilia
const MAP: Record<string, FamilyEntry> = {};

function add(symbols: string[], family: Family, subfamily: string) {
  for (const s of symbols) MAP[s.toUpperCase()] = { family, subfamily };
}

// Divisas
add(['6A','6B','6C','6E','6J','6N','6S'], 'Divisas', 'Futuros CME');
add(['EURUSD','GBPUSD','EURGBP'], 'Divisas', 'Forex Spot');

// Energía
add(['CL','BZ','XTIUSD'], 'Energía', 'Petróleo Crudo');
add(['HO','RB'], 'Energía', 'Refinados');
add(['NG','XNGUSD'], 'Energía', 'Gas Natural');

// Metales
add(['GC','SI','PL','XAUUSD','XAGUSD','GLD','SLV','GDX','GDXJ'], 'Metales', 'Preciosos');
add(['HG'], 'Metales', 'Industriales');

// Índices
add(['ES','NQ','RTY','YM','SP500','NDX','WS30'], 'Índices', 'USA');
add(['FDAX','FESX','STOXX50E','GDAXI','FCHI40','SPA35','UK100'], 'Índices', 'Europa');
add(['NI225','AUS200'], 'Índices', 'Asia/Pacífico');

// Granos
add(['ZC','KE'], 'Granos', 'Cereales');
add(['ZS','ZL','ZM'], 'Granos', 'Soja');

// Ganadería
add(['HE','LE'], 'Ganadería', '—');

// Bonos
add(['ZN'], 'Bonos', 'Treasuries');
add(['FGBL'], 'Bonos', 'Europeos');

// Forex (cuidado: EURUSD ya cae en "Divisas"; mantenemos también en Forex Majors según mapeo)
add(['USDJPY','USDCHF','USDCAD','AUDUSD','NZDUSD'], 'Forex', 'Majors USD');
// EURUSD/GBPUSD listados también como Majors USD; los conservamos en Divisas › Forex Spot
// para evitar doble familia. Dejamos el resto.
add(['EURJPY','EURAUD','EURCAD','EURCHF','EURNZD'], 'Forex', 'Crosses EUR');
add(['GBPJPY','GBPAUD','GBPCAD','GBPCHF','GBPNZD'], 'Forex', 'Crosses GBP');
add(['AUDCAD','AUDCHF','AUDJPY','AUDNZD','NZDCAD','NZDCHF','NZDJPY'], 'Forex', 'Crosses AUD/NZD');
add(['EURMXN','EURNOK','EURSEK','GBPMXN','GBPNOK','GBPSEK','USDMXN','USDNOK','USDSEK','USDSGD','CADCHF','CADJPY','CHFJPY'], 'Forex', 'Exóticos');

// ETFs
add(['XLK','VGT','IYW','FTEC','IGV','QQQ','ARKK','ARKW','SKYY','FDN'], 'ETFs', 'Tecnología');
add(['SMH','SOXX'], 'ETFs', 'Semiconductores');
add(['XLE','VDE'], 'ETFs', 'Energía');
add(['XLV','VHT','IBB','XBI','IHI','ARKG'], 'ETFs', 'Salud');
add(['XLF','KRE'], 'ETFs', 'Financiero');
add(['XLI'], 'ETFs', 'Industrial');
add(['XLB'], 'ETFs', 'Materiales');
add(['XLY'], 'ETFs', 'Consumo Discrecional');
add(['XLP'], 'ETFs', 'Consumo Básico');
add(['XLU'], 'ETFs', 'Utilities');
add(['XLC'], 'ETFs', 'Comunicaciones');
add(['VNQ','IYR'], 'ETFs', 'Real Estate');
// GLD/SLV/GDX/GDXJ ya cayeron en Metales › Preciosos; no los re-mapeamos.
add(['SPY','IWM','DIA','RSP','VTI','ITOT','SCHB','OEF','MDY','IJH','IJR','VXF'], 'ETFs', 'Mercado Amplio USA');
add(['MTUM','VLUE','QUAL','USMV','SPLV','IVW','IVE','IUSG','IUSV','SPYG','SPYV','SCHG','SCHV','IWF','IWD','IWB','IWN','IWO','IWS','VOE','GSLC','ESGU'], 'ETFs', 'Estilo y Factor');
add(['SCHD','HDV','DVY','FVD','DGRO'], 'ETFs', 'Dividendos');
add(['TLT','TIP','EMB','PFF'], 'ETFs', 'Renta Fija');
add(['EEM','VWO'], 'ETFs', 'Emergentes Global');
add(['EWT','EWY','INDA','MCHI','AAXJ','EWJ','EZU','VPL'], 'ETFs', 'Emergentes Asia');
add(['EWZ'], 'ETFs', 'Emergentes Otros');
add(['EFA','EFAV','EFG','EFV','SCZ','VEA','SPDW','SCHF','VXUS','VT'], 'ETFs', 'Internacional Desarrollado');
add(['ICLN'], 'ETFs', 'Energía Limpia');

/** Devuelve el símbolo base sin la letra del mes ni el año (6A_M → 6A, CL_M → CL). */
export function baseSymbol(sym: string): string {
  const s = sym.toUpperCase();
  // Strip suffix "_X" o "_X_NN" donde X es una letra mes
  const m = s.match(/^([A-Z0-9]+?)_[A-Z](?:_\d+)?$/);
  if (m) return m[1];
  return s;
}

export function classifyFamily(symbol: string): FamilyEntry | null {
  const base = baseSymbol(symbol);
  return MAP[base] ?? null;
}
