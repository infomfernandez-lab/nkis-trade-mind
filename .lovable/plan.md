## Plan: Sección Backtester

### 1. Migración Supabase
Crear tabla `backtest_sessions` con RLS:
- Columnas: `id` (uuid PK), `user_id` (uuid not null), `symbol` (text), `broker` (text), `direction` (text), `date_from` (date null), `date_to` (date null), `params` (jsonb), `metrics` (jsonb), `equity_curve` (jsonb), `trades` (jsonb), `created_at` (timestamptz default now())
- RLS: 4 políticas (select/insert/update/delete) con `auth.uid() = user_id`
- Índice por `(user_id, created_at desc)`

### 2. Dependencias
Instalar `xlsx` y `jspdf` + `jspdf-autotable` con `bun add`.

### 3. Ruta
Crear `src/routes/backtester.tsx` (el plugin de TanStack Router regenera `routeTree.gen.ts` automáticamente — no editar a mano).

### 4. Navegación
En `src/components/layout/AppLayout.tsx`:
- Importar `FlaskConical` de `lucide-react`
- Insertar `{ to: '/backtester' as const, label: 'Backtester', icon: FlaskConical }` entre Radar y Calculadora

### 5. Componente principal `src/components/backtester/BacktesterPage.tsx`
Un único archivo con todo (formulario, ejecución, resultados, historial), usando los componentes UI existentes (Card, Button, Input, Slider, Switch, Label, Table) y `recharts` (ya instalado).

#### Estado del formulario
- `broker`: 'darwinex' | 'octx' (mapea NKIS/OCTX a la URL `/backtest/nkis` o `/backtest/octx`)
- `symbol`: autocompletado contra `Object.keys(CONTRACT_SPECS)` desde `@/lib/contract-specs`
- `direction`: 'BUY' | 'SELL'
- `dateFrom`, `dateTo`: opcionales
- Sliders: `adxMin` (23), `atrSl` (1.5), `stochBuy` (70), `stochSell` (30)
- Toggles: `breakevenEnabled` + `breakevenMult` (1.0), `trailingEnabled` + `trailingMult` (2.0)

#### Ejecución
- `fetch('https://ointment-handcraft-payee.ngrok-free.dev/backtest/' + cuenta, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, body: JSON.stringify(params) })`
- En catch / timeout: toast/banner "Servidor offline — abre RUN_BACKTEST_SERVER.bat en tu PC"
- Al éxito: guardar en `backtest_sessions` con `user_id = auth.uid()` y refrescar historial

#### Resultados
- 6 cards de métricas (Win Rate, Profit Factor, Sharpe, PnL, Drawdown, Trades)
- `<LineChart>` de recharts con la `equity_curve`
- Tabla de trades con columnas Entrada/Salida/Precio/SL/Lotes/Días/MFE/PnL/Razón

#### Historial
- Query con TanStack Query a `backtest_sessions` filtrado por `user_id`
- Filtros por símbolo (input) y broker (select)
- Por cada sesión: botón expandir + botones Excel (xlsx) y PDF (jspdf + autotable)

### 6. Verificación
Build automático del harness. Si falla por tipos, ajustar.

### Notas técnicas
- Cliente Supabase del navegador (`@/integrations/supabase/client`) — el usuario ya está autenticado en la app
- No tocar `routeTree.gen.ts` — se regenera solo
- No usar Edge Functions; el backend del backtest es el servidor ngrok del usuario
- Para fechas opcionales basta con `<input type="date">` nativo para no inflar el componente