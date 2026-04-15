import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

function cleanSymbol(raw: string): string {
  // Forex and crypto — use as-is
  if (/^(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY|XAU|XAG|BTC|ETH|XRP)/.test(raw)) return raw;

  // Indices
  const indexMap: Record<string, string> = {
    'US500': 'SP:SPX', 'US30': 'DJ:DJI', 'US100': 'NASDAQ:NDX',
    'GER40': 'EUREX:FDAX1!', 'UK100': 'SPREADEX:UK100',
  };
  if (indexMap[raw]) return indexMap[raw];

  // Remove # prefix
  let s = raw.replace(/^#/, '');

  // Remove exchange suffixes
  s = s.replace(/\.(O|N|L|PA|BR|DE|AS)$/, '');

  // Remove futures month code: GC_M → GC, RB_K → RB
  s = s.replace(/_[A-Z]$/, '');

  return s;
}

function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const containerId = `tv_chart_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;

  useEffect(() => {
    setLoading(true);

    const initWidget = () => {
      if (!containerRef.current) return;
      // Clear previous widget content
      containerRef.current.innerHTML = '';

      new (window as any).TradingView.widget({
        container_id: containerId,
        symbol,
        interval: 'D',
        timezone: 'Europe/Madrid',
        theme: 'dark',
        style: '1',
        locale: 'es',
        toolbar_bg: '#0a0b0e',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: true,
        height: 600,
        width: '100%',
      });

      // TradingView widget doesn't have a ready callback via this API,
      // so we use a short delay to hide the spinner
      setTimeout(() => setLoading(false), 1500);
    };

    if ((window as any).TradingView) {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }
  }, [symbol, containerId]);

  return (
    <div className="relative" style={{ height: '600px', width: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div id={containerId} ref={containerRef} style={{ height: '600px', width: '100%' }} />
    </div>
  );
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

export function TradingViewChartDialog({ open, onOpenChange, instrument }: Props) {
  if (!instrument) return null;

  const tvSymbol = cleanSymbol(instrument.symbol);
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
            Gráfico diario — {tvSymbol} · Puedes buscar otro símbolo en el buscador del gráfico
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-[600px]">
          {open && <TradingViewWidget symbol={tvSymbol} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
