import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

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
  // Strip contract month suffix: "RB_K" → "RB", "FDAX_M" → "FDAX"
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !instrument || !containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = '';

    const tvSymbol = mapSymbol(instrument.symbol, broker);
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Europe/Madrid',
      theme: 'dark',
      style: '1',
      locale: 'es',
      backgroundColor: 'rgba(15, 23, 42, 1)',
      gridColor: 'rgba(30, 41, 59, 0.5)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container__widget';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';
    el.appendChild(wrapper);
    el.appendChild(script);

    return () => { el.innerHTML = ''; };
  }, [open, instrument, broker]);

  if (!instrument) return null;

  const isAlcista = instrument.direction?.toLowerCase() === 'alcista' || instrument.direction?.toLowerCase() === 'buy';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            Gráfico diario — {mapSymbol(instrument.symbol, broker)}
          </DialogDescription>
        </DialogHeader>
        <div ref={containerRef} className="flex-1 min-h-[600px]" />
      </DialogContent>
    </Dialog>
  );
}
