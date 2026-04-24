import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Trash2, ChevronDown, ChevronUp, Search, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CalculatorHistory, type CalcRecord } from '@/components/calculator/CalculatorHistory';

export const Route = createFileRoute('/calculator')({
  head: () => ({
    meta: [
      { title: 'Calculadora — CAP Trading' },
      { name: 'description', content: 'Calculadora de posición CAP Trend Following' },
    ],
  }),
  component: CalculatorPage,
});

type Account = 'darwinex' | 'fxpro';
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
  broker: 'darwinex' | 'fxpro';
  currency?: Currency;
  variable?: boolean;
  warn?: boolean;
};

const HIGH_PV_WARNING = '⚠ Valor del punto muy alto — verificar lotes antes de operar';

const INSTRUMENTS: InstrumentRow[] = [
  // Darwinex - Agrícolas
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'KE_K/N', description: 'KC Wheat', pointValue: 50, currency: 'USD' },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZC_K/N', description: 'Corn', pointValue: 50, currency: 'USD' },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZL_K/N', description: 'Soybean Oil', pointValue: 600, currency: 'USD' },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZM_K/N', description: 'Soybean Meal', pointValue: 100, currency: 'USD' },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'ZS_K/N', description: 'Soybeans', pointValue: 50, currency: 'USD' },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'LE_M', description: 'Live Cattle', pointValue: 400, currency: 'USD' },
  { broker: 'darwinex', group: 'Agrícolas', symbol: 'HE_K', description: 'Lean Hogs', pointValue: 400, currency: 'USD' },
  // Energía
  { broker: 'darwinex', group: 'Energía', symbol: 'BZ_M/N', description: 'Brent Crude', pointValue: 1000, currency: 'USD' },
  { broker: 'darwinex', group: 'Energía', symbol: 'CL_M', description: 'Light Crude', pointValue: 1000, currency: 'USD' },
  { broker: 'darwinex', group: 'Energía', symbol: 'HO_K/M', description: 'Heating Oil', pointValue: 42000, currency: 'USD', warn: true, note: HIGH_PV_WARNING },
  { broker: 'darwinex', group: 'Energía', symbol: 'NG_K/M', description: 'Natural Gas', pointValue: 10000, currency: 'USD', warn: true, note: HIGH_PV_WARNING },
  { broker: 'darwinex', group: 'Energía', symbol: 'RB_K/M', description: 'RBOB Gasoline', pointValue: 42000, currency: 'USD', warn: true, note: HIGH_PV_WARNING },
  // Índices USA
  { broker: 'darwinex', group: 'Índices USA', symbol: 'ES_M', description: 'E-mini S&P 500', pointValue: 50, currency: 'USD' },
  { broker: 'darwinex', group: 'Índices USA', symbol: 'NQ_M', description: 'E-mini Nasdaq', pointValue: 20, currency: 'USD' },
  { broker: 'darwinex', group: 'Índices USA', symbol: 'RTY_M', description: 'E-mini Russell', pointValue: 50, currency: 'USD' },
  { broker: 'darwinex', group: 'Índices USA', symbol: 'YM_M', description: 'Mini Dow', pointValue: 5, currency: 'USD' },
  // Índices Europeos
  { broker: 'darwinex', group: 'Índices Europeos', symbol: 'FDAX_M', description: 'DAX', pointValue: 25, currency: 'EUR' },
  { broker: 'darwinex', group: 'Índices Europeos', symbol: 'FESX_M', description: 'Euro Stoxx 50', pointValue: 10, currency: 'EUR' },
  { broker: 'darwinex', group: 'Índices Europeos', symbol: 'FGBL_M', description: 'Bund', pointValue: 1000, currency: 'EUR' },
  // Metales
  { broker: 'darwinex', group: 'Metales', symbol: 'GC_M', description: 'Gold', pointValue: 100, currency: 'USD' },
  { broker: 'darwinex', group: 'Metales', symbol: 'HG_K/N', description: 'Copper', pointValue: 25000, currency: 'USD', warn: true, note: HIGH_PV_WARNING },
  { broker: 'darwinex', group: 'Metales', symbol: 'SI_K/N', description: 'Silver', pointValue: 5000, currency: 'USD', warn: true, note: HIGH_PV_WARNING },
  { broker: 'darwinex', group: 'Metales', symbol: 'PL_N', description: 'Platinum', pointValue: 50, currency: 'USD' },
  // Divisas
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6A_M', description: 'AUD/USD', pointValue: 10, currency: 'USD' },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6B_M', description: 'GBP/USD', pointValue: 6.25, currency: 'USD' },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6C_M', description: 'CAD/USD', pointValue: 10, currency: 'USD' },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6E_M', description: 'EUR/USD', pointValue: 12.5, currency: 'USD' },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6J_M', description: 'JPY/USD', pointValue: 12.5, currency: 'USD' },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6N_M', description: 'NZD/USD', pointValue: 10, currency: 'USD' },
  { broker: 'darwinex', group: 'Divisas (FX Futuros)', symbol: '6S_M', description: 'CHF/USD', pointValue: 12.5, currency: 'USD' },
  // Bonos
  { broker: 'darwinex', group: 'Bonos USA', symbol: 'ZN_M', description: '10Y T-Note', pointValue: 1000, currency: 'USD' },
  // ===== FXPro — Metales Spot =====
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'ZINC', description: 'Zinc Spot', pointValue: 6.25, currency: 'USD' },
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'ALUMINIUM', description: 'Aluminium Spot', pointValue: 6.25, currency: 'USD' },
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'COPPER', description: 'Copper Spot', pointValue: 6.25, currency: 'USD' },
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'GOLD', description: 'Gold Spot', pointValue: 1.0, currency: 'USD' },
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'SILVER', description: 'Silver Spot', pointValue: 5.0, currency: 'USD' },
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'PLATINUM', description: 'Platinum Spot', pointValue: 0.5, currency: 'USD' },
  { broker: 'fxpro', group: 'Metales Spot', symbol: 'PALLADIUM', description: 'Palladium Spot', pointValue: 0.5, currency: 'USD' },
  // ===== FXPro — Índices CFD =====
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#Japan225', description: 'Japan 225 CFD', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#USNDAQ100', description: 'US Nasdaq 100', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#USSPX500', description: 'US S&P 500', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#US30', description: 'US Dow Jones', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#UK100', description: 'UK 100', pointValue: 0.01, currency: 'GBP' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#Germany40', description: 'DAX 40', pointValue: 0.01, currency: 'EUR' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#Euro50', description: 'Euro Stoxx 50', pointValue: 0.01, currency: 'EUR' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#AUS200', description: 'Australia 200', pointValue: 0.01, currency: 'AUD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#Spain35', description: 'Spain 35', pointValue: 0.01, currency: 'EUR' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#France40', description: 'France 40', pointValue: 0.01, currency: 'EUR' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#Swiss20', description: 'Switzerland 20', pointValue: 0.01, currency: 'CHF' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#Holland25', description: 'Netherlands 25', pointValue: 0.01, currency: 'EUR' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#HongKong50', description: 'Hong Kong 50', pointValue: 0.01, currency: 'HKD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#ChinaA50', description: 'China A50', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Índices CFD', symbol: '#ChinaHShar', description: 'China H-Shares', pointValue: 0.01, currency: 'HKD' },
  // ===== FXPro — Acciones USA =====
  ...([
    ['AMD.O', 'Advanced Micro Devices'], ['AAPL.O', 'Apple Inc'], ['AMZN.O', 'Amazon'],
    ['AXON.O', 'Axon Enterprise'], ['GD.N', 'General Dynamics'], ['GIS.N', 'General Mills'],
    ['GOOGL.O', 'Alphabet'], ['HD.N', 'Home Depot'], ['HBAN.O', 'Huntington Bancshares'],
    ['HCA.N', 'HCA Healthcare'], ['HEI.N', 'HEICO Corp'], ['HIG.N', 'Hartford Financial'],
    ['HII.N', 'Huntington Ingalls'], ['HL.N', 'Hecla Mining'], ['HLF.N', 'Herbalife'],
    ['HUBS.N', 'HubSpot'], ['LHX.N', 'L3Harris Technologies'], ['LMT.N', 'Lockheed Martin'],
    ['META.O', 'Meta Platforms'], ['MSFT.O', 'Microsoft'], ['NET.N', 'Cloudflare'],
    ['NOC.N', 'Northrop Grumman'], ['NVDA.O', 'NVIDIA'], ['ORCL.N', 'Oracle'],
    ['PLTR.O', 'Palantir'], ['RBLX.N', 'Roblox'], ['RKLB.O', 'Rocket Lab'],
    ['RTX.N', 'RTX Corp'], ['SHOP.O', 'Shopify'], ['SPOT.N', 'Spotify'],
    ['TDG.N', 'TransDigm'], ['TER.O', 'Teradyne'], ['TSLA.O', 'Tesla'],
    ['TXT.N', 'Textron'], ['U.N', 'Unity Software'], ['VMC.N', 'Vulcan Materials'],
    ['WIX.O', 'Wix.com'],
  ] as const).map(([symbol, description]): InstrumentRow => ({
    broker: 'fxpro', group: 'Acciones USA', symbol, description, pointValue: 0.01, currency: 'USD',
  })),
  // ===== FXPro — Acciones UK (cotizan en GBX, peniques) =====
  ...([
    ['HILS.L', 'Hill & Smith PLC'],
    ['HLMA.L', 'Halma PLC'],
    ['HIK.L', 'Hikma Pharmaceuticals'],
    ['HICL.L', 'HICL Infrastructure'],
    ['HFD.L', 'Halfords Group'],
    ['HFEL.L', 'Henderson Far East'],
    ['HFG.L', 'Hilton Food Group'],
    ['HBR.L', 'Harbour Energy'],
    ['HAYS.L', 'Hays PLC'],
    ['SNR.L', 'Senior PLC'],
    ['RR.L', 'Rolls-Royce'],
    ['QQ.L', 'QinetiQ Group'],
    ['BAES.L', 'BAE Systems'],
    ['CHG.L', 'Chemring Group'],
  ] as const).map(([symbol, description]): InstrumentRow => ({
    broker: 'fxpro', group: 'Acciones UK', symbol, description, pointValue: 0.01, currency: 'GBX',
    note: GBX_WARNING,
  })),
  // ===== FXPro — Acciones Europeas =====
  ...([
    ['HEIJ.AS', 'Heineken Holding', 'EUR'], ['HEIN.AS', 'Heineken NV', 'EUR'], ['HEIO.AS', 'Heineken (alt)', 'EUR'],
    ['HLAN.AS', 'Holland Colours', 'EUR'], ['AMG.AS', 'AMG Critical Mat.', 'EUR'],
    ['LOTB.BR', 'Lotus Bakeries', 'EUR'],
    ['AIR.PA', 'Airbus', 'EUR'], ['AM.PA', 'Dassault Aviation', 'EUR'], ['SAF.PA', 'Safran', 'EUR'],
    ['TTEF.PA', 'TotalEnergies', 'EUR'], ['ERMT.PA', 'Hermès', 'EUR'],
    ['RHMG.DE', 'Rheinmetall', 'EUR'], ['HDDG.DE', 'Heidelberg Mat.', 'EUR'], ['HEIG.DE', 'Heidelberg (alt)', 'EUR'],
    ['HBH.DE', 'Hornbach', 'EUR'], ['HFGG.DE', 'Hugo Boss', 'EUR'], ['HHFGn.DE', 'Hapag-Lloyd', 'EUR'],
    ['HLE.DE', 'Hella', 'EUR'], ['HLAG.DE', 'Hapag-Lloyd AG', 'EUR'],
  ] as const).map(([symbol, description, currency]): InstrumentRow => ({
    broker: 'fxpro', group: 'Acciones EU', symbol, description, pointValue: 0.01, currency: currency as Currency,
  })),
  // ===== FXPro — ETFs USA =====
  ...([
    ['AGG.N', 'iShares Core US Aggregate Bond'], ['ARKB.N', 'ARK 21Shares Bitcoin ETF'],
    ['BIL.N', 'SPDR 1-3 Month T-Bill'], ['BND.O', 'Vanguard Total Bond Market'],
    ['BNDX.O', 'Vanguard Total Intl Bond'], ['DBA.N', 'Invesco DB Agriculture'],
    ['DBC.N', 'Invesco DB Commodity'], ['EEM.N', 'iShares MSCI Emerging Markets'],
    ['FBTC.N', 'Fidelity Bitcoin ETF'], ['FTGC.O', 'First Trust Global Comm.'],
    ['FXI.N', 'iShares China Large-Cap'], ['GBTC.N', 'Grayscale Bitcoin Trust'],
    ['GLD.N', 'SPDR Gold Shares'], ['IBIT.O', 'iShares Bitcoin Trust'],
    ['IEFA.N', 'iShares Core MSCI EAFE'], ['IEMG.N', 'iShares Core MSCI EM'],
    ['IJH.N', 'iShares Core S&P Mid-Cap'], ['IVV.N', 'iShares Core S&P 500'],
    ['IWD.N', 'iShares Russell 1000 Value'], ['IWF.N', 'iShares Russell 1000 Growth'],
    ['IWM.N', 'iShares Russell 2000'], ['KWEB.N', 'KraneShares CSI China Internet'],
    ['QQQ.O', 'Invesco QQQ Trust'], ['SCHD.N', 'Schwab US Dividend Equity'],
    ['SCHH.N', 'Schwab US REIT ETF'], ['SLV.N', 'iShares Silver Trust'],
    ['SOXL.N', 'Direxion Semi 3x Bull'], ['SPY.N', 'SPDR S&P 500 ETF'],
    ['SVOL.N', 'Simplify Vol Premium'], ['VCIT.O', 'Vanguard Interm Corp Bond'],
    ['VEA.N', 'Vanguard FTSE Dev Markets'], ['VGT.N', 'Vanguard Info Tech'],
    ['VIG.N', 'Vanguard Dividend Appreciation'], ['VNQ.N', 'Vanguard Real Estate'],
    ['VNQI.O', 'Vanguard Global ex-US RE'], ['VO.N', 'Vanguard Mid-Cap'],
    ['VOO.N', 'Vanguard S&P 500'], ['VTI.N', 'Vanguard Total Stock Market'],
    ['VTV.N', 'Vanguard Value'], ['VUG.N', 'Vanguard Growth'],
    ['VWO.N', 'Vanguard FTSE Emerging Markets'], ['VXUS.O', 'Vanguard Total Intl Stock'],
    ['XLK.N', 'Technology Select Sector SPDR'], ['XLRE.N', 'Real Estate Select Sector SPDR'],
  ] as const).map(([symbol, description]): InstrumentRow => ({
    broker: 'fxpro', group: 'ETFs USA', symbol, description, pointValue: 0.01, currency: 'USD',
  })),
  // ===== FXPro — Criptomonedas =====
  { broker: 'fxpro', group: 'Criptomonedas', symbol: 'BITCOIN', description: 'Bitcoin vs USD', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Criptomonedas', symbol: 'ETHEREUM', description: 'Ethereum vs USD', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Criptomonedas', symbol: 'AAVE', description: 'AAVE vs USD', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Criptomonedas', symbol: 'LITECOIN', description: 'Litecoin vs USD', pointValue: 0.01, currency: 'USD' },
  { broker: 'fxpro', group: 'Criptomonedas', symbol: 'FILECOIN', description: 'Filecoin vs USD', pointValue: 0.001, currency: 'USD' },
  { broker: 'fxpro', group: 'Criptomonedas', symbol: 'XRP', description: 'XRP vs USD', pointValue: 0.001, currency: 'USD' },
  // ===== FXPro — Forex =====
  { broker: 'fxpro', group: 'Forex', symbol: 'EURUSD', description: 'Euro vs USD', pointValue: 10.0, currency: 'USD' },
  { broker: 'fxpro', group: 'Forex', symbol: 'EURGBP', description: 'Euro vs GBP', pointValue: 8.33, currency: 'GBP', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'EURJPY', description: 'Euro vs JPY', pointValue: 8.33, currency: 'JPY', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'GBPJPY', description: 'GBP vs JPY', pointValue: 10.40, currency: 'JPY', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'AUDUSD', description: 'AUD vs USD', pointValue: 7.10, currency: 'USD', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'NZDUSD', description: 'NZD vs USD', pointValue: 6.00, currency: 'USD', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'USDCNH', description: 'USD vs CNH', pointValue: 1.38, currency: 'USD', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'USDMXN', description: 'USD vs MXN', pointValue: 10.00, currency: 'USD', variable: true },
  { broker: 'fxpro', group: 'Forex', symbol: 'USDJPY', description: 'USD vs JPY', pointValue: 10.00, currency: 'USD', variable: true },
  // ===== FXPro — Energía =====
  { broker: 'fxpro', group: 'Energía', symbol: 'WTI', description: 'Crude Oil WTI', pointValue: 10.00, currency: 'USD' },
  { broker: 'fxpro', group: 'Energía', symbol: 'NAT.GAS', description: 'Natural Gas', pointValue: 10.00, currency: 'USD' },
];

const CURRENCY_BADGE: Record<Currency, string> = {
  USD: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  GBP: 'bg-emerald-700/20 text-emerald-400 border-emerald-700/40',
  GBX: 'bg-amber-600/20 text-amber-300 border-amber-600/40',
  EUR: 'bg-indigo-600/15 text-indigo-300 border-indigo-600/30',
  JPY: 'bg-red-500/15 text-red-400 border-red-500/30',
  AUD: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  CHF: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  HKD: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
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
  broker: 'darwinex' | 'fxpro';
  group: string;
  highValue?: boolean;   // ⚠⚠ VALOR ALTO
  tickSize?: number;     // tamaño mínimo de movimiento de precio (para puntos MT5)
};

const AUTOCOMPLETE: AutocompleteEntry[] = (() => {
  const out: AutocompleteEntry[] = [];
  const add = (
    broker: 'darwinex' | 'fxpro',
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

  // FXPRO — CFDs
  const fxpro = (
    symbol: string,
    description: string,
    pv: number,
    cur: 'USD' | 'EUR' | 'GBX',
    tickSize: number,
    group = 'CFDs',
  ) => {
    out.push({ symbol, family: symbol, description, pointValue: pv, currency: cur, broker: 'fxpro', group, tickSize });
  };
  // Forex
  fxpro('EURUSD', 'Euro vs Dollar', 10, 'USD', 0.00001, 'Forex');
  fxpro('GBPUSD', 'Pound vs Dollar', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDJPY', 'Dollar vs Yen', 10, 'USD', 0.001, 'Forex');
  fxpro('USDCHF', 'USD vs CHF', 10, 'USD', 0.00001, 'Forex');
  fxpro('AUDUSD', 'AUD vs USD', 10, 'USD', 0.00001, 'Forex');
  fxpro('NZDUSD', 'NZD vs USD', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDCAD', 'USD vs CAD', 10, 'USD', 0.00001, 'Forex');
  fxpro('EURGBP', 'EUR vs GBP', 10, 'USD', 0.00001, 'Forex');
  fxpro('EURJPY', 'EUR vs JPY', 10, 'USD', 0.001, 'Forex');
  fxpro('GBPJPY', 'GBP vs JPY', 10, 'USD', 0.001, 'Forex');
  fxpro('AUDJPY', 'AUD vs JPY', 10, 'USD', 0.001, 'Forex');
  fxpro('CHFJPY', 'CHF vs JPY', 10, 'USD', 0.001, 'Forex');
  fxpro('EURCHF', 'EUR vs CHF', 10, 'USD', 0.00001, 'Forex');
  fxpro('EURAUD', 'EUR vs AUD', 10, 'USD', 0.00001, 'Forex');
  fxpro('EURCAD', 'EUR vs CAD', 10, 'USD', 0.00001, 'Forex');
  fxpro('GBPAUD', 'GBP vs AUD', 10, 'USD', 0.00001, 'Forex');
  fxpro('GBPCAD', 'GBP vs CAD', 10, 'USD', 0.00001, 'Forex');
  fxpro('GBPCHF', 'GBP vs CHF', 10, 'USD', 0.00001, 'Forex');
  fxpro('AUDCAD', 'AUD vs CAD', 10, 'USD', 0.00001, 'Forex');
  fxpro('AUDCHF', 'AUD vs CHF', 10, 'USD', 0.00001, 'Forex');
  fxpro('AUDNZD', 'AUD vs NZD', 10, 'USD', 0.00001, 'Forex');
  fxpro('CADCHF', 'CAD vs CHF', 10, 'USD', 0.00001, 'Forex');
  fxpro('CADJPY', 'CAD vs JPY', 10, 'USD', 0.001, 'Forex');
  fxpro('NZDCAD', 'NZD vs CAD', 10, 'USD', 0.00001, 'Forex');
  fxpro('NZDCHF', 'NZD vs CHF', 10, 'USD', 0.00001, 'Forex');
  fxpro('NZDJPY', 'NZD vs JPY', 10, 'USD', 0.001, 'Forex');
  fxpro('EURNZD', 'EUR vs NZD', 10, 'USD', 0.00001, 'Forex');
  fxpro('GBPNZD', 'GBP vs NZD', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDZAR', 'USD vs ZAR', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDMXN', 'USD vs MXN', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDNOK', 'USD vs NOK', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDSEK', 'USD vs SEK', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDSGD', 'USD vs SGD', 10, 'USD', 0.00001, 'Forex');
  fxpro('USDTRY', 'USD vs TRY', 10, 'USD', 0.00001, 'Forex');
  // Índices CFD
  fxpro('#USSPX500', 'S&P 500 CFD', 1, 'USD', 0.01, 'Índices');
  fxpro('#USNDAQ100', 'Nasdaq 100 CFD', 1, 'USD', 0.01, 'Índices');
  fxpro('#US30', 'Dow Jones CFD', 1, 'USD', 1.0, 'Índices');
  fxpro('#Japan225', 'Nikkei CFD', 1, 'USD', 1.0, 'Índices');
  fxpro('#Germany40', 'DAX 40 CFD', 1, 'EUR', 0.1, 'Índices');
  fxpro('#UK100', 'FTSE 100 CFD', 1, 'USD', 0.1, 'Índices');
  fxpro('#France40', 'France 40 CFD', 1, 'EUR', 0.1, 'Índices');
  fxpro('#Spain35', 'Spain 35 CFD', 1, 'EUR', 0.1, 'Índices');
  fxpro('#Europe50', 'Euro Stoxx 50 CFD', 1, 'EUR', 0.1, 'Índices');
  fxpro('#Australia200', 'ASX 200 CFD', 1, 'USD', 0.1, 'Índices');
  fxpro('#HongKong50', 'Hang Seng CFD', 1, 'USD', 1.0, 'Índices');
  fxpro('#China50', 'China A50 CFD', 1, 'USD', 1.0, 'Índices');
  // Materias primas CFD
  fxpro('GOLD', 'Gold CFD', 1, 'USD', 0.01, 'Metales');
  fxpro('SILVER', 'Silver CFD', 5, 'USD', 0.001, 'Metales');
  fxpro('COPPER', 'Copper CFD', 6.25, 'USD', 0.0001, 'Metales Spot');
  fxpro('ZINC', 'Zinc CFD', 6.25, 'USD', 0.25, 'Metales Spot');
  fxpro('ALUMINIUM', 'Aluminium CFD', 6.25, 'USD', 0.25, 'Metales Spot');
  fxpro('WTI', 'Crude Oil WTI CFD', 10, 'USD', 0.01, 'Energía');
  fxpro('NAT.GAS', 'Natural Gas CFD', 10, 'USD', 0.001, 'Energía');
  fxpro('BRENT', 'Brent Crude CFD', 10, 'USD', 0.01, 'Energía');
  // Crypto
  fxpro('BITCOIN', 'Bitcoin CFD', 1, 'USD', 1.0, 'Crypto');
  fxpro('ETHEREUM', 'Ethereum CFD', 1, 'USD', 0.01, 'Crypto');
  fxpro('LITECOIN', 'Litecoin CFD', 1, 'USD', 0.01, 'Crypto');
  fxpro('RIPPLE', 'Ripple CFD', 1, 'USD', 0.0001, 'Crypto');
  fxpro('FILECOIN', 'Filecoin CFD', 1, 'USD', 0.001, 'Crypto');
  fxpro('AAVE', 'AAVE CFD', 1, 'USD', 0.01, 'Crypto');
  // Acciones USA
  fxpro('AAPL.O', 'Apple', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('MSFT.O', 'Microsoft', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('AMZN.O', 'Amazon', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('GOOGL.O', 'Alphabet', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('META.O', 'Meta Platforms', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('TSLA.O', 'Tesla', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('NVDA.O', 'NVIDIA', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('AMD.O', 'AMD', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('NFLX.O', 'Netflix', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('DIS.N', 'Disney', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('GIS.N', 'General Mills', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('WIX.O', 'Wix.com', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('BABA.N', 'Alibaba', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('TSM.N', 'TSMC', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('V.N', 'Visa', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('JPM.N', 'JPMorgan', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('BAC.N', 'Bank of America', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('GS.N', 'Goldman Sachs', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('XOM.N', 'ExxonMobil', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('CVX.N', 'Chevron', 1, 'USD', 0.01, 'Acciones USA');
  fxpro('VOO.N', 'Vanguard S&P 500 ETF', 1, 'USD', 0.01, 'ETFs');
  // Acciones UK (GBX)
  fxpro('HILS.L', 'Hill & Smith', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('HLMA.L', 'Halma PLC', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('AZN.L', 'AstraZeneca', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('SHEL.L', 'Shell', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('HSBA.L', 'HSBC', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('BP.L', 'BP', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('VOD.L', 'Vodafone', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('LLOY.L', 'Lloyds Banking', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('RIO.L', 'Rio Tinto', 1, 'GBX', 0.01, 'Acciones UK');
  fxpro('GLEN.L', 'Glencore', 1, 'GBX', 0.01, 'Acciones UK');

  return out;
})();


const fmt = (n: number, d = 4) => Number.isFinite(n) ? n.toFixed(d) : '—';
const fmtEur = (n: number) => Number.isFinite(n) ? `€${n.toFixed(2)}` : '—';

function CalculatorPage() {
  const [account, setAccount] = useState<Account>('darwinex');
  const [capital, setCapital] = useState<number>(1_000_000);
  const [instrument, setInstrument] = useState('');
  const [direction, setDirection] = useState<Direction>('BUY');
  const [entry, setEntry] = useState<string>('');
  const [atr, setAtr] = useState<string>('');
  const [riskPct, setRiskPct] = useState<string>('1');
  const [pointValue, setPointValue] = useState<string>('1');
  const [tickSize, setTickSize] = useState<number | null>(null);
  const [vix, setVix] = useState<string>('');
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [tp, setTp] = useState<string>('');
  const [tableOpen, setTableOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const onAccountChange = (a: Account) => {
    setAccount(a);
    setCapital(a === 'darwinex' ? 1_000_000 : 26.39);
  };

  const nEntry = parseFloat(entry) || 0;
  const nAtr = parseFloat(atr) || 0;
  const nRisk = parseFloat(riskPct) || 0;
  const nPv = parseFloat(pointValue) || 0;
  const nVix = vix === '' ? null : parseFloat(vix);
  const nCurrent = parseFloat(currentPrice) || 0;
  const nTp = tp === '' ? null : parseFloat(tp);

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
  const lotsRaw = slDist > 0 && nPv > 0 ? riskEur / (slDist * nPv) : 0;
  const lots = Math.max(0.01, Math.min(10, Math.round(lotsRaw * 100) / 100));
  const minLotWarning = lotsRaw > 0 && lotsRaw < 0.01;

  const beActivate = direction === 'BUY' ? nEntry + nAtr : nEntry - nAtr;
  const beSl = direction === 'BUY' ? nEntry + nAtr * 0.2 : nEntry - nAtr * 0.2;

  const trailDist = nAtr * 3;
  const trailSl = direction === 'BUY' ? nCurrent - trailDist : nCurrent + trailDist;
  const trailMt5Points = tickSize && tickSize > 0 && trailDist > 0
    ? Math.round(trailDist / tickSize)
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
    setPointValue(String(row.pointValue));
    // Try to find tickSize from autocomplete catalog by family/symbol match
    const auto = AUTOCOMPLETE.find(
      a => a.broker === row.broker && (a.symbol === row.symbol || a.family === row.symbol.split('_')[0]),
    );
    setTickSize(auto?.tickSize ?? null);
    if (row.broker === 'darwinex') onAccountChange('darwinex');
    else onAccountChange('fxpro');
    setTableOpen(false);
    toast.success(`${row.symbol} cargado — valor punto: ${row.pointValue}`);
    if (row.currency === 'GBX') {
      toast.warning(`${row.symbol} cotiza en peniques (GBX)`, {
        description: 'El precio en MT5 ya está en peniques — úsalo directamente. P/L también en GBX. Para convertir a GBP divide entre 100.',
        duration: 8000,
      });
    }
  };

  const clearAll = () => {
    setInstrument(''); setEntry(''); setAtr(''); setRiskPct('1');
    setPointValue('1'); setTickSize(null); setVix(''); setCurrentPrice(''); setTp('');
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
      `Trailing:    ATR × 3`,
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
    if (r.broker === 'darwinex' || r.broker === 'fxpro') {
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calculadora</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calculadora de posición CAP Trend Following. Cálculo en tiempo real.
        </p>
      </div>

      {blocked && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-sm font-semibold">VIX &gt; 45 — Sistema bloqueado. No operar.</div>
        </div>
      )}

      {/* INPUTS */}
      <section className="rounded-xl border border-border bg-card p-4 lg:p-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Datos de entrada</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cuenta */}
          <Field label="Cuenta">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAccountChange('darwinex')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  account === 'darwinex' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                Darwinex Zero · €1.000.000
              </button>
              <button
                type="button"
                onClick={() => onAccountChange('fxpro')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                  account === 'fxpro' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                FXPro · €26.39
              </button>
            </div>
            <NumInput value={capital} onChange={setCapital} className="mt-2" />
          </Field>

          {/* Instrumento */}
          <Field label="Instrumento">
            <InstrumentAutocomplete
              value={instrument}
              onChange={setInstrument}
              onSelect={(e) => {
                setInstrument(e.symbol);
                setPointValue(String(e.pointValue));
                setTickSize(e.tickSize ?? null);
                onAccountChange(e.broker);
                toast.success(`${e.symbol} cargado — valor punto: ${e.pointValue} ${e.currency}`);
                if (e.currency === 'GBX') {
                  toast.warning(`${e.symbol} cotiza en peniques (GBX)`, {
                    description: 'Usa el precio MT5 directamente. P/L en GBX. Divide entre 100 para GBP.',
                    duration: 8000,
                  });
                }
              }}
            />
          </Field>

          {/* Dirección */}
          <Field label="Dirección">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('BUY')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-bold border transition-colors ${
                  direction === 'BUY' ? 'border-success bg-success/15 text-success' : 'border-border bg-secondary text-muted-foreground'
                }`}
              >▲ BUY</button>
              <button
                type="button"
                onClick={() => setDirection('SELL')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-bold border transition-colors ${
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
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="ATR (14)" hint="Cópialo de MT5: Insertar → Indicadores → ATR período 14">
            <input
              type="number" step="any" inputMode="decimal"
              value={atr} onChange={e => setAtr(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="% Riesgo" hint="Sistema CAP: 1% por trade">
            <input
              type="number" step="0.1" min="0.1" max="3" inputMode="decimal"
              value={riskPct} onChange={e => setRiskPct(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="Valor del punto" hint="Para futuros Darwinex puede variar. Para CFDs FXPro usar 1 como aproximación o consultar especificaciones en MT5">
            <input
              type="number" step="any" inputMode="decimal"
              value={pointValue} onChange={e => setPointValue(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>

          <Field label="VIX actual (opcional)" hint={vixInfo?.msg ?? 'Si lo rellenas, sugerimos % de riesgo según volatilidad'} hintClass={vixInfo?.color}>
            <input
              type="number" step="0.1" inputMode="decimal"
              value={vix} onChange={e => setVix(e.target.value)}
              placeholder="—"
              className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm font-data"
            />
          </Field>
        </div>

        {/* Toggle tabla */}
        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setTableOpen(o => !o)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
          >
            {tableOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {tableOpen ? 'Ocultar tabla de instrumentos' : 'Ver tabla de instrumentos'}
          </button>
          {tableOpen && (
            <InstrumentTable
              search={tableSearch}
              onSearch={setTableSearch}
              rows={filteredInstruments}
              onPick={pickInstrument}
            />
          )}
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
          <Row label="Distancia (ATR × 3)">
            <Big>{fmt(trailDist)}</Big>
          </Row>

          <div className="mt-3 rounded-lg border border-success/40 bg-success/10 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-success mb-1 flex items-center gap-1.5">
              ✅ Puntos para MT5
            </div>
            <div
              className="font-data font-bold text-success leading-none"
              style={{ fontSize: '2.5rem' }}
            >
              {trailMt5Points != null ? String(trailMt5Points) : '—'}
            </div>
            {trailMt5Points == null && (
              <div className="text-[11px] text-muted-foreground mt-2">
                Selecciona un instrumento e introduce el ATR para ver los puntos.
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground mt-3 leading-relaxed">
            En MT5: clic derecho sobre la posición → <span className="text-foreground font-medium">Trailing Stop</span> → <span className="text-foreground font-medium">Personalizado</span> → introducir{' '}
            <span className="text-success font-data font-semibold">
              {trailMt5Points != null ? trailMt5Points.toLocaleString('en-US') : '[puntos]'}
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

      {/* RESUMEN OPERATIVO */}
      <section
        className="rounded-xl border-2 p-5 lg:p-7 bg-card"
        style={{ borderColor: '#2962FF' }}
      >
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-base font-bold uppercase tracking-wider flex items-center gap-2">
            📋 Resumen operativo
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-lg font-bold font-data">
              <span className="text-foreground">{instrument || '—'}</span>{' '}
              <span className={direction === 'BUY' ? 'text-success' : 'text-destructive'}>
                {direction === 'BUY' ? '▲ BUY' : '▼ SELL'}
              </span>
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
            value={trailMt5Points != null ? `${trailMt5Points.toLocaleString('en-US')} pts` : 'ATR × 3'}
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
    </div>
  );
}

function BigStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="font-data font-bold leading-none text-foreground" style={{ fontSize: '2.25rem' }}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1.5">{hint}</div>}
    </div>
  );
}

function MidStat({ label, value, hint, hintClass }: { label: string; value: string; hint?: string; hintClass?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`font-data font-bold text-xl ${hintClass ?? 'text-foreground'}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function Field({ label, children, hint, hintClass }: { label: string; children: React.ReactNode; hint?: string; hintClass?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1.5 font-medium">{label}</label>
      {children}
      {hint && <div className={`text-[11px] mt-1 ${hintClass ?? 'text-muted-foreground'}`}>{hint}</div>}
    </div>
  );
}

function NumInput({ value, onChange, className }: { value: number; onChange: (n: number) => void; className?: string }) {
  return (
    <input
      type="number" step="any" inputMode="decimal"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className={`w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-data ${className ?? ''}`}
    />
  );
}

function ResultCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className ?? ''}`}>
      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className ?? ''}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
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
      const key = `${r.broker === 'darwinex' ? 'Darwinex' : 'FXPro'} · ${r.group}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-[#0d0d0d]">
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
                            className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 align-middle"
                          >VAR</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                        {r.description}
                        {r.note && (
                          <div className={`text-[10px] mt-0.5 font-semibold ${r.warn ? 'text-destructive' : 'text-orange-400/80'}`}>{r.note}</div>
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
        FXPro: con apalancamiento 1:30 el margen requerido = valor posición / 30. El riesgo se calcula sobre el capital real.
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

  const q = value.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return AUTOCOMPLETE.filter(
      e =>
        e.symbol.toLowerCase().includes(q) ||
        e.family.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    ).slice(0, 60);
  }, [q]);

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
    setSelectedDesc(`${e.description} · ${e.pointValue} ${e.currency} por punto · ${e.broker === 'darwinex' ? 'Darwinex' : 'FXPro'}`);
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
                    <span>{head.broker === 'darwinex' ? 'Darwinex' : 'FXPro'}</span>
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
