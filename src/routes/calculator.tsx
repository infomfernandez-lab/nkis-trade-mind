import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2, ChevronDown, ChevronUp, Search, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CalculatorHistory, type CalcRecord } from '@/components/calculator/CalculatorHistory';
import { useSettings } from '@/hooks/use-settings';
import { useLatestVix, getCapRiskFromVix, CAP_VIX_LEGEND } from '@/hooks/use-latest-vix';
import { CONTRACT_SPECS, getContractSpec, getPointValue, calcLots, type ContractSpec } from '@/lib/contract-specs';

/**
 * Resolve point value and tick size from CONTRACT_SPECS (real MT5 specs).
 * Tries the exact symbol first, then the family root (before "_") for futures.
 * Falls back to the catalog values if symbol isn't found in the specs file.
 */
function resolveSpec(
  symbol: string,
  fallbackPv: number,
  fallbackTickSize: number | null | undefined,
): { pointValue: number; tickSize: number | null } {
  const candidates = [symbol, symbol.split('_')[0]];
  for (const c of candidates) {
    const spec = getContractSpec(c);
    if (spec && spec.tickSize > 0) {
      return { pointValue: getPointValue(c), tickSize: spec.tickSize };
    }
  }
  return { pointValue: fallbackPv, tickSize: fallbackTickSize ?? null };
}

export const Route = createFileRoute('/calculator')({
  head: () => ({
    meta: [
      { title: 'Calculadora — CAP Trading' },
      { name: 'description', content: 'Calculadora de posición CAP Trend Following' },
    ],
  }),
  component: CalculatorPage,
});

type Account = 'darwinex' | 'octx';
type Direction = 'BUY' | 'SELL';

type Currency = 'USD' | 'GBP' | 'GBX' | 'EUR' | 'JPY' | 'AUD' | 'CHF' | 'HKD';

const GBX_WARNING = '⚠️ Esta acción cotiza en peniques (GBX).\nEl precio en MT5 ya está en peniques — úsalo directamente en la calculadora sin convertir.\nEl beneficio/pérdida se calculará también en GBX.\nPara convertir a GBP divide entre 100.';

type InstrumentRow = {
  symbol: string;
  description: string;
  size?: string;
  pointValue: number;
  note?: string;
  group: string;
  broker: 'darwinex' | 'octx';
  currency?: Currency;
  variable?: boolean;
  warn?: boolean;
};

const HIGH_PV_WARNING = '⚠ Valor del punto muy alto — verificar lotes antes de operar';

/**
 * Infer a friendly group name from a ContractSpec's symbol/description.
 * Used to bucket the instruments table.
 */
function inferGroup(spec: ContractSpec): string {
  const sym = spec.symbol.toUpperCase();
  const desc = (spec.description || '').toLowerCase();

  // OCTX (CFDs / spot / shares)
  if (spec.broker === 'octx') {
    if (sym.startsWith('#')) return 'Índices CFD';
    if (/\.(o|n)$/i.test(sym) && !/etf/i.test(desc)) return 'Acciones USA';
    if (/\.l$/i.test(sym)) return 'Acciones UK';
    if (/\.(de|pa|as|br|mi|mc)$/i.test(sym)) return 'Acciones EU';
    if (['BITCOIN', 'ETHEREUM', 'AAVE', 'LITECOIN', 'XRP'].includes(sym)) return 'Criptomonedas';
    if (['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'ZINC', 'ALUMINIUM', 'COPPER'].includes(sym)) return 'Metales Spot';
    if (['WTI', 'NAT.GAS', 'NATGAS', 'BRENT'].includes(sym)) return 'Energía';
    if (/etf|fund|trust|shares|spdr|ishares|vanguard|invesco/i.test(desc)) return 'ETFs';
    if (/^[A-Z]{3,6}$/.test(sym)) return 'Forex';
    return 'Otros';
  }

  // NKIS (Darwinex futures) — bucket by family root
  const root = sym.split('_')[0];
  if (['ES', 'NQ', 'RTY', 'YM'].includes(root)) return 'Índices USA';
  if (['FDAX', 'FESX', 'FGBL'].includes(root)) return 'Índices Europeos';
  if (['GC', 'SI', 'HG', 'PL', 'PA'].includes(root)) return 'Metales';
  if (['CL', 'BZ', 'NG', 'HO', 'RB'].includes(root)) return 'Energía';
  if (['ZC', 'ZS', 'ZL', 'ZM', 'ZW', 'KE', 'LE', 'HE'].includes(root)) return 'Agrícolas';
  if (['6A', '6B', '6C', '6E', '6J', '6N', '6S'].includes(root)) return 'Divisas (FX Futuros)';
  if (['ZN', 'ZB', 'ZF', 'ZT'].includes(root)) return 'Bonos USA';
  return 'Otros';
}

const INSTRUMENTS: InstrumentRow[] = CONTRACT_SPECS.map((spec): InstrumentRow => {
  const broker: 'darwinex' | 'octx' = spec.broker === 'nkis' ? 'darwinex' : 'octx';
  const currency = (spec.profitCurrency || 'USD').toUpperCase();
  const knownCurrencies: Currency[] = ['USD', 'GBP', 'GBX', 'EUR', 'JPY', 'AUD', 'CHF', 'HKD'];
  const safeCurrency = (knownCurrencies as string[]).includes(currency) ? (currency as Currency) : undefined;
  const isGbx = safeCurrency === 'GBX';
  return {
    broker,
    group: inferGroup(spec),
    symbol: spec.symbol,
    description: spec.description,
    pointValue: getPointValue(spec.symbol),
    currency: safeCurrency,
    note: isGbx ? GBX_WARNING : undefined,
  };
});

// Color tokens that work in both light and dark themes (use semantic-ish palette
// with low-opacity backgrounds so contrast holds in both modes).
const CURRENCY_BADGE: Record<Currency, string> = {
  USD: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40',
  GBP: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
  GBX: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50',
  EUR: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40',
  JPY: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
  AUD: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40',
  CHF: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40',
  HKD: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
};

// ============================================================
// AUTOCOMPLETE CATALOG — valores verificados oficialmente
// (Darwinex Zero / CME — única fuente válida para el buscador)
// ============================================================
type AutocompleteEntry = {
  symbol: string;        // símbolo individual ej "HG_K"
  family: string;        // raíz para agrupar vencimientos ej "HG"
  description: string;
  pointValue: number;
  currency: 'USD' | 'EUR' | 'GBX';
  broker: 'darwinex' | 'octx';
  group: string;
  highValue?: boolean;   // ⚠⚠ VALOR ALTO
  tickSize?: number;     // tamaño mínimo de movimiento de precio (para puntos MT5)
};

const AUTOCOMPLETE: AutocompleteEntry[] = (() => {
  const out: AutocompleteEntry[] = [];
  const add = (
    broker: 'darwinex' | 'octx',
    group: string,
    family: string,
    expiries: string[],
    description: string,
    pointValue: number,
    currency: 'USD' | 'EUR' | 'GBX',
    tickSize: number,
    highValue = false,
  ) => {
    if (expiries.length === 0) {
      out.push({ symbol: family, family, description, pointValue, currency, broker, group, highValue, tickSize });
    } else {
      for (const e of expiries) {
        out.push({
          symbol: `${family}_${e}`, family, description, pointValue, currency, broker, group, highValue, tickSize,
        });
      }
    }
  };

  // DARWINEX — Agrícolas
  add('darwinex', 'Agrícolas', 'KE', ['K', 'N'], 'Hard Red Wheat', 50, 'USD', 0.0025);
  add('darwinex', 'Agrícolas', 'ZC', ['K', 'N'], 'Corn', 50, 'USD', 0.0025);
  add('darwinex', 'Agrícolas', 'ZL', ['K', 'N'], 'Soybean Oil', 600, 'USD', 0.00001);
  add('darwinex', 'Agrícolas', 'ZM', ['K', 'N'], 'Soybean Meal', 100, 'USD', 0.1);
  add('darwinex', 'Agrícolas', 'ZS', ['K', 'N'], 'Soybeans', 50, 'USD', 0.0025);
  add('darwinex', 'Agrícolas', 'ZO', ['K'], 'Oats', 50, 'USD', 0.0025);
  add('darwinex', 'Agrícolas', 'ZR', ['K'], 'Rough Rice', 50, 'USD', 0.005);
  add('darwinex', 'Agrícolas', 'ZW', ['K'], 'Wheat', 50, 'USD', 0.0025);
  // DARWINEX — Energía
  add('darwinex', 'Energía', 'BZ', ['M', 'N'], 'Brent Crude Oil', 1000, 'USD', 0.01);
  add('darwinex', 'Energía', 'CL', ['M', 'K'], 'Light Sweet Crude', 1000, 'USD', 0.01);
  add('darwinex', 'Energía', 'HO', ['K', 'M'], 'Heating Oil', 42000, 'USD', 0.00001, true);
  add('darwinex', 'Energía', 'NG', ['K', 'M'], 'Natural Gas', 10000, 'USD', 0.001, true);
  add('darwinex', 'Energía', 'RB', ['K', 'M'], 'RBOB Gasoline', 42000, 'USD', 0.00001, true);
  // DARWINEX — Índices EU
  add('darwinex', 'Índices EU', 'FDAX', ['M'], 'DAX Index', 25, 'EUR', 0.5);
  add('darwinex', 'Índices EU', 'FESX', ['M'], 'Euro Stoxx 50', 10, 'EUR', 1.0);
  add('darwinex', 'Índices EU', 'FGBL', ['M'], 'Bund', 1000, 'EUR', 0.01);
  // DARWINEX — FX
  add('darwinex', 'FX Futuros', '6A', ['M'], 'Australian Dollar', 10, 'USD', 0.0001);
  add('darwinex', 'FX Futuros', '6B', ['M'], 'British Pound', 6.25, 'USD', 0.0001);
  add('darwinex', 'FX Futuros', '6C', ['M'], 'Canadian Dollar', 10, 'USD', 0.0001);
  add('darwinex', 'FX Futuros', '6E', ['M'], 'EUR/USD', 12.5, 'USD', 0.00005);
  add('darwinex', 'FX Futuros', '6J', ['M'], 'Japanese Yen', 12.5, 'USD', 0.0000005);
  add('darwinex', 'FX Futuros', '6N', ['M'], 'New Zealand Dollar', 10, 'USD', 0.0001);
  add('darwinex', 'FX Futuros', '6S', ['M'], 'Swiss Franc', 12.5, 'USD', 0.0001);
  // DARWINEX — Índices USA
  add('darwinex', 'Índices USA', 'ES', ['M'], 'E-mini S&P 500', 50, 'USD', 0.25);
  add('darwinex', 'Índices USA', 'NQ', ['M'], 'E-mini Nasdaq 100', 20, 'USD', 0.25);
  add('darwinex', 'Índices USA', 'RTY', ['M'], 'E-mini Russell 2000', 50, 'USD', 0.1);
  add('darwinex', 'Índices USA', 'YM', ['M'], 'Mini Dow Jones', 5, 'USD', 1.0);
  // DARWINEX — Carnes
  add('darwinex', 'Carnes', 'HE', ['K', 'M'], 'Lean Hogs', 400, 'USD', 0.00025);
  add('darwinex', 'Carnes', 'LE', ['M', 'N'], 'Live Cattle', 400, 'USD', 0.00025);
  // DARWINEX — Metales
  add('darwinex', 'Metales', 'GC', ['M', 'N'], 'Gold', 100, 'USD', 0.1);
  add('darwinex', 'Metales', 'HG', ['K', 'N'], 'Copper', 25000, 'USD', 0.0005, true);
  add('darwinex', 'Metales', 'PL', ['N'], 'Platinum', 50, 'USD', 0.1);
  add('darwinex', 'Metales', 'SI', ['K', 'N'], 'Silver', 5000, 'USD', 0.005, true);
  add('darwinex', 'Bonos', 'ZN', ['M'], '10Y US Treasury Note', 1000, 'USD', 0.015625);

  // OCTX — CFDs
  const octx = (
    symbol: string,
    description: string,
    pv: number,
    cur: 'USD' | 'EUR' | 'GBX',
    tickSize: number,
    group = 'CFDs',
  ) => {
    out.push({ symbol, family: symbol, description, pointValue: pv, currency: cur, broker: 'octx', group, tickSize });
  };
  // Forex
  octx('EURUSD', 'Euro vs Dollar', 10, 'USD', 0.00001, 'Forex');
  octx('GBPUSD', 'Pound vs Dollar', 10, 'USD', 0.00001, 'Forex');
  octx('USDJPY', 'Dollar vs Yen', 10, 'USD', 0.001, 'Forex');
  octx('USDCHF', 'USD vs CHF', 10, 'USD', 0.00001, 'Forex');
  octx('AUDUSD', 'AUD vs USD', 10, 'USD', 0.00001, 'Forex');
  octx('NZDUSD', 'NZD vs USD', 10, 'USD', 0.00001, 'Forex');
  octx('USDCAD', 'USD vs CAD', 10, 'USD', 0.00001, 'Forex');
  octx('EURGBP', 'EUR vs GBP', 10, 'USD', 0.00001, 'Forex');
  octx('EURJPY', 'EUR vs JPY', 10, 'USD', 0.001, 'Forex');
  octx('GBPJPY', 'GBP vs JPY', 10, 'USD', 0.001, 'Forex');
  octx('AUDJPY', 'AUD vs JPY', 10, 'USD', 0.001, 'Forex');
  octx('CHFJPY', 'CHF vs JPY', 10, 'USD', 0.001, 'Forex');
  octx('EURCHF', 'EUR vs CHF', 10, 'USD', 0.00001, 'Forex');
  octx('EURAUD', 'EUR vs AUD', 10, 'USD', 0.00001, 'Forex');
  octx('EURCAD', 'EUR vs CAD', 10, 'USD', 0.00001, 'Forex');
  octx('GBPAUD', 'GBP vs AUD', 10, 'USD', 0.00001, 'Forex');
  octx('GBPCAD', 'GBP vs CAD', 10, 'USD', 0.00001, 'Forex');
  octx('GBPCHF', 'GBP vs CHF', 10, 'USD', 0.00001, 'Forex');
  octx('AUDCAD', 'AUD vs CAD', 10, 'USD', 0.00001, 'Forex');
  octx('AUDCHF', 'AUD vs CHF', 10, 'USD', 0.00001, 'Forex');
  octx('AUDNZD', 'AUD vs NZD', 10, 'USD', 0.00001, 'Forex');
  octx('CADCHF', 'CAD vs CHF', 10, 'USD', 0.00001, 'Forex');
  octx('CADJPY', 'CAD vs JPY', 10, 'USD', 0.001, 'Forex');
  octx('NZDCAD', 'NZD vs CAD', 10, 'USD', 0.00001, 'Forex');
  octx('NZDCHF', 'NZD vs CHF', 10, 'USD', 0.00001, 'Forex');
  octx('NZDJPY', 'NZD vs JPY', 10, 'USD', 0.001, 'Forex');
  octx('EURNZD', 'EUR vs NZD', 10, 'USD', 0.00001, 'Forex');
  octx('GBPNZD', 'GBP vs NZD', 10, 'USD', 0.00001, 'Forex');
  octx('USDZAR', 'USD vs ZAR', 10, 'USD', 0.00001, 'Forex');
  octx('USDMXN', 'USD vs MXN', 10, 'USD', 0.00001, 'Forex');
  octx('USDNOK', 'USD vs NOK', 10, 'USD', 0.00001, 'Forex');
  octx('USDSEK', 'USD vs SEK', 10, 'USD', 0.00001, 'Forex');
  octx('USDSGD', 'USD vs SGD', 10, 'USD', 0.00001, 'Forex');
  octx('USDTRY', 'USD vs TRY', 10, 'USD', 0.00001, 'Forex');
  // Índices CFD
  octx('#USSPX500', 'S&P 500 CFD', 1, 'USD', 0.01, 'Índices');
  octx('#USNDAQ100', 'Nasdaq 100 CFD', 1, 'USD', 0.01, 'Índices');
  octx('#US30', 'Dow Jones CFD', 1, 'USD', 1.0, 'Índices');
  octx('#Japan225', 'Nikkei CFD', 1, 'USD', 1.0, 'Índices');
  octx('#Germany40', 'DAX 40 CFD', 1, 'EUR', 0.1, 'Índices');
  octx('#UK100', 'FTSE 100 CFD', 1, 'USD', 0.1, 'Índices');
  octx('#France40', 'France 40 CFD', 1, 'EUR', 0.1, 'Índices');
  octx('#Spain35', 'Spain 35 CFD', 1, 'EUR', 0.1, 'Índices');
  octx('#Europe50', 'Euro Stoxx 50 CFD', 1, 'EUR', 0.1, 'Índices');
  octx('#Australia200', 'ASX 200 CFD', 1, 'USD', 0.1, 'Índices');
  octx('#HongKong50', 'Hang Seng CFD', 1, 'USD', 1.0, 'Índices');
  octx('#China50', 'China A50 CFD', 1, 'USD', 1.0, 'Índices');
  // Materias primas CFD
  octx('GOLD', 'Gold CFD', 1, 'USD', 0.01, 'Metales');
  octx('SILVER', 'Silver CFD', 5, 'USD', 0.001, 'Metales');
  octx('COPPER', 'Copper CFD', 6.25, 'USD', 0.0001, 'Metales Spot');
  octx('ZINC', 'Zinc CFD', 6.25, 'USD', 0.25, 'Metales Spot');
  octx('ALUMINIUM', 'Aluminium CFD', 6.25, 'USD', 0.25, 'Metales Spot');
  octx('WTI', 'Crude Oil WTI CFD', 10, 'USD', 0.01, 'Energía');
  octx('NAT.GAS', 'Natural Gas CFD', 10, 'USD', 0.001, 'Energía');
  octx('BRENT', 'Brent Crude CFD', 10, 'USD', 0.01, 'Energía');
  // Crypto
  octx('BITCOIN', 'Bitcoin CFD', 1, 'USD', 1.0, 'Crypto');
  octx('ETHEREUM', 'Ethereum CFD', 1, 'USD', 0.01, 'Crypto');
  octx('LITECOIN', 'Litecoin CFD', 1, 'USD', 0.01, 'Crypto');
  octx('RIPPLE', 'Ripple CFD', 1, 'USD', 0.0001, 'Crypto');
  octx('AAVE', 'AAVE CFD', 1, 'USD', 0.01, 'Crypto');
  // Acciones USA
  octx('AAPL.O', 'Apple', 1, 'USD', 0.01, 'Acciones USA');
  octx('MSFT.O', 'Microsoft', 1, 'USD', 0.01, 'Acciones USA');
  octx('AMZN.O', 'Amazon', 1, 'USD', 0.01, 'Acciones USA');
  octx('GOOGL.O', 'Alphabet', 1, 'USD', 0.01, 'Acciones USA');
  octx('META.O', 'Meta Platforms', 1, 'USD', 0.01, 'Acciones USA');
  octx('TSLA.O', 'Tesla', 1, 'USD', 0.01, 'Acciones USA');
  octx('NVDA.O', 'NVIDIA', 1, 'USD', 0.01, 'Acciones USA');
  octx('AMD.O', 'AMD', 1, 'USD', 0.01, 'Acciones USA');
  octx('NFLX.O', 'Netflix', 1, 'USD', 0.01, 'Acciones USA');
  octx('DIS.N', 'Disney', 1, 'USD', 0.01, 'Acciones USA');
  octx('GIS.N', 'General Mills', 1, 'USD', 0.01, 'Acciones USA');
  octx('WIX.O', 'Wix.com', 1, 'USD', 0.01, 'Acciones USA');
  octx('BABA.N', 'Alibaba', 1, 'USD', 0.01, 'Acciones USA');
  octx('TSM.N', 'TSMC', 1, 'USD', 0.01, 'Acciones USA');
  octx('V.N', 'Visa', 1, 'USD', 0.01, 'Acciones USA');
  octx('JPM.N', 'JPMorgan', 1, 'USD', 0.01, 'Acciones USA');
  octx('BAC.N', 'Bank of America', 1, 'USD', 0.01, 'Acciones USA');
  octx('GS.N', 'Goldman Sachs', 1, 'USD', 0.01, 'Acciones USA');
  octx('XOM.N', 'ExxonMobil', 1, 'USD', 0.01, 'Acciones USA');
  octx('CVX.N', 'Chevron', 1, 'USD', 0.01, 'Acciones USA');
  octx('VOO.N', 'Vanguard S&P 500 ETF', 1, 'USD', 0.01, 'ETFs');
  // Acciones UK (GBX)
  octx('HILS.L', 'Hill & Smith', 1, 'GBX', 0.01, 'Acciones UK');
  octx('HLMA.L', 'Halma PLC', 1, 'GBX', 0.01, 'Acciones UK');
  octx('AZN.L', 'AstraZeneca', 1, 'GBX', 0.01, 'Acciones UK');
  octx('SHEL.L', 'Shell', 1, 'GBX', 0.01, 'Acciones UK');
  octx('HSBA.L', 'HSBC', 1, 'GBX', 0.01, 'Acciones UK');
  octx('BP.L', 'BP', 1, 'GBX', 0.01, 'Acciones UK');
  octx('VOD.L', 'Vodafone', 1, 'GBX', 0.01, 'Acciones UK');
  octx('LLOY.L', 'Lloyds Banking', 1, 'GBX', 0.01, 'Acciones UK');
  octx('RIO.L', 'Rio Tinto', 1, 'GBX', 0.01, 'Acciones UK');
  octx('GLEN.L', 'Glencore', 1, 'GBX', 0.01, 'Acciones UK');

  return out;
})();


const fmt = (n: number, d = 4) => Number.isFinite(n) ? n.toFixed(d) : '—';
const fmtEur = (n: number) => Number.isFinite(n) ? `€${n.toFixed(2)}` : '—';

function CalculatorPage() {
  const { data: settings } = useSettings();
  const { data: latestVixSession } = useLatestVix();
  const balanceNkis = settings?.balance_nkis != null ? Number(settings.balance_nkis) : 0;
  const balanceOctx = settings?.balance_octx != null ? Number(settings.balance_octx) : 0;

  const [account, setAccount] = useState<Account>('darwinex');
  const [capital, setCapital] = useState<number>(balanceNkis);
  const [capitalManual, setCapitalManual] = useState(false);
  const [instrument, setInstrument] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [entry, setEntry] = useState<string>('');
  const [atr, setAtr] = useState<string>('');
  const [riskPct, setRiskPct] = useState<string>('1');
  const [riskManual, setRiskManual] = useState(false);
  const [pointValue, setPointValue] = useState<string>('1');
  const [tickSize, setTickSize] = useState<number | null>(null);
  const [vix, setVix] = useState<string>('');
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [tp, setTp] = useState<string>('');
  const [tableOpen, setTableOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // Auto-load VIX from latest scanner session (read-only, never editable manually).
  useEffect(() => {
    const v = latestVixSession?.vix;
    setVix(v != null ? String(v) : '');
  }, [latestVixSession?.vix, latestVixSession?.created_at]);

  // Auto-update risk % from VIX according to CAP table, unless user overrode it.
  useEffect(() => {
    if (riskManual) return;
    const v = latestVixSession?.vix != null ? Number(latestVixSession.vix) : null;
    const cap = getCapRiskFromVix(v);
    if (cap.riskPct != null) setRiskPct(String(cap.riskPct));
  }, [latestVixSession?.vix, riskManual]);

  // Sync balance from Supabase whenever settings load/change, unless the user
  // overrode the value manually for this session.
  useEffect(() => {
    if (capitalManual) return;
    setCapital(account === 'darwinex' ? balanceNkis : balanceOctx);
  }, [account, balanceNkis, balanceOctx, capitalManual]);

  const onAccountChange = (a: Account) => {
    setAccount(a);
    setCapitalManual(false);
    setCapital(a === 'darwinex' ? balanceNkis : balanceOctx);
  };

  const nEntry = parseFloat(entry) || 0;
  const nAtr = parseFloat(atr) || 0;
  const nRisk = parseFloat(riskPct) || 0;
  const nPv = parseFloat(pointValue) || 0;
  const nVix = vix === '' ? null : parseFloat(vix);
  const nCurrent = parseFloat(currentPrice) || 0;
  const nTp = tp === '' ? null : parseFloat(tp);

  const instrumentDescription = useMemo(() => {
    const sym = instrument.trim();
    if (!sym) return '';
    const up = sym.toUpperCase();
    const root = up.split('_')[0];
    const auto = AUTOCOMPLETE.find(a => a.symbol.toUpperCase() === up)
      ?? AUTOCOMPLETE.find(a => a.family.toUpperCase() === root);
    if (auto) return auto.description;
    const inst = INSTRUMENTS.find(i => i.symbol.toUpperCase() === up);
    return inst?.description ?? '';
  }, [instrument]);

  const vixInfo = useMemo(() => {
    if (nVix == null || !Number.isFinite(nVix)) return null;
    if (nVix < 25) return { msg: 'Riesgo normal — usar 1%', color: 'text-success', blocked: false };
    if (nVix < 35) return { msg: 'Volatilidad alta — reducir a 0.7%', color: 'text-[#B85C00]', blocked: false };
    if (nVix < 45) return { msg: 'Volatilidad muy alta — reducir a 0.5%', color: 'text-[#B85C00]', blocked: false };
    return { msg: '⚠️ Sistema bloqueado — no operar', color: 'text-destructive', blocked: true };
  }, [nVix]);
  const blocked = vixInfo?.blocked ?? false;

  const slDist = nAtr * 1.5;
  const slPrice = direction === 'BUY' ? nEntry - slDist : nEntry + slDist;
  const riskEur = capital * (nRisk / 100);
  // Si el instrumento existe en CONTRACT_SPECS usamos calcLots (tiene en cuenta volumeMin/step).
  // Si no, fallback al cálculo simple con el pointValue resuelto.
  const specLots = instrument && slDist > 0 ? calcLots(riskEur, slDist, instrument) : 0;
  const lotsRaw = specLots > 0
    ? specLots
    : (slDist > 0 && nPv > 0 ? riskEur / (slDist * nPv) : 0);
  const lots = Math.max(0.01, Math.min(10, Math.round(lotsRaw * 100) / 100));
  const minLotWarning = lotsRaw > 0 && lotsRaw < 0.01;

  const beActivate = direction === 'BUY' ? nEntry + nAtr : nEntry - nAtr;
  const beSl = direction === 'BUY' ? nEntry + nAtr * 0.2 : nEntry - nAtr * 0.2;

  const trailDist = nAtr * 1.5;
  const trailSl = direction === 'BUY' ? nCurrent - trailDist : nCurrent + trailDist;
  const effectiveTickSize = tickSize && tickSize > 0
    ? tickSize
    : (instrument ? (getContractSpec(instrument)?.tickSize ?? null) : null);
  const trailMt5Points = effectiveTickSize && effectiveTickSize > 0 && trailDist > 0
    ? Math.round(trailDist / effectiveTickSize)
    : null;
  const floatPnl = direction === 'BUY'
    ? (nCurrent - nEntry) * lots * nPv
    : (nEntry - nCurrent) * lots * nPv;

  const realRisk = slDist * lots * nPv;
  const tpDist = nTp != null ? Math.abs(nTp - nEntry) : 0;
  const tpProfit = nTp != null ? tpDist * lots * nPv : 0;
  const rr = slDist > 0 && nTp != null ? tpDist / slDist : 0;
  const rrColor = rr >= 1.5 ? 'text-success' : rr >= 1 ? 'text-[#B85C00]' : 'text-destructive';

  const filteredInstruments = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return INSTRUMENTS;
    return INSTRUMENTS.filter(i =>
      i.symbol.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    );
  }, [tableSearch]);

  const pickInstrument = (row: InstrumentRow) => {
    setInstrument(row.symbol);
    // Try to find tickSize from autocomplete catalog by family/symbol match
    const auto = AUTOCOMPLETE.find(
      a => a.broker === row.broker && (a.symbol === row.symbol || a.family === row.symbol.split('_')[0]),
    );
    // Override with real MT5 contract spec if available
    const resolved = resolveSpec(row.symbol, row.pointValue, auto?.tickSize ?? null);
    setPointValue(String(resolved.pointValue));
    setTickSize(resolved.tickSize);
    if (row.broker === 'darwinex') onAccountChange('darwinex');
    else onAccountChange('octx');
    setTableOpen(false);
    toast.success(`${row.symbol} cargado — valor punto: ${resolved.pointValue}`);
    if (row.currency === 'GBX') {
      toast.warning(`${row.symbol} cotiza en peniques (GBX)`, {
        description: 'El precio en MT5 ya está en peniques — úsalo directamente. P/L también en GBX. Para convertir a GBP divide entre 100.',
        duration: 8000,
      });
    }
  };

  const clearAll = () => {
    setInstrument(''); setEntry(''); setAtr(''); setRiskPct('1'); setRiskManual(false);
    setPointValue('1'); setTickSize(null); setCurrentPrice(''); setTp('');
    toast.success('Calculadora limpiada');
  };

  const copySummary = async () => {
    const lines = [
      `INSTRUMENTO: ${instrument || '—'} — ${direction}`,
      `Entrada:     ${fmt(nEntry)}`,
      `Stop Loss:   ${fmt(slPrice)}`,
      `Lotes:       ${lots.toFixed(2)}`,
      `Riesgo:      ${fmtEur(realRisk)}`,
      `Breakeven:   ${fmt(beActivate)} → mover SL a ${fmt(beSl)}`,
      `Trailing:    ATR × 1.5`,
      nTp != null ? `TP:          ${fmt(nTp)}  (RR ${rr.toFixed(2)}:1)` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      toast.success('Resumen copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const recoverCalculation = (r: CalcRecord) => {
    if (r.broker === 'darwinex' || r.broker === 'octx') {
      setAccount(r.broker);
    }
    if (r.cuenta_balance != null) setCapital(Number(r.cuenta_balance));
    if (r.instrumento) setInstrument(r.instrumento);
    if (r.direccion === 'BUY' || r.direccion === 'SELL') setDirection(r.direccion);
    if (r.precio_entrada != null) setEntry(String(r.precio_entrada));
    if (r.atr != null) setAtr(String(r.atr));
    if (r.valor_punto != null) setPointValue(String(r.valor_punto));
    setVix(r.vix != null ? String(r.vix) : '');
    setCurrentPrice('');
    setTp('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveCalculation = async () => {
    if (!(nEntry > 0) || !(slPrice > 0) || !(lots > 0) || !instrument.trim()) {
      toast.error('Completa el cálculo antes de guardar');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('calculadora_registro').insert({
        instrumento: instrument.trim(),
        broker: account,
        direccion: direction,
        precio_entrada: nEntry,
        stop_loss: slPrice,
        distancia_stop: slDist,
        lotes: lots,
        riesgo_real: realRisk,
        breakeven_precio: beActivate,
        breakeven_sl: beSl,
        trailing_sl: Number.isFinite(trailSl) ? trailSl : null,
        atr: nAtr,
        valor_punto: nPv,
        cuenta_balance: capital,
        vix: nVix ?? null,
      });
      if (error) throw error;
      toast.success('✓ Cálculo guardado', { duration: 2000 });
    } catch (e: any) {
      toast.error('✗ Error al guardar', { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 lg:space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-2xl font-bold tracking-tight">Calculadora</h1>
        <p className="text-sm lg:text-sm text-muted-foreground mt-1">
          Calculadora de posición CAP Trend Following. Cálculo en tiempo real.
        </p>
      </div>

      {blocked && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-sm font-semibold">VIX &gt; 45 — Sistema bloqueado. No operar.</div>
        </div>
      )}

      {/* RESUMEN OPERATIVO */}
      <section
        className="rounded-xl border-2 p-3 sm:p-4 lg:p-6 bg-card"
        style={{ borderColor: '#2962FF' }}
      >
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-base font-bold uppercase tracking-wider flex items-center gap-2">
            📋 Resumen operativo
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col">
              <div className="text-lg font-bold font-data leading-tight">
                <span className="text-foreground">{instrument || '—'}</span>{' '}
                <span className={direction === 'BUY' ? 'text-success' : 'text-destructive'}>
                  {direction === 'BUY' ? '▲ BUY' : '▼ SELL'}
                </span>
              </div>
              {instrumentDescription && (
                <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {instrumentDescription}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={copySummary} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20">
                <Copy className="w-3.5 h-3.5" /> Copiar resumen
              </button>
              <button
                onClick={saveCalculation}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success text-xs font-medium hover:bg-success/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando…' : 'Guardar cálculo'}
              </button>
              <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-muted-foreground text-xs font-medium hover:text-foreground">
                <Trash2 className="w-3.5 h-3.5" /> Limpiar
              </button>
            </div>
          </div>
        </div>

        {/* Fila principal: Entrada / SL / Lotes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-5 border-b border-border">
          <BigStat label="ENTRADA" value={fmt(nEntry)} hint="precio actual" />
          <BigStat label="STOP LOSS" value={fmt(slPrice)} hint="precio exacto" />
          <BigStat label="LOTES" value={lots.toFixed(2)} hint="en MT5" />
        </div>

        {/* Fila secundaria: Riesgo / Breakeven / Trailing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          <MidStat label="RIESGO REAL" value={fmtEur(realRisk)} />
          <MidStat
            label="BREAKEVEN"
            value={fmt(beActivate)}
            hint={`mover SL a ${fmt(beSl)} cuando llegue`}
          />
          <MidStat
            label="TRAILING SL"
            value={trailMt5Points != null ? `${trailMt5Points} pts` : 'ATR × 1.5'}
            hint={trailMt5Points != null ? 'introducir en MT5' : `distancia: ${fmt(trailDist)}`}
          />
        </div>

        {nTp != null && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
            <MidStat label="TAKE PROFIT" value={fmt(nTp)} />
            <MidStat label="RR RATIO" value={`${rr.toFixed(2)}:1`} hintClass={rrColor} />
          </div>
        )}

        {vixInfo && (
          <div className={`mt-5 text-sm ${vixInfo.color ?? 'text-muted-foreground'}`}>
            ⚠ {vixInfo.msg}
          </div>
        )}
      </section>

      <CalculatorHistory onRecover={recoverCalculation} />

      {/* INPUTS */}
      <section className="rounded-xl border-2 border-border bg-card p-3 sm:p-4 lg:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Datos de entrada</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cuenta */}
          <Field label="Cuenta">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAccountChange('darwinex')}
                className={`flex-1 px-3 py-2.5 sm:py-2 rounded-md text-base sm:text-sm font-medium border transition-colors ${
                  account === 'darwinex' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                NKIS · €{balanceNkis.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
              </button>
              <button
                type="button"
                onClick={() => onAccountChange('octx')}
                className={`flex-1 px-3 py-2.5 sm:py-2 rounded-md text-base sm:text-sm font-medium border transition-colors ${
                  account === 'octx' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                OCTX · €{balanceOctx.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
              </button>
            </div>
            <NumInput
              value={capital}
              onChange={(n) => { setCapital(n); setCapitalManual(true); }}
              className="mt-2"
            />
          </Field>

          {/* Instrumento */}
          <Field label="Instrumento">
            <InstrumentAutocomplete
              value={instrument}
              onChange={setInstrument}
              onSelect={(e) => {
                setInstrument(e.symbol);
                // Override with real MT5 contract spec if available
                const resolved = resolveSpec(e.symbol, e.pointValue, e.tickSize ?? null);
                setPointValue(String(resolved.pointValue));
                setTickSize(resolved.tickSize);
                onAccountChange(e.broker);
                toast.success(`${e.symbol} cargado — valor punto: ${resolved.pointValue} ${e.currency}`);
                if (e.currency === 'GBX') {
                  toast.warning(`${e.symbol} cotiza en peniques (GBX)`, {
                    description: 'Usa el precio MT5 directamente. P/L en GBX. Divide entre 100 para GBP.',
                    duration: 8000,
                  });
                }
              }}
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setTableOpen(o => !o)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
              >
                {tableOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {tableOpen ? 'Ocultar tabla de instrumentos' : 'Ver tabla de instrumentos'}
              </button>
            </div>
          </Field>

          {/* Tabla desplegada — ocupa las dos columnas */}
          {tableOpen && (
            <div className="md:col-span-2">
              <InstrumentTable
                search={tableSearch}
                onSearch={setTableSearch}
                rows={filteredInstruments}
                onPick={pickInstrument}
              />
            </div>
          )}

          {/* Dirección */}
          <Field label="Dirección">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`flex-1 px-3 py-2.5 sm:py-2 rounded-md text-base sm:text-sm font-bold border transition-colors ${
                  direction === 'BUY' ? 'border-success bg-success/15 text-success' : 'border-border bg-secondary text-muted-foreground'
                }`}
              >▲ BUY</button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`flex-1 px-3 py-2.5 sm:py-2 rounded-md text-base sm:text-sm font-bold border transition-colors ${
                  direction === 'SELL' ? 'border-destructive bg-destructive/15 text-destructive' : 'border-border bg-secondary text-muted-foreground'
                }`}
              >▼ SELL</button>
            </div>
          </Field>

          <Field label="Precio de entrada">
            <input
              type="number" step="any" inputMode="decimal"
              value={entry} onChange={e => setEntry(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 sm:h-10 rounded-md border border-input bg-transparent px-3 text-base sm:text-sm font-data"
            />
          </Field>

          <Field label="ATR (14)" hint="Cópialo de MT5: Insertar → Indicadores → ATR período 14">
            <input
              type="number" step="any" inputMode="decimal"
              value={atr} onChange={e => setAtr(e.target.value)}
              placeholder="0.00"
              className="w-full h-11 sm:h-10 rounded-md border border-input bg-transparent px-3 text-base sm:text-sm font-data"
            />
          </Field>

          <Field label="% Riesgo" hint="Sistema CAP: 1% por trade">
            <input
              type="number" step="0.1" min="0.1" max="3" inputMode="decimal"
              value={riskPct} onChange={e => setRiskPct(e.target.value)}
              className="w-full h-11 sm:h-10 rounded-md border border-input bg-transparent px-3 text-base sm:text-sm font-data"
            />
          </Field>

          <Field label="Valor del punto (auto)" hint="Cargado automáticamente desde las especificaciones MT5 al seleccionar el instrumento">
            <input
              type="number" step="any" inputMode="decimal"
              value={pointValue}
              readOnly
              className="w-full h-11 sm:h-10 rounded-md border border-input bg-muted/40 px-3 text-base sm:text-sm font-data text-muted-foreground cursor-not-allowed"
            />
          </Field>

          <Field label="VIX actual (opcional)" hint={vixInfo?.msg ?? 'Si lo rellenas, sugerimos % de riesgo según volatilidad'} hintClass={vixInfo?.color}>
            <input
              type="number" step="0.1" inputMode="decimal"
              value={vix} onChange={e => setVix(e.target.value)}
              placeholder="—"
              className="w-full h-11 sm:h-10 rounded-md border border-input bg-transparent px-3 text-base sm:text-sm font-data"
            />
          </Field>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResultCard title="Stop Loss">
          <Row label="Distancia (ATR × 1.5)"><Big>{fmt(slDist)}</Big></Row>
          <Row label={`Precio SL (${direction})`}><Big className={direction === 'BUY' ? 'text-destructive' : 'text-destructive'}>{fmt(slPrice)}</Big></Row>
        </ResultCard>

        <ResultCard title="Tamaño de posición">
          <Row label="Riesgo real de la operación"><Big>{fmtEur(realRisk)}</Big></Row>
          <Row label="Lotes">
            <Big>{lots.toFixed(2)}</Big>
          </Row>
          {minLotWarning && (
            <div className="text-xs text-[#B85C00] mt-1">
              Lote mínimo — capital insuficiente para más
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-2">Límite {nRisk}%: {fmtEur(riskEur)}</div>
          <div className="text-[10px] text-muted-foreground">mínimo 0.01, máximo 10</div>
        </ResultCard>

        <ResultCard title="Breakeven">
          <Row label={`Activar cuando precio llegue a (${direction})`}>
            <Big>{fmt(beActivate)}</Big>
          </Row>
          <Row label="Mover SL a">
            <Big>{fmt(beSl)}</Big>
          </Row>
          <div className="text-xs text-success mt-2">✓ A partir de aquí: trade 0 riesgo</div>
        </ResultCard>

        <ResultCard title="Trailing Stop">
          <Row label="Distancia (ATR × 1.5)">
            <Big>{fmt(trailDist)}</Big>
          </Row>
          <Row label="Puntos para MT5">
            <Big className="text-success">
              {trailMt5Points != null ? String(trailMt5Points) : '—'}
            </Big>
          </Row>
          <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
            En MT5: clic derecho sobre la posición → <span className="text-foreground font-medium">Trailing Stop</span> → <span className="text-foreground font-medium">Personalizado</span> → introducir{' '}
            <span className="text-success font-data font-semibold">
              {trailMt5Points != null ? String(trailMt5Points) : '[puntos]'}
            </span>{' '}
            puntos.
          </div>
        </ResultCard>

        <ResultCard title="Ratio Riesgo / Beneficio" className="md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">TP objetivo (opcional)</label>
              <input
                type="number" step="any" inputMode="decimal"
                value={tp} onChange={e => setTp(e.target.value)}
                placeholder="—"
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-data"
              />
              <Row label="Riesgo real" className="mt-3">
                <Big className="text-destructive">−{fmtEur(realRisk)}</Big>
              </Row>
            </div>
            <div>
              {nTp != null ? (
                <>
                  <Row label={`Beneficio potencial (TP ${fmt(nTp)})`}>
                    <Big className="text-success">+{fmtEur(tpProfit)}</Big>
                  </Row>
                  <Row label="RR ratio">
                    <Big className={rrColor}>{rr.toFixed(2)}:1</Big>
                  </Row>
                  <div className="text-xs text-muted-foreground mt-1">RR mínimo recomendado: 1.5:1</div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground italic h-full flex items-center">
                  Sin TP fijo: trailing gestiona la salida
                </div>
              )}
            </div>
          </div>
        </ResultCard>
      </section>
    </div>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="font-data font-bold leading-none text-foreground text-[2rem] sm:text-[2.25rem] lg:text-[2.25rem]">{value}</div>
      {hint && <div className="text-[12px] sm:text-[11px] text-muted-foreground mt-1.5">{hint}</div>}
    </div>
  );
}

function MidStat({ label, value, hint, hintClass }: { label: string; value: string; hint?: string; hintClass?: string }) {
  return (
    <div>
      <div className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`font-data font-bold text-2xl sm:text-xl ${hintClass ?? 'text-foreground'}`}>{value}</div>
      {hint && <div className="text-[12px] sm:text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Field({ label, children, hint, hintClass }: { label: string; children: React.ReactNode; hint?: string; hintClass?: string }) {
  return (
    <div>
      <label className="text-sm sm:text-xs text-muted-foreground block mb-1.5 font-medium">{label}</label>
      {children}
      {hint && <div className={`text-[12px] sm:text-[11px] mt-1 ${hintClass ?? 'text-muted-foreground'}`}>{hint}</div>}
    </div>
  );
}

function NumInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <input
      type="number" step="any" inputMode="decimal"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className={`w-full h-11 sm:h-9 rounded-md border border-input bg-transparent px-3 text-base sm:text-sm font-data ${className ?? ''}`}
    />
  );
}

function ResultCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-3 sm:p-4 ${className ?? ''}`}>
      <h3 className="text-[12px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className ?? ''}`}>
      <span className="text-sm sm:text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Big({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-data text-2xl md:text-3xl font-bold text-foreground ${className ?? ''}`}>{children}</span>;
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground text-xs">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function InstrumentTable({
  search, onSearch, rows, onPick,
}: {
  search: string;
  onSearch: (s: string) => void;
  rows: InstrumentRow[];
  onPick: (r: InstrumentRow) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, InstrumentRow[]>();
    rows.forEach(r => {
      const key = `${r.broker === 'darwinex' ? 'NKIS' : 'OCTX'} · ${r.group}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-card">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar por símbolo o descripción..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-transparent text-sm"
          />
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {grouped.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Sin resultados</div>
        )}
        {grouped.map(([group, items]) => (
          <div key={group}>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/50 font-semibold sticky top-0">
              {group}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="hidden md:table-header-group">
                  <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
                    <th className="px-3 py-1.5 font-medium">Símbolo</th>
                    <th className="px-3 py-1.5 font-medium">Descripción</th>
                    <th className="px-3 py-1.5 font-medium">Divisa</th>
                    <th className="px-3 py-1.5 font-medium text-right">Val/pto</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => (
                    <tr
                      key={`${r.broker}-${r.symbol}`}
                      onClick={() => onPick(r)}
                      title={r.note || undefined}
                      className="cursor-pointer border-b border-border/50 hover:bg-primary/10 transition-colors"
                    >
                      <td className="px-3 py-2 font-data font-semibold whitespace-nowrap">
                        {r.symbol}
                        {r.variable && (
                          <span
                            title="El valor exacto depende del tipo de cambio actual. Usa este valor como aproximación."
                            className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/40 align-middle"
                          >VAR</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                        {r.description}
                        {r.note && (
                          <div className={`text-[10px] mt-0.5 font-semibold ${r.warn ? 'text-destructive' : 'text-orange-700 dark:text-orange-300'}`}>{r.note}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {r.currency ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${CURRENCY_BADGE[r.currency]}`}>
                            {r.currency}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-data font-bold text-foreground whitespace-nowrap">
                        {r.variable ? `~${r.pointValue}` : r.pointValue}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs text-primary md:hidden">Usar →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
        OCTX: con apalancamiento 1:30 el margen requerido = valor posición / 30. El riesgo se calcula sobre el capital real.
        El valor del punto exacto varía según el instrumento — consulta especificaciones en MT5 (clic derecho → Especificaciones).
      </div>
    </div>
  );
}

// ============================================================
// Autocomplete instrumento — buscador con dropdown
// ============================================================
function InstrumentAutocomplete({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (e: AutocompleteEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selectedDesc, setSelectedDesc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unified pool: AUTOCOMPLETE catalog + every instrument from the table
  // (INSTRUMENTS) so the search field can predict any symbol shown in the
  // instruments table, not just curated futures families.
  const pool = useMemo<AutocompleteEntry[]>(() => {
    const seen = new Set<string>();
    const out: AutocompleteEntry[] = [];
    for (const e of AUTOCOMPLETE) {
      const key = `${e.broker}|${e.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    for (const i of INSTRUMENTS) {
      const key = `${i.broker}|${i.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = (i.currency ?? 'USD') as 'USD' | 'EUR' | 'GBX';
      const safeCur: 'USD' | 'EUR' | 'GBX' = cur === 'USD' || cur === 'EUR' || cur === 'GBX' ? cur : 'USD';
      out.push({
        symbol: i.symbol,
        family: i.symbol.split('_')[0],
        description: i.description,
        pointValue: i.pointValue,
        currency: safeCur,
        broker: i.broker,
        group: i.group,
      });
    }
    return out;
  }, []);

  const q = value.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return pool.filter(
      e =>
        e.symbol.toLowerCase().includes(q) ||
        e.family.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    ).slice(0, 80);
  }, [q, pool]);

  const grouped = useMemo(() => {
    const map = new Map<string, AutocompleteEntry[]>();
    for (const r of results) {
      const key = `${r.broker}|${r.family}|${r.description}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.values());
  }, [results]);

  const flat = useMemo(() => grouped.flat(), [grouped]);

  useEffect(() => { setHighlight(0); }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSelect = (e: AutocompleteEntry) => {
    setSelectedDesc(`${e.description} · ${e.pointValue} ${e.currency} por punto · ${e.broker === 'darwinex' ? 'NKIS' : 'OCTX'}`);
    setOpen(false);
    onSelect(e);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Escape') { setOpen(false); return; }
    if (!open && (ev.key === 'ArrowDown' || ev.key === 'Enter')) { setOpen(true); return; }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setHighlight(h => Math.min(h + 1, flat.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (ev.key === 'Enter' && flat[highlight]) {
      ev.preventDefault();
      handleSelect(flat[highlight]);
    }
  };

  let flatIdx = -1;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setSelectedDesc(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Escribe símbolo... ej: HG, LE, ZL, copper"
          autoComplete="off"
          spellCheck={false}
          className="w-full h-10 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm font-data focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {selectedDesc && !open && (
        <div className="mt-1 text-[11px] text-muted-foreground truncate">{selectedDesc}</div>
      )}

      {open && q && (
        <div className="absolute z-50 mt-1 w-full max-h-[360px] overflow-y-auto rounded-md border border-border bg-card shadow-xl">
          {grouped.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Sin resultados para "{value}"
            </div>
          ) : (
            grouped.map((group, gi) => {
              const head = group[0];
              return (
                <div key={gi} className="border-b border-border/40 last:border-b-0">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center gap-2">
                    <span>{head.broker === 'darwinex' ? 'NKIS' : 'OCTX'}</span>
                    <span>·</span>
                    <span>{head.group}</span>
                    {group.length > 1 && (
                      <span className="ml-auto">{group.length} vencimientos</span>
                    )}
                  </div>
                  {group.map(entry => {
                    flatIdx++;
                    const isHi = flatIdx === highlight;
                    return (
                      <button
                        key={entry.symbol}
                        type="button"
                        onMouseEnter={() => setHighlight(flat.indexOf(entry))}
                        onClick={() => handleSelect(entry)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                          isHi ? '' : 'hover:bg-muted/40'
                        }`}
                        style={isHi ? { background: 'color-mix(in oklab, var(--primary) 18%, transparent)' } : undefined}
                      >
                        <span className="font-data font-semibold w-20 shrink-0">{entry.symbol}</span>
                        <span className="flex-1 text-muted-foreground truncate">{entry.description}</span>
                        <span className="font-data text-xs tabular-nums whitespace-nowrap">
                          {entry.pointValue.toLocaleString('en-US')} {entry.currency}
                        </span>
                        {entry.highValue && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/20 text-destructive border border-destructive/40 whitespace-nowrap">
                            ⚠ VALOR ALTO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
