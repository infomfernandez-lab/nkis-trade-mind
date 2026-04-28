// Clasificación de instrumentos por tipo y país, basada en CONTRACT_SPECS y heurísticas.
import { CONTRACT_SPECS, getContractSpec } from './contract-specs';

export type InstrumentType =
  | 'forex'
  | 'index'
  | 'commodity'
  | 'metal'
  | 'energy'
  | 'bond'
  | 'crypto'
  | 'etf'
  | 'stock'
  | 'other';

export interface InstrumentMeta {
  symbol: string;
  description: string;
  type: InstrumentType;
  country: string; // 'EE.UU.', 'Alemania', 'Global', etc.
  flag: string;    // emoji
}

export const TYPE_LABEL: Record<InstrumentType, string> = {
  forex: 'Divisas',
  index: 'Índices',
  commodity: 'Materias primas',
  metal: 'Metales',
  energy: 'Energía',
  bond: 'Bonos',
  crypto: 'Cripto',
  etf: 'ETFs',
  stock: 'Acciones',
  other: 'Otros',
};

export const TYPE_ICON: Record<InstrumentType, string> = {
  forex: '💱',
  index: '📊',
  commodity: '🌾',
  metal: '🥇',
  energy: '🛢️',
  bond: '📜',
  crypto: '₿',
  etf: '📈',
  stock: '🏢',
  other: '•',
};

const FOREX_CURRENCIES = new Set([
  'EUR','USD','GBP','JPY','CHF','AUD','NZD','CAD','MXN','NOK','SEK','SGD','ZAR','HKD','CNH','TRY','PLN','HUF','CZK','DKK','RUB',
]);

const COUNTRY_BY_CURRENCY: Record<string, { country: string; flag: string }> = {
  USD: { country: 'EE.UU.', flag: '🇺🇸' },
  EUR: { country: 'Eurozona', flag: '🇪🇺' },
  GBP: { country: 'Reino Unido', flag: '🇬🇧' },
  JPY: { country: 'Japón', flag: '🇯🇵' },
  CHF: { country: 'Suiza', flag: '🇨🇭' },
  AUD: { country: 'Australia', flag: '🇦🇺' },
  NZD: { country: 'Nueva Zelanda', flag: '🇳🇿' },
  CAD: { country: 'Canadá', flag: '🇨🇦' },
  MXN: { country: 'México', flag: '🇲🇽' },
  NOK: { country: 'Noruega', flag: '🇳🇴' },
  SEK: { country: 'Suecia', flag: '🇸🇪' },
  SGD: { country: 'Singapur', flag: '🇸🇬' },
  ZAR: { country: 'Sudáfrica', flag: '🇿🇦' },
  HKD: { country: 'Hong Kong', flag: '🇭🇰' },
  CNH: { country: 'China', flag: '🇨🇳' },
  TRY: { country: 'Turquía', flag: '🇹🇷' },
  PLN: { country: 'Polonia', flag: '🇵🇱' },
  HUF: { country: 'Hungría', flag: '🇭🇺' },
  CZK: { country: 'Chequia', flag: '🇨🇿' },
  DKK: { country: 'Dinamarca', flag: '🇩🇰' },
  RUB: { country: 'Rusia', flag: '🇷🇺' },
};

// Override por símbolo para índices/materias primas conocidos
const SYMBOL_OVERRIDES: Record<string, { type: InstrumentType; country: string; flag: string }> = {
  // Índices
  AUS200: { type: 'index', country: 'Australia', flag: '🇦🇺' },
  FCHI40: { type: 'index', country: 'Francia', flag: '🇫🇷' },
  GDAXI:  { type: 'index', country: 'Alemania', flag: '🇩🇪' },
  FDAX_M: { type: 'index', country: 'Alemania', flag: '🇩🇪' },
  FESX_M: { type: 'index', country: 'Eurozona', flag: '🇪🇺' },
  STOXX50E: { type: 'index', country: 'Eurozona', flag: '🇪🇺' },
  NDX:    { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  NQ_M:   { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  SP500:  { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  ES_M:   { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  WS30:   { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  YM_M:   { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  RTY_M:  { type: 'index', country: 'EE.UU.', flag: '🇺🇸' },
  SPA35:  { type: 'index', country: 'España', flag: '🇪🇸' },
  UK100:  { type: 'index', country: 'Reino Unido', flag: '🇬🇧' },
  NI225:  { type: 'index', country: 'Japón', flag: '🇯🇵' },
  // Metales
  XAUUSD: { type: 'metal', country: 'Global', flag: '🥇' },
  XAGUSD: { type: 'metal', country: 'Global', flag: '🥈' },
  GC_M:   { type: 'metal', country: 'Global', flag: '🥇' },
  SI_K:   { type: 'metal', country: 'Global', flag: '🥈' },
  SI_N:   { type: 'metal', country: 'Global', flag: '🥈' },
  HG_K:   { type: 'metal', country: 'Global', flag: '🟫' },
  HG_N:   { type: 'metal', country: 'Global', flag: '🟫' },
  PL_N:   { type: 'metal', country: 'Global', flag: '⚪' },
  // Energía
  XTIUSD: { type: 'energy', country: 'EE.UU.', flag: '🛢️' },
  XNGUSD: { type: 'energy', country: 'EE.UU.', flag: '🔥' },
  CL_M:   { type: 'energy', country: 'EE.UU.', flag: '🛢️' },
  BZ_M:   { type: 'energy', country: 'Reino Unido', flag: '🛢️' },
  BZ_N:   { type: 'energy', country: 'Reino Unido', flag: '🛢️' },
  NG_K:   { type: 'energy', country: 'EE.UU.', flag: '🔥' },
  NG_M:   { type: 'energy', country: 'EE.UU.', flag: '🔥' },
  HO_K:   { type: 'energy', country: 'EE.UU.', flag: '🔥' },
  HO_M:   { type: 'energy', country: 'EE.UU.', flag: '🔥' },
  RB_K:   { type: 'energy', country: 'EE.UU.', flag: '⛽' },
  RB_M:   { type: 'energy', country: 'EE.UU.', flag: '⛽' },
  // Bonos
  ZN_M:   { type: 'bond', country: 'EE.UU.', flag: '📜' },
  FGBL_M: { type: 'bond', country: 'Alemania', flag: '📜' },
};

// ETFs comunes
const ETF_SYMBOLS = new Set([
  'SPY','QQQ','IWM','DIA','VTI','VOO','EEM','EFA','GLD','SLV','TLT','HYG','LQD','XLF','XLK','XLE','XLY','XLV','XLP','XLI','XLU','XLB','XLRE','XLC',
  'AAXJ','ARKK','ARKG','ARKW','ARKF','ARKQ','ARKX','VWO','VEA','VNQ','VUG','VTV','VYM','SCHB','SCHA','SCHD','VIG','VXUS','BND','AGG','VCSH','VCIT','VCLT','MUB','EMB','TIP','VPL','VGK','VYM','SPLV','SPHD','MOAT','PFF',
]);

// Crypto
const CRYPTO_PREFIXES = ['BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ADA', 'DOT', 'DOGE', 'SOL', 'AVAX', 'MATIC', 'BNB'];

// Materias primas agrícolas (CME)
const AGRO_SYMBOLS = new Set(['ZC_K','ZC_N','ZS_K','ZS_N','ZL_K','ZL_N','ZM_K','ZM_N','KE_K','KE_N','LE_M','HE_K','HE_M']);
const AGRO_FLAGS: Record<string,{country:string;flag:string;}> = {
  ZC_K:{country:'EE.UU.',flag:'🌽'},ZC_N:{country:'EE.UU.',flag:'🌽'},
  ZS_K:{country:'EE.UU.',flag:'🌱'},ZS_N:{country:'EE.UU.',flag:'🌱'},
  ZL_K:{country:'EE.UU.',flag:'🌱'},ZL_N:{country:'EE.UU.',flag:'🌱'},
  ZM_K:{country:'EE.UU.',flag:'🌱'},ZM_N:{country:'EE.UU.',flag:'🌱'},
  KE_K:{country:'EE.UU.',flag:'🌾'},KE_N:{country:'EE.UU.',flag:'🌾'},
  LE_M:{country:'EE.UU.',flag:'🐂'},HE_K:{country:'EE.UU.',flag:'🐖'},HE_M:{country:'EE.UU.',flag:'🐖'},
};

// Futuros forex CME (6E_M, 6B_M, 6J_M, etc.)
const FX_FUTURES: Record<string, string> = {
  '6A_M': 'AUD','6B_M':'GBP','6C_M':'CAD','6E_M':'EUR','6J_M':'JPY','6N_M':'NZD','6S_M':'CHF',
};

const SPEC_BY_SYMBOL = new Map<string, typeof CONTRACT_SPECS[number]>();
for (const s of CONTRACT_SPECS) {
  if (!SPEC_BY_SYMBOL.has(s.symbol)) SPEC_BY_SYMBOL.set(s.symbol, s);
}

function isForexPair(sym: string): { isForex: boolean; base?: string; quote?: string } {
  if (sym.length !== 6) return { isForex: false };
  const base = sym.slice(0, 3).toUpperCase();
  const quote = sym.slice(3, 6).toUpperCase();
  if (FOREX_CURRENCIES.has(base) && FOREX_CURRENCIES.has(quote)) return { isForex: true, base, quote };
  return { isForex: false };
}

export function classifyInstrument(symbol: string): InstrumentMeta {
  const sym = symbol.toUpperCase();
  const spec = SPEC_BY_SYMBOL.get(symbol) ?? SPEC_BY_SYMBOL.get(sym);
  const description = spec?.description ?? symbol;

  // 1) Override directo
  if (SYMBOL_OVERRIDES[sym]) {
    const o = SYMBOL_OVERRIDES[sym];
    return { symbol, description, type: o.type, country: o.country, flag: o.flag };
  }
  // 2) Futuros forex CME (6E_M…)
  if (FX_FUTURES[sym]) {
    const cur = FX_FUTURES[sym];
    const meta = COUNTRY_BY_CURRENCY[cur];
    return { symbol, description, type: 'forex', country: meta?.country ?? '—', flag: meta?.flag ?? '🏳️' };
  }
  // 3) Forex pair (6 chars con divisas conocidas)
  const fx = isForexPair(sym);
  if (fx.isForex) {
    const baseMeta = COUNTRY_BY_CURRENCY[fx.base!];
    const quoteMeta = COUNTRY_BY_CURRENCY[fx.quote!];
    const flag = (baseMeta?.flag ?? '') + (quoteMeta?.flag ?? '');
    const country = baseMeta && quoteMeta ? `${baseMeta.country} / ${quoteMeta.country}` : '—';
    return { symbol, description, type: 'forex', country, flag: flag || '💱' };
  }
  // 4) Agrícolas
  if (AGRO_SYMBOLS.has(sym)) {
    const m = AGRO_FLAGS[sym];
    return { symbol, description, type: 'commodity', country: m.country, flag: m.flag };
  }
  // 5) Crypto
  if (CRYPTO_PREFIXES.some(p => sym.startsWith(p))) {
    return { symbol, description, type: 'crypto', country: 'Global', flag: '₿' };
  }
  // 6) ETF
  if (ETF_SYMBOLS.has(sym)) {
    return { symbol, description, type: 'etf', country: 'EE.UU.', flag: '🇺🇸' };
  }
  // 7) Acciones (CFDs OCTX): símbolos cortos sin guion bajo, broker octx, contractSize 1.0
  if (spec && spec.broker === 'octx' && spec.contractSize === 1.0 && !sym.includes('_')) {
    return { symbol, description, type: 'stock', country: 'EE.UU.', flag: '🇺🇸' };
  }
  // 8) Fallback NKIS futuros
  if (spec && spec.broker === 'nkis') {
    return { symbol, description, type: 'commodity', country: 'EE.UU.', flag: '🇺🇸' };
  }
  return { symbol, description, type: 'other', country: '—', flag: '•' };
}

export function getInstrumentMeta(symbol: string): InstrumentMeta {
  return classifyInstrument(symbol);
}

// Tipos disponibles para los filtros (orden de presentación)
export const ALL_TYPES: InstrumentType[] = ['forex','index','metal','energy','commodity','bond','stock','etf','crypto','other'];

// Suprimir warning de import no usado
void getContractSpec;
