import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const SYMBOL_MAP: Record<string, string> = {
  RB: 'NYMEX:RB1!', CL: 'NYMEX:CL1!', HO: 'NYMEX:HO1!', BZ: 'NYMEX:BZ1!',
  GC: 'COMEX:GC1!', SI: 'COMEX:SI1!', HG: 'COMEX:HG1!', PL: 'NYMEX:PL1!',
  NG: 'NYMEX:NG1!', ES: 'CME:ES1!', NQ: 'CME:NQ1!', YM: 'CBOT:YM1!',
  RTY: 'CME:RTY1!', FDAX: 'EUREX:FDAX1!', FESX: 'EUREX:FESX1!', FGBL: 'EUREX:FGBL1!',
  ZC: 'CBOT:ZC1!', ZS: 'CBOT:ZS1!', ZL: 'CBOT:ZL1!', ZM: 'CBOT:ZM1!',
  ZN: 'CBOT:ZN1!', KE: 'CBOT:KE1!', LE: 'CME:LE1!', HE: 'CME:HE1!',
  '6E': 'CME:6E1!', '6J': 'CME:6J1!', '6A': 'CME:6A1!', '6B': 'CME:6B1!', '6C': 'CME:6C1!',
};

function mapSymbol(symbol: string, broker: string): string {
  if (broker === 'fxpro') return symbol;
  const base = symbol.replace(/_[A-Z]$/i, '');
  return SYMBOL_MAP[base] || symbol;
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

  const tvSymbol = mapSymbol(instrument.symbol, broker);
  const iframeSrc = `https://www.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=D&hidesidetoolbar=0&hidetoptoolbar=0&theme=dark&style=1&locale=es&enable_publishing=false&hide_top_toolbar=false&save_image=false`;
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
            Gráfico diario — {tvSymbol}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 relative min-h-[600px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          <iframe
            src={iframeSrc}
            width="100%"
            height="100%"
            frameBorder="0"
            allowTransparency
            scrolling="no"
            className="absolute inset-0"
            onLoad={() => setLoading(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
