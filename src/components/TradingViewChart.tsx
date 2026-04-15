import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

function cleanSymbol(raw: string): string | null {
  // Skip # prefixed symbols
  if (raw.startsWith('#')) return null;

  // Forex/crypto — as-is
  if (/^(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY|XAU|XAG|BTC|ETH|XRP)/.test(raw)) return raw;

  // Indices
  const indexMap: Record<string, string> = {
    'US500': 'SP:SPX', 'US30': 'DJ:DJI', 'US100': 'NASDAQ:NDX',
    'GER40': 'EUREX:FDAX1!', 'UK100': 'UK100',
    'USOIL': 'CL1!', 'UKOIL': 'BZ1!', 'NATGAS': 'NG1!',
    'COPPER': 'HG1!', 'GOLD': 'GC1!', 'SILVER': 'SI1!',
    'PLATINUM': 'PL1!', 'PALLADIUM': 'PA1!', 'ALUMINIUM': 'ALI1!',
  };
  if (indexMap[raw]) return indexMap[raw];

  // European stocks
  if (raw.endsWith('.L')) {
    const base = raw.slice(0, -2);
    const lseMap: Record<string, string> = { 'BAES': 'LSE:BA.', 'RR': 'LSE:RR.', 'CHG': 'LSE:CHG', 'SNR': 'LSE:SNR' };
    return lseMap[base] || `LSE:${base}`;
  }
  if (raw.endsWith('.PA')) return `EURONEXT:${raw.slice(0, -3)}`;
  if (raw.endsWith('.BR')) return `EURONEXT:${raw.slice(0, -3)}`;
  if (raw.endsWith('.AS')) return `EURONEXT:${raw.slice(0, -3)}`;
  if (raw.endsWith('.DE')) return `XETRA:${raw.slice(0, -3)}`;

  // US stocks
  if (raw.endsWith('.O')) return raw.slice(0, -2);
  if (raw.endsWith('.N')) return raw.slice(0, -2);

  // Futures: GC_M → GC1!
  if (/_[A-Z]$/.test(raw)) {
    const base = raw.replace(/_[A-Z]$/, '');
    return `${base}1!`;
  }

  return raw;
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

  const handleOpenChart = () => {
    if (tvSymbol) {
      window.open(`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="font-mono text-yellow-400">#{instrument.rank}</span>
            <span>{instrument.symbol}</span>
            <Badge className={`text-[10px] px-1.5 py-0 border ${isAlcista ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
              {isAlcista ? 'ALCISTA' : 'BAJISTA'}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4 text-sm">
            <span className="font-bold text-yellow-400">{instrument.score}/100</span>
            {instrument.adx_value != null && (
              <span className="text-muted-foreground">
                ADX {instrument.adx_value} {instrument.adx_state && `· ${instrument.adx_state}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {tvSymbol ? (
            <Button onClick={handleOpenChart} className="w-full gap-2">
              <ExternalLink className="w-4 h-4" />
              📈 Ver en TradingView ({tvSymbol})
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground text-center">Gráfico no disponible para este símbolo</p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            ✕ Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
