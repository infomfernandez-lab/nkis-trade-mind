import { createFileRoute } from '@tanstack/react-router';
import { Shield, Target, Zap, Eye, BarChart3, AlertTriangle, BookOpen } from 'lucide-react';

export const Route = createFileRoute('/manual')({
  component: Manual,
  head: () => ({
    meta: [
      { title: 'Manual Sistema 1 — CAP Trading' },
      { name: 'description', content: 'Guía de referencia completa del sistema de trading Sistema 1.' },
    ],
  }),
});

function Manual() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Sistema 1</h1>
        <p className="text-muted-foreground mt-2">Sistema de Trading Sistemático Trend-Following — Referencia Completa</p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-sm">
        <p className="text-foreground/90 italic font-medium">
          "El scanner encuentra DÓNDE. El EA decide CUÁNDO. Tú decides SEGUIR."
        </p>
      </div>

      {/* The Scanner */}
      <ManualSection icon={Eye} title="El Scanner (Radar)">
        <p className="text-muted-foreground mb-4">
          El scanner identifica los instrumentos con las tendencias más fuertes de tu universo. Se ejecuta localmente en tu PC como un script Python conectado a MT5.
        </p>
        <h4 className="text-sm font-semibold text-foreground mb-2">Indicadores Analizados</h4>
        <ul className="space-y-1.5 mb-4">
          <Li>Alineación y pendiente de MA50/200</Li>
          <Li>Valor de ADX (14) y pendiente en 5 barras</Li>
          <Li>Distancia del precio a MA50 (%)</Li>
          <Li>Dirección del momentum a 20 días</Li>
          <Li>Filtro de correlación (evitar posiciones correlacionadas)</Li>
        </ul>
        <h4 className="text-sm font-semibold text-foreground mb-2">Puntuación</h4>
        <p className="text-muted-foreground mb-2">
          Cada instrumento recibe una puntuación de 0 a 100 basada en la combinación ponderada de todos los indicadores. Puntuaciones más altas indican tendencias más fuertes y limpias.
        </p>
        <Rule>Siempre opera el instrumento mejor clasificado. Rankings más bajos significan setups más débiles.</Rule>
      </ManualSection>

      {/* The EA */}
      <ManualSection icon={Zap} title="El EA (Ejecutor de Entradas)">
        <p className="text-muted-foreground mb-4">
          El Expert Advisor gestiona la entrada, salida y gestión del trade. Una vez activado, no intervengas.
        </p>
        <div className="space-y-3">
          <DetailRow label="Señal de Entrada" value="Stochastic (5,2,2) cruza 30 hacia arriba (BUY) o 70 hacia abajo (SELL) al cierre de vela D1" />
          <DetailRow label="Stop Loss" value="Mínimo más bajo de las últimas 10 velas (BUY) / Máximo más alto de las últimas 10 velas (SELL)" />
          <DetailRow label="Take Profit" value="Swing high/low relevante anterior — lookback de 30 velas" />
          <DetailRow label="Breakeven" value="Se activa cuando el precio alcanza el 75% de la distancia al TP" />
          <DetailRow label="Riesgo" value="1% del balance de la cuenta por trade" />
          <DetailRow label="Temporalidad" value="D1 (Diario)" />
        </div>
      </ManualSection>

      {/* Operating Rules */}
      <ManualSection icon={Shield} title="Reglas Operativas">
        <div className="space-y-3">
          <Rule critical>Revisa el VIX antes de todo. Si VIX &gt; 45, NO operes. Punto.</Rule>
          <Rule>VIX 35-45: Reduce el tamaño de posición un 50%.</Rule>
          <Rule>VIX 25-35: Procede con cautela. Solo instrumentos mejor clasificados.</Rule>
          <Rule>Ejecuta el scanner cada noche después del cierre del mercado.</Rule>
          <Rule>Selecciona el instrumento mejor clasificado del scanner.</Rule>
          <Rule>Activa el EA en el gráfico D1. No lo toques.</Rule>
          <Rule>Revisa el panel cada viernes.</Rule>
          <Rule>Máximo 2 posiciones abiertas en cualquier momento.</Rule>
          <Rule>Nunca muevas un Stop Loss más lejos. Nunca.</Rule>
          <Rule>Si dudas del setup, no entres. Siempre habrá otro trade.</Rule>
        </div>
      </ManualSection>

      {/* Philosophy */}
      <ManualSection icon={BookOpen} title="Filosofía">
        <div className="space-y-4 text-muted-foreground">
          <p>
            Este sistema está diseñado alrededor de una verdad simple: <span className="text-foreground font-medium">50% Win Rate + ganar más de lo que pierdes = sistema rentable</span>.
          </p>
          <p>
            El scanner asegura que siempre estés posicionado en la tendencia más fuerte. El EA asegura que entres con disciplina y gestiones el riesgo mecánicamente. Tu único trabajo es <span className="text-foreground font-medium">no interferir</span>.
          </p>
          <p>
            Cada intervención manual es un voto contra tu propio sistema. Los datos en la página de Inteligencia de Patrones lo demuestran — las intervenciones cuestan dinero.
          </p>
          <p className="text-primary font-medium italic">
            La disciplina en la ejecución supera a la inteligencia en el análisis.
          </p>
        </div>
      </ManualSection>

      {/* VIX Reference */}
      <ManualSection icon={BarChart3} title="Tabla de Referencia VIX">
        <div className="space-y-2">
          <VixRow range="< 25" status="Normal" color="text-success" action="Opera normalmente. Tamaño de posición completo." />
          <VixRow range="25 — 35" status="Elevado" color="text-primary" action="Cautela. Solo instrumentos mejor clasificados." />
          <VixRow range="35 — 45" status="Alto" color="text-orange-500" action="Reduce tamaño un 50%. Selectividad extra." />
          <VixRow range="> 45" status="Extremo" color="text-destructive" action="NO OPERAR. Espera a que las condiciones se normalicen." />
        </div>
      </ManualSection>
    </div>
  );
}

function ManualSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 lg:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-bold">{title}</h2>
      </div>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="text-primary mt-1">•</span>
      <span>{children}</span>
    </li>
  );
}

function Rule({ children, critical }: { children: React.ReactNode; critical?: boolean }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-md text-sm ${critical ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary'}`}>
      {critical && <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
      {!critical && <Shield className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
      <span className={critical ? 'text-destructive font-medium' : 'text-foreground/80'}>{children}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 p-2 rounded bg-secondary">
      <span className="text-xs text-primary font-semibold shrink-0 w-28">{label}</span>
      <span className="text-sm text-foreground/80">{value}</span>
    </div>
  );
}

function VixRow({ range, status, color, action }: { range: string; status: string; color: string; action: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-md bg-secondary text-sm">
      <span className={`font-data font-bold w-16 ${color}`}>{range}</span>
      <span className={`font-semibold w-20 ${color}`}>{status}</span>
      <span className="text-muted-foreground flex-1">{action}</span>
    </div>
  );
}
