import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AdvancedMetrics } from '@/lib/analytics';

function fmt(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}€${Math.abs(v).toFixed(2)}`;
}

function color(v: number, invert = false): string {
  if (v === 0) return 'text-primary';
  const positive = invert ? v < 0 : v > 0;
  return positive ? 'text-success' : 'text-destructive';
}

function colorThreshold(v: number, good: number, bad: number): string {
  if (v >= good) return 'text-success';
  if (v <= bad) return 'text-destructive';
  return 'text-primary';
}

interface MetricProps {
  label: string;
  value: string;
  colorClass: string;
  tooltip: string;
  sub?: string;
}

function MetricCard({ label, value, colorClass, tooltip, sub }: MetricProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border border-border bg-card p-4 card-hover">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={`text-lg font-data font-bold ${colorClass}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </TooltipProvider>
  );
}

export function AdvancedMetricsSection({ m }: { m: AdvancedMetrics }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-sm font-semibold text-foreground">Métricas Avanzadas</h2>

      {/* Row 1 — Core Performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Esperanza (Expectancy)"
          value={fmt(m.expectancy)}
          colorClass={color(m.expectancy)}
          tooltip="Valor esperado por trade: (WinRate × GananciaMedia) - (LossRate × PérdidaMedia). Un valor positivo indica sistema rentable. Buen valor: > €5 por trade."
        />
        <MetricCard
          label="Payoff Ratio"
          value={m.payoffRatio === Infinity ? '∞' : m.payoffRatio.toFixed(2)}
          colorClass={colorThreshold(m.payoffRatio, 1.5, 0.8)}
          tooltip="GananciaMedia / PérdidaMedia. Cuánto ganas por cada euro que pierdes. Buen valor: > 1.5. Por encima de 2.0 es excelente."
          sub="Ganancia / Pérdida media"
        />
        <MetricCard
          label="Recovery Factor"
          value={m.recoveryFactor === Infinity ? '∞' : m.recoveryFactor.toFixed(2)}
          colorClass={colorThreshold(m.recoveryFactor, 3, 1)}
          tooltip="Beneficio Neto / Drawdown Máximo. Eficiencia de recuperación. Buen valor: > 3. Un RF alto indica que el sistema se recupera bien de las caídas."
        />
        <MetricCard
          label="Ulcer Index"
          value={m.ulcerIndex.toFixed(2) + '%'}
          colorClass={colorThreshold(-m.ulcerIndex, -5, -15)}
          tooltip="Mide severidad y duración de los drawdowns. Valores bajos indican equidad más estable. Buen valor: < 5%. Preocupante: > 15%."
          sub="Severidad del drawdown"
        />
      </div>

      {/* Row 2 — Risk Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="MAE Promedio"
          value={`W: €${Math.abs(m.avgMaeWinnersEur).toFixed(0)} / L: €${Math.abs(m.avgMaeLosersEur).toFixed(0)}`}
          colorClass={m.avgMaeLosersEur <= m.avgMaeWinnersEur * 1.3 ? 'text-success' : 'text-destructive'}
          tooltip="Maximum Adverse Excursion medio en ganadoras vs perdedoras. Si el MAE de las perdedoras es mucho mayor, el SL puede estar demasiado amplio. Buen valor: MAE similar en ambas."
          sub="Ganadoras vs Perdedoras"
        />
        <MetricCard
          label="MFE vs P&L Real"
          value={`€${Math.abs(m.avgMfeWinnersEur).toFixed(0)} → €${Math.abs(m.avgPnlWinnersEur).toFixed(0)}`}
          colorClass={m.avgPnlWinnersEur >= m.avgMfeWinnersEur * 0.6 ? 'text-success' : 'text-primary'}
          tooltip="Maximum Favorable Excursion medio vs P&L real capturado en ganadoras. Muestra cuánto beneficio dejas en la mesa. Buen valor: capturar > 60% del MFE."
          sub="Beneficio potencial vs real"
        />
        <MetricCard
          label="RR Real vs Teórico"
          value={`${m.avgRrReal.toFixed(2)} vs ${m.avgRrTheoretical.toFixed(2)}`}
          colorClass={m.avgRrReal >= m.avgRrTheoretical * 0.7 ? 'text-success' : 'text-primary'}
          tooltip="Risk:Reward real ejecutado vs el teórico del setup. Mide calidad de ejecución. Buen valor: RR real cercano al teórico (> 70%)."
          sub="Calidad de ejecución"
        />
        <MetricCard
          label="Coste Intervenciones"
          value={fmt(m.interventionCost)}
          colorClass={color(m.interventionCost)}
          tooltip="Total de euros ganados/perdidos en trades con intervención manual (mover SL, cerrar antes, añadir posición). Un valor negativo indica que intervenir cuesta dinero."
          sub="Impacto de intervenir"
        />
      </div>

      {/* Row 3 — Consistency */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Mejor Mes"
          value={fmt(m.bestMonth)}
          colorClass="text-success"
          tooltip="El mes con mayor P&L neto. Referencia del potencial del sistema en condiciones favorables."
          sub={m.bestMonthLabel}
        />
        <MetricCard
          label="Peor Mes"
          value={fmt(m.worstMonth)}
          colorClass="text-destructive"
          tooltip="El mes con menor P&L neto. Referencia del riesgo máximo mensual. Buen valor: que no supere el 5% del capital."
          sub={m.worstMonthLabel}
        />
        <MetricCard
          label="Meses Positivos"
          value={`${m.positiveMonthsPct.toFixed(0)}%`}
          colorClass={colorThreshold(m.positiveMonthsPct, 60, 40)}
          tooltip="Porcentaje de meses con P&L positivo. Mide consistencia temporal. Buen valor: > 60%. Excelente: > 75%."
          sub="Consistencia mensual"
        />
        <MetricCard
          label="Racha Máxima"
          value={`${m.maxConsecutiveWins}W / ${m.maxConsecutiveLosses}L`}
          colorClass={m.maxConsecutiveWins > m.maxConsecutiveLosses ? 'text-success' : 'text-primary'}
          tooltip="Racha máxima consecutiva de victorias (W) y derrotas (L) históricas. Útil para prepararse psicológicamente para las peores rachas."
          sub="Victorias / Derrotas consecutivas"
        />
      </div>
    </div>
  );
}
