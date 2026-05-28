# Plan de reorganización de la app

Trabajo grande. Lo divido en 5 bloques que se pueden entregar en orden. Cada bloque deja la app funcional.

---

## Bloque 1 — Navegación y nombres (rápido, base para todo)

**Reordenar pestañas** en `src/components/layout/AppLayout.tsx`:
`Panel → Activos → Escáner → Registro de Trades → Agenda → Calculadora → Backtester → Estadísticas → Patrones → Informes → Manual → Ajustes`

**Renombrar Radar → Escáner**:
- Label del nav: "Escáner" (la ruta `/radar` se mantiene internamente para no romper enlaces; solo cambia el texto visible y los títulos de página).
- Dentro de `/radar`: la pestaña "Vigilancia" pasa a llamarse **"Vigilancia EA"**.
- Textos de cabecera ("Centro de mando" → "Escáner"), meta `<title>`.

**Eliminar el panel lateral derecho global**:
- Quitar `<RightPanel />` de `AppLayout` y `RightPanelProvider` del root (o dejar el provider como no-op para no romper `useRightPanel()` existentes).
- Auditar usos de `openPanel(...)` y reemplazarlos por navegación a página completa (principalmente apertura de activo y de trade).

---

## Bloque 2 — Activo como página maestra (estilo CRM)

La página de un activo es el elemento central. Ruta: `/activos/$broker/$symbol` (ya existe el archivo, hay que rellenarla).

**Layout de la página de activo** (página completa, con botón "← Volver" que usa `router.history.back()`):

1. **Header / consola de estatus**
   - Símbolo + descripción, broker (cuenta), familia, sector
   - Badges: Elite / Sólido / Observar / Descartado (derivado de `last_score`)
   - Última inclusión en escáner (`last_seen_scanner`)
   - Estado de posición: "Posición abierta" (link al trade) / "Sin posición"
   - Última operación cerrada (P&L + link)

2. **Tabs internas**
   - **Timeline** (por defecto): feed cronológico de eventos del activo
     - Operaciones (abierta/cerrada) → link a `/trades` con ese trade
     - Actividades/tareas de Agenda → link a la actividad
     - Inclusiones en escáner (score, dirección)
     - Render con fecha+hora, parser de menciones tipo `ADI` → `<Link to="/activos/$broker/$symbol">`
   - **Estadísticas**: nº trades, win rate, P&L total, mejor/peor trade, profit factor del activo
   - **Información general**: nombre, mercado, familia, sector, tipo, especificación contrato, horario, enlace web (campos editables guardados en `assets`)

**Datos**: agregar desde `trades` (filtrado por `symbol`+`broker`), `activities` (filtrado por `symbol`), `momentum_sessions` (historial de escáner).

**Click handlers**: en `AssetsPage` (tabla) y en las tablas del Escáner, cada fila navega con `navigate({ to: '/activos/$broker/$symbol', params: { broker, symbol } })`.

---

## Bloque 3 — Panel (Dashboard diario)

Rediseñar `src/routes/index.tsx` como cockpit del día. Secciones en grid responsivo:

1. **Resumen del negocio** (hoy) — P&L día, P&L mes, win rate, racha, drawdown actual
2. **Top 10 del escáner** + botón "Ver escáner completo" → `/radar`
3. **Briefing de mercado** (componente existente `MarketBriefing`) — incluye sentimiento + noticias relevantes + qué esperar (ya usa Lovable AI)
4. **Posiciones abiertas** (mini tabla) → link a `/radar` tab posiciones
5. **Calendario económico de hoy** — nuevo widget; fuente: API pública gratuita (Trading Economics tiene calendario gratuito limitado, o `nfs.faireconomy.media/ff_calendar_thisweek.json` que es gratis y sin API key). Filtrar por hoy + alta importancia.
6. **Actividades de hoy** (componente existente `AgendaTodayWidget`)
7. **Últimas operaciones cerradas** (mini lista, 5)
8. **Calendario P&L** (componente existente `PnlCalendarSection`, versión compacta)
9. **Últimos 10 backtests** — query a `backtest_sessions` ordenado por `created_at desc`

---

## Bloque 4 — Escáner (tabs y comportamiento de fila)

En `src/routes/radar.tsx`:
- Renombrar UI: pestañas "📡 Escaneado", "👁 Vigilancia EA", "📈 Posiciones"
- En `ScannerListView`, `VigilanciaView` y `OpenPositionsTable`: cada fila clickable → navega a la página del activo (no panel lateral).
- Quitar cualquier apertura en `RightPanel` que aún quede.

---

## Bloque 5 — Limpieza global del panel lateral

Buscar `useRightPanel`, `openPanel`, `RightPanel` en todo `src/` y reemplazar por navegación a página. Eliminar el componente y el contexto cuando ya no haya consumidores.

---

## Detalles técnicos

- **Rutas nuevas/tocadas**: `src/routes/activos.$broker.$symbol.tsx` (rellenar), `src/routes/index.tsx` (rediseño), `src/routes/radar.tsx` (renombrar UI), `src/components/layout/AppLayout.tsx` (orden + label + sin RightPanel).
- **Componentes nuevos**: `AssetPageHeader`, `AssetTimeline`, `AssetStats`, `AssetInfo`, `EconomicCalendarWidget`, `RecentBacktestsWidget`, `RecentClosedTradesWidget`, `TopScannerWidget`.
- **Calendario económico**: usar `https://nfs.faireconomy.media/ff_calendar_thisweek.json` (ForexFactory, gratis, sin key). Cache 1h.
- **Timeline parser**: regex `\b([A-Z]{2,6})\b` que matchee símbolos presentes en `assets` y los envuelva en Link.
- **No tocar**: `src/integrations/supabase/*`, lógica de trades/watchlist existente, el proxy de assets.

---

## Orden de entrega sugerido

Empiezo por el **Bloque 1** (rápido, visible inmediatamente) y el **Bloque 5** (quitar panel lateral, que es lo que más te molesta). Luego confirmamos y sigo con activos (Bloque 2), después Panel (Bloque 3) y Escáner (Bloque 4).

¿Lo apruebas tal cual, o quieres ajustar prioridades / quitar alguna sección del Panel?
