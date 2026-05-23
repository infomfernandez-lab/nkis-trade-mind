// Clasificación sectorial (estilo GICS) para acciones CFDs.
// Estrategia: 1) overrides por ticker (símbolos muy conocidos),
//             2) heurística por palabras clave en la descripción,
//             3) "Otros" como fallback.
import { getContractSpec } from './contract-specs';

export const STOCK_SECTORS = [
  'Tecnología',
  'Comunicación',
  'Consumo Discrecional',
  'Consumo Básico',
  'Salud',
  'Financiero',
  'Industrial',
  'Materiales',
  'Energía',
  'Utilities',
  'Real Estate',
  'Otros',
] as const;
export type StockSector = typeof STOCK_SECTORS[number];

// Overrides por ticker (los más relevantes; el resto cae por heurística)
const OVERRIDES: Record<string, StockSector> = {
  // Tecnología / Semis / Software
  AAPL: 'Tecnología', MSFT: 'Tecnología', NVDA: 'Tecnología', AMD: 'Tecnología',
  INTC: 'Tecnología', AVGO: 'Tecnología', QCOM: 'Tecnología', TXN: 'Tecnología',
  AMAT: 'Tecnología', LRCX: 'Tecnología', KLAC: 'Tecnología', ASML: 'Tecnología',
  MU: 'Tecnología', ADI: 'Tecnología', NXPI: 'Tecnología', MCHP: 'Tecnología',
  ON: 'Tecnología', MRVL: 'Tecnología', ENTG: 'Tecnología', AMKR: 'Tecnología',
  LSCC: 'Tecnología', SWKS: 'Tecnología', QRVO: 'Tecnología', WOLF: 'Tecnología',
  ADBE: 'Tecnología', CRM: 'Tecnología', ORCL: 'Tecnología', NOW: 'Tecnología',
  INTU: 'Tecnología', SNOW: 'Tecnología', PLTR: 'Tecnología', DDOG: 'Tecnología',
  CRWD: 'Tecnología', ZS: 'Tecnología', NET: 'Tecnología', PANW: 'Tecnología',
  FTNT: 'Tecnología', S: 'Tecnología', OKTA: 'Tecnología', MDB: 'Tecnología',
  TEAM: 'Tecnología', WDAY: 'Tecnología', ADSK: 'Tecnología', ANSS: 'Tecnología',
  CDNS: 'Tecnología', SNPS: 'Tecnología', HUBS: 'Tecnología', DBX: 'Tecnología',
  DOCU: 'Tecnología', ZM: 'Tecnología', TWLO: 'Tecnología', BILL: 'Tecnología',
  ESTC: 'Tecnología', GTLB: 'Tecnología', U: 'Tecnología', FIVN: 'Tecnología',
  CSCO: 'Tecnología', HPQ: 'Tecnología', HPE: 'Tecnología', DELL: 'Tecnología',
  IBM: 'Tecnología', NTAP: 'Tecnología', STX: 'Tecnología', WDC: 'Tecnología',
  ANET: 'Tecnología', JNPR: 'Tecnología', CIEN: 'Tecnología', AKAM: 'Tecnología',
  GLW: 'Tecnología', APH: 'Tecnología', TEL: 'Tecnología', FLEX: 'Tecnología',
  JBL: 'Tecnología', CDW: 'Tecnología', GEN: 'Tecnología', EPAM: 'Tecnología',
  IT: 'Tecnología', CTSH: 'Tecnología', ACN: 'Tecnología', DXC: 'Tecnología',

  // Comunicación
  GOOGL: 'Comunicación', GOOG: 'Comunicación', META: 'Comunicación',
  NFLX: 'Comunicación', DIS: 'Comunicación', CMCSA: 'Comunicación',
  CHTR: 'Comunicación', T: 'Comunicación', VZ: 'Comunicación', TMUS: 'Comunicación',
  EA: 'Comunicación', TTWO: 'Comunicación', RBLX: 'Comunicación', PINS: 'Comunicación',
  SNAP: 'Comunicación', SPOT: 'Comunicación', WBD: 'Comunicación', PARA: 'Comunicación',
  FOX: 'Comunicación', FOXA: 'Comunicación', NWS: 'Comunicación', NWSA: 'Comunicación',
  LYV: 'Comunicación', MTCH: 'Comunicación', OMC: 'Comunicación', IPG: 'Comunicación',

  // Consumo Discrecional
  AMZN: 'Consumo Discrecional', TSLA: 'Consumo Discrecional', HD: 'Consumo Discrecional',
  LOW: 'Consumo Discrecional', NKE: 'Consumo Discrecional', SBUX: 'Consumo Discrecional',
  MCD: 'Consumo Discrecional', BKNG: 'Consumo Discrecional', ABNB: 'Consumo Discrecional',
  CMG: 'Consumo Discrecional', YUM: 'Consumo Discrecional', DPZ: 'Consumo Discrecional',
  TGT: 'Consumo Discrecional', BBY: 'Consumo Discrecional', DLTR: 'Consumo Discrecional',
  DG: 'Consumo Discrecional', ROST: 'Consumo Discrecional', TJX: 'Consumo Discrecional',
  ULTA: 'Consumo Discrecional', LULU: 'Consumo Discrecional', DECK: 'Consumo Discrecional',
  CROX: 'Consumo Discrecional', GAP: 'Consumo Discrecional', M: 'Consumo Discrecional',
  KSS: 'Consumo Discrecional', JWN: 'Consumo Discrecional', AAP: 'Consumo Discrecional',
  AZO: 'Consumo Discrecional', ORLY: 'Consumo Discrecional', GM: 'Consumo Discrecional',
  F: 'Consumo Discrecional', RIVN: 'Consumo Discrecional', LCID: 'Consumo Discrecional',
  HOG: 'Consumo Discrecional', WMG: 'Consumo Discrecional', PHM: 'Consumo Discrecional',
  DHI: 'Consumo Discrecional', LEN: 'Consumo Discrecional', NVR: 'Consumo Discrecional',
  TOL: 'Consumo Discrecional', KMX: 'Consumo Discrecional', CVNA: 'Consumo Discrecional',
  CCL: 'Consumo Discrecional', RCL: 'Consumo Discrecional', NCLH: 'Consumo Discrecional',
  MAR: 'Consumo Discrecional', HLT: 'Consumo Discrecional', H: 'Consumo Discrecional',
  WYNN: 'Consumo Discrecional', MGM: 'Consumo Discrecional', LVS: 'Consumo Discrecional',
  EXPE: 'Consumo Discrecional', UBER: 'Consumo Discrecional', LYFT: 'Consumo Discrecional',
  DRI: 'Consumo Discrecional', ETSY: 'Consumo Discrecional', EBAY: 'Consumo Discrecional',
  CHWY: 'Consumo Discrecional', BURL: 'Consumo Discrecional', FIVE: 'Consumo Discrecional',

  // Consumo Básico
  WMT: 'Consumo Básico', COST: 'Consumo Básico', PG: 'Consumo Básico', KO: 'Consumo Básico',
  PEP: 'Consumo Básico', MO: 'Consumo Básico', PM: 'Consumo Básico', MDLZ: 'Consumo Básico',
  CL: 'Consumo Básico', KMB: 'Consumo Básico', GIS: 'Consumo Básico', K: 'Consumo Básico',
  HSY: 'Consumo Básico', STZ: 'Consumo Básico', TAP: 'Consumo Básico', KDP: 'Consumo Básico',
  KHC: 'Consumo Básico', CAG: 'Consumo Básico', CPB: 'Consumo Básico', SJM: 'Consumo Básico',
  HRL: 'Consumo Básico', TSN: 'Consumo Básico', LW: 'Consumo Básico', MKC: 'Consumo Básico',
  CHD: 'Consumo Básico', CLX: 'Consumo Básico', EL: 'Consumo Básico', COTY: 'Consumo Básico',
  KR: 'Consumo Básico', SYY: 'Consumo Básico', BJ: 'Consumo Básico', WBA: 'Consumo Básico',
  ADM: 'Consumo Básico', INGR: 'Consumo Básico', MNST: 'Consumo Básico',

  // Salud
  JNJ: 'Salud', PFE: 'Salud', MRK: 'Salud', LLY: 'Salud', ABBV: 'Salud', ABT: 'Salud',
  TMO: 'Salud', DHR: 'Salud', UNH: 'Salud', CVS: 'Salud', CI: 'Salud', HUM: 'Salud',
  ELV: 'Salud', CNC: 'Salud', MOH: 'Salud', BMY: 'Salud', AMGN: 'Salud', GILD: 'Salud',
  BIIB: 'Salud', REGN: 'Salud', VRTX: 'Salud', MRNA: 'Salud', BNTX: 'Salud',
  ISRG: 'Salud', SYK: 'Salud', BSX: 'Salud', MDT: 'Salud', EW: 'Salud', BDX: 'Salud',
  ZBH: 'Salud', BAX: 'Salud', HOLX: 'Salud', PODD: 'Salud', DXCM: 'Salud', IDXX: 'Salud',
  ILMN: 'Salud', DGX: 'Salud', LH: 'Salud', WAT: 'Salud', A: 'Salud', IQV: 'Salud',
  MTD: 'Salud', RMD: 'Salud', HCA: 'Salud', UHS: 'Salud', THC: 'Salud', ACHC: 'Salud',
  ALGN: 'Salud', ALNY: 'Salud', APLS: 'Salud', ARWR: 'Salud', BMRN: 'Salud',
  BRKR: 'Salud', CRL: 'Salud', DNLI: 'Salud', EHC: 'Salud', EXEL: 'Salud',
  GH: 'Salud', GMED: 'Salud', HALO: 'Salud', HQY: 'Salud', HSIC: 'Salud',
  INCY: 'Salud', INSP: 'Salud', IONS: 'Salud', AZTA: 'Salud', BIO: 'Salud',
  COR: 'Salud', COO: 'Salud', DVA: 'Salud', ELAN: 'Salud', HZNP: 'Salud',
  AVTR: 'Salud',

  // Financiero
  JPM: 'Financiero', BAC: 'Financiero', WFC: 'Financiero', C: 'Financiero', GS: 'Financiero',
  MS: 'Financiero', SCHW: 'Financiero', BLK: 'Financiero', BX: 'Financiero', KKR: 'Financiero',
  CG: 'Financiero', ARES: 'Financiero', APO: 'Financiero', AXP: 'Financiero', V: 'Financiero',
  MA: 'Financiero', PYPL: 'Financiero', SQ: 'Financiero', FIS: 'Financiero', FISV: 'Financiero',
  GPN: 'Financiero', BK: 'Financiero', STT: 'Financiero', NTRS: 'Financiero',
  USB: 'Financiero', PNC: 'Financiero', TFC: 'Financiero', FITB: 'Financiero', HBAN: 'Financiero',
  RF: 'Financiero', KEY: 'Financiero', CFG: 'Financiero', MTB: 'Financiero', ALLY: 'Financiero',
  COF: 'Financiero', DFS: 'Financiero', SYF: 'Financiero', AIG: 'Financiero', PRU: 'Financiero',
  MET: 'Financiero', ALL: 'Financiero', TRV: 'Financiero', PGR: 'Financiero', CB: 'Financiero',
  HIG: 'Financiero', AFL: 'Financiero', AFG: 'Financiero', AIZ: 'Financiero', AJG: 'Financiero',
  AMP: 'Financiero', AON: 'Financiero', BEN: 'Financiero', BRO: 'Financiero', BRKb: 'Financiero',
  CACC: 'Financiero', CINF: 'Financiero', CME: 'Financiero', ICE: 'Financiero', CFR: 'Financiero',
  EQH: 'Financiero', EVR: 'Financiero', FAF: 'Financiero', FHN: 'Financiero', FNF: 'Financiero',
  GL: 'Financiero', IBKR: 'Financiero', IVZ: 'Financiero', JEF: 'Financiero',
  LNC: 'Financiero', LPLA: 'Financiero', EEFT: 'Financiero', EWBC: 'Financiero',
  CPAY: 'Financiero', DOX: 'Financiero',

  // Industrial
  BA: 'Industrial', LMT: 'Industrial', RTX: 'Industrial', NOC: 'Industrial', GD: 'Industrial',
  GE: 'Industrial', HON: 'Industrial', MMM: 'Industrial', CAT: 'Industrial', DE: 'Industrial',
  ETN: 'Industrial', EMR: 'Industrial', ITW: 'Industrial', PH: 'Industrial', ROK: 'Industrial',
  CSX: 'Industrial', UNP: 'Industrial', NSC: 'Industrial', UPS: 'Industrial', FDX: 'Industrial',
  CHRW: 'Industrial', JBHT: 'Industrial', EXPD: 'Industrial', LSTR: 'Industrial', KNX: 'Industrial',
  DAL: 'Industrial', UAL: 'Industrial', AAL: 'Industrial', LUV: 'Industrial', ALK: 'Industrial',
  ACM: 'Industrial', AYI: 'Industrial', J: 'Industrial', JCI: 'Industrial', CARR: 'Industrial',
  CMI: 'Industrial', DOV: 'Industrial', FAST: 'Industrial', FTV: 'Industrial', GGG: 'Industrial',
  GNRC: 'Industrial', GWW: 'Industrial', HEI: 'Industrial', HII: 'Industrial', HUBB: 'Industrial',
  HWM: 'Industrial', HXL: 'Industrial', IEX: 'Industrial', IR: 'Industrial', ITT: 'Industrial',
  KBR: 'Industrial', LDOS: 'Industrial', LHX: 'Industrial', LII: 'Industrial',
  AME: 'Industrial', AOS: 'Industrial', AWI: 'Industrial', AXON: 'Industrial', BAH: 'Industrial',
  BLD: 'Industrial', BLDR: 'Industrial', BR: 'Industrial', CACI: 'Industrial', CSL: 'Industrial',
  EME: 'Industrial', ENOV: 'Industrial', FBIN: 'Industrial', FLS: 'Industrial', GTLS: 'Industrial',
  ARMK: 'Industrial', BFAM: 'Industrial', CHE: 'Industrial', CTAS: 'Industrial', G: 'Industrial',
  MAN: 'Industrial', RSG: 'Industrial', WM: 'Industrial', PCAR: 'Industrial',

  // Materiales
  LIN: 'Materiales', APD: 'Materiales', SHW: 'Materiales', FCX: 'Materiales', NEM: 'Materiales',
  ECL: 'Materiales', DD: 'Materiales', DOW: 'Materiales', LYB: 'Materiales', PPG: 'Materiales',
  EMN: 'Materiales', CE: 'Materiales', CF: 'Materiales', MOS: 'Materiales', NUE: 'Materiales',
  STLD: 'Materiales', X: 'Materiales', CLF: 'Materiales', AA: 'Materiales', ALB: 'Materiales',
  CCK: 'Materiales', BALL: 'Materiales', GPK: 'Materiales', IP: 'Materiales', PKG: 'Materiales',
  ASH: 'Materiales', AVY: 'Materiales', AXTA: 'Materiales', CTVA: 'Materiales',
  ESI: 'Materiales', FMC: 'Materiales', IFF: 'Materiales',

  // Energía
  XOM: 'Energía', CVX: 'Energía', COP: 'Energía', EOG: 'Energía', SLB: 'Energía',
  HAL: 'Energía', BKR: 'Energía', PSX: 'Energía', VLO: 'Energía', MPC: 'Energía',
  OXY: 'Energía', PXD: 'Energía', FANG: 'Energía', DVN: 'Energía', APA: 'Energía',
  HES: 'Energía', EQT: 'Energía', KMI: 'Energía', WMB: 'Energía', OKE: 'Energía',
  ENPH: 'Energía', FSLR: 'Energía', SEDG: 'Energía',

  // Utilities
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', AEP: 'Utilities', D: 'Utilities',
  EXC: 'Utilities', XEL: 'Utilities', SRE: 'Utilities', PEG: 'Utilities', ED: 'Utilities',
  PCG: 'Utilities', EIX: 'Utilities', WEC: 'Utilities', ES: 'Utilities', DTE: 'Utilities',
  AES: 'Utilities', AWK: 'Utilities', CMS: 'Utilities', CNP: 'Utilities',
  ETR: 'Utilities', EVRG: 'Utilities', FE: 'Utilities', LNT: 'Utilities',

  // Real Estate
  AMT: 'Real Estate', CCI: 'Real Estate', PLD: 'Real Estate', EQIX: 'Real Estate',
  SPG: 'Real Estate', PSA: 'Real Estate', O: 'Real Estate', WELL: 'Real Estate',
  AVB: 'Real Estate', EQR: 'Real Estate', VTR: 'Real Estate', DLR: 'Real Estate',
  CBRE: 'Real Estate', JLL: 'Real Estate',
};

// Heurística por palabras clave en la descripción
const KEYWORDS: Array<[RegExp, StockSector]> = [
  [/\bbank|bancorp|bancshares|financial|capital|holdings? group|insurance|reinsur|asset manage|invest|brokerage|securities|payments?|exchange\b/i, 'Financiero'],
  [/\bpharma|biotech|biolog|therapeutic|medical|health|hospital|clinic|surgical|diagnost|labor(atory|atories)|life science|genom|gene therap\b/i, 'Salud'],
  [/\btechnolog|software|semiconduct|semis|cyber|cloud|data|analytics|comput|electronic|silicon|systems? inc|networks?\b/i, 'Tecnología'],
  [/\bmedia|broadcast|entertain|interactive|gaming|games|telecom|wireless|communication|streaming|publish\b/i, 'Comunicación'],
  [/\bairlin|airways|cruise|hotel|resort|gaming|casino|leisure|restaurant|retail|stores?\b|apparel|footwear|automotive|motor|automaker\b/i, 'Consumo Discrecional'],
  [/\bbevera|food|grocer|tobacco|household|personal care|consumer products?\b/i, 'Consumo Básico'],
  [/\baerospace|defense|industrial|construction|machinery|engineering|logistics|transport|railway|trucking|airfreight|building products?\b/i, 'Industrial'],
  [/\bchemical|mining|steel|metals?|materials?|paper|packaging|coatings?|agric\b/i, 'Materiales'],
  [/\benergy|oil|gas|petroleum|solar|renewable|drilling|refining|pipeline\b/i, 'Energía'],
  [/\butilit|electric|power co|water (works|co)|gas & electric\b/i, 'Utilities'],
  [/\breit|real estate|properties|realty\b/i, 'Real Estate'],
];

export function classifyStockSector(symbol: string): StockSector {
  const sym = symbol.toUpperCase();
  const o = OVERRIDES[sym] ?? OVERRIDES[symbol];
  if (o) return o;
  const spec = getContractSpec(symbol);
  const desc = spec?.description ?? '';
  for (const [re, sector] of KEYWORDS) {
    if (re.test(desc)) return sector;
  }
  return 'Otros';
}
