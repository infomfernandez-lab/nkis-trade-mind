import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const FUTURES_MAP: Record<string, string> = {
  RB_K: 'NYMEX:RB1!', RB_M: 'NYMEX:RB1!',
  CL_K: 'NYMEX:CL1!', CL_M: 'NYMEX:CL1!',
  HO_K: 'NYMEX:HO1!', HO_M: 'NYMEX:HO1!',
  BZ_M: 'ICEEUR:B1!', BZ_K: 'ICEEUR:B1!',
  NG_K: 'NYMEX:NG1!', NG_M: 'NYMEX:NG1!',
  GC_M: 'COMEX:GC1!', GC_J: 'COMEX:GC1!', GC_Z: 'COMEX:GC1!',
  SI_K: 'COMEX:SI1!', SI_M: 'COMEX:SI1!', SI_Z: 'COMEX:SI1!',
  HG_K: 'COMEX:HG1!', HG_H: 'COMEX:HG1!',
  PL_N: 'NYMEX:PL1!', PL_F: 'NYMEX:PL1!',
  ES_M: 'CME:ES1!', ES_H: 'CME:ES1!',
  NQ_M: 'CME:NQ1!',
  YM_M: 'CBOT:YM1!',
  RTY_M: 'CME:RTY1!',
  FDAX_M: 'EUREX:FDAX1!', FDAX_H: 'EUREX:FDAX1!',
  FESX_M: 'EUREX:FESX1!', FESX_H: 'EUREX:FESX1!',
  FGBL_M: 'EUREX:FGBL1!',
  ZC_K: 'CBOT:ZC1!', ZS_K: 'CBOT:ZS1!',
  ZL_K: 'CBOT:ZL1!', ZM_K: 'CBOT:ZM1!',
  ZN_M: 'CBOT:ZN1!', KE_K: 'CBOT:KE1!',
  LE_M: 'CME:LE1!', HE_K: 'CME:HE1!',
  '6E_M': 'CME:6E1!', '6J_M': 'CME:6J1!',
  '6A_M': 'CME:6A1!', '6B_M': 'CME:6B1!',
  '6C_M': 'CME:6C1!', '6N_M': 'CME:6N1!', '6S_M': 'CME:6S1!',
};

const FXPRO_MAP: Record<string, string> = {
  XAUUSD: 'OANDA:XAUUSD', XAGUSD: 'OANDA:XAGUSD',
  EURUSD: 'OANDA:EURUSD', GBPUSD: 'OANDA:GBPUSD',
  USDJPY: 'OANDA:USDJPY', USDCHF: 'OANDA:USDCHF',
  AUDUSD: 'OANDA:AUDUSD', USDCAD: 'OANDA:USDCAD',
  NZDUSD: 'OANDA:NZDUSD', EURGBP: 'OANDA:EURGBP',
  EURJPY: 'OANDA:EURJPY', GBPJPY: 'OANDA:GBPJPY',
  US500: 'SP:SPX', US30: 'DJ:DJI',
  US100: 'NASDAQ:NDX', GER40: 'EUREX:FDAX1!',
  UK100: 'SPREADEX:UK100', USOIL: 'NYMEX:CL1!',
  UKOIL: 'ICEEUR:B1!', NATGAS: 'NYMEX:NG1!',
  BTCUSD: 'BITSTAMP:BTCUSD', ETHUSD: 'BITSTAMP:ETHUSD',
  ALUMINIUM: 'COMEX:ALI1!', COPPER: 'COMEX:HG1!',
  GOLD: 'COMEX:GC1!', SILVER: 'COMEX:SI1!',
  PLATINUM: 'NYMEX:PL1!', PALLADIUM: 'NYMEX:PA1!',
};

const EXCHANGE_SUFFIXES: [string, string][] = [
  ['.O', 'NASDAQ:'],
  ['.N', 'NYSE:'],
  ['.L', 'LSE:'],
  ['.PA', 'EURONEXT:'],
  ['.BR', 'EURONEXT:'],
  ['.DE', 'XETRA:'],
  ['.AS', 'EURONEXT:'],
];

function mapToTradingView(symbol: string): string | null {
  if (FUTURES_MAP[symbol]) return FUTURES_MAP[symbol];
  if (FXPRO_MAP[symbol]) return FXPRO_MAP[symbol];

  for (const [suffix, exchange] of EXCHANGE_SUFFIXES) {
    if (symbol.endsWith(suffix)) return exchange + symbol.slice(0, -suffix.length);
  }

  if (symbol.startsWith('#')) return null;

  // Fallback: try stripping Darwinex contract month
  const base = symbol.replace(/_[A-Z]$/i, '');
  if (base !== symbol && FUTURES_MAP[base]) return FUTURES_MAP[base];

  return symbol;
}

interface Instrument {
  symbol: string;
  direction: string;
  score: number;
  adx_value?: number;
  adx_state?: string;
  rank: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instrument: Instrument | null;
  broker: string;
}

export function TradingViewChartDialog({ open, onOpenChange, instrument, broker }: Props) {
  const [loading, setLoading] = useState(true);

  if (!instrument) return null;

  const tvSymbol = mapToTradingView(instrument.symbol);
  const isAlcista = instrument.direction?.toLowerCase() === 'alcista' || instrument.direction?.toLowerCase() === 'buy';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setLoading(true); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border space-y-1">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="font-mono text-yellow-400">#{instrument.rank}</span>
            <span>{instrument.symbol}</span>
            <Badge className={`text-[10px] px-1.5 py-0 border ${isAlcista ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
              {isAlcista ? 'ALCISTA' : 'BAJISTA'}
            </Badge>
            <span className="font-data font-bold text-yellow-400">
              {instrument.score}<span className="text-xs text-muted-foreground font-normal">/100</span>
            </span>
            {instrument.adx_value != null && (
              <span className="text-sm text-muted-foreground">
                ADX {instrument.adx_value} {instrument.adx_state && `· ${instrument.adx_state}`}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {tvSymbol ? `Gráfico diario — ${tvSymbol}` : 'Gráfico no disponible para este símbolo'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 relative min-h-[600px]">
          {tvSymbol ? (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              <iframe
                src={`https://www.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=D&hidesidetoolbar=0&hidetoptoolbar=0&theme=dark&style=1&locale=es&enable_publishing=false&hide_top_toolbar=false&save_image=false`}
                width="100%"
                height="100%"
                frameBorder="0"
                allowTransparency
                scrolling="no"
                className="absolute inset-0"
                onLoad={() => setLoading(false)}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Gráfico no disponible para este símbolo</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
