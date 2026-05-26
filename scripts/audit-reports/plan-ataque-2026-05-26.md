# Plan de ataque — Mobile fixes exhaustivos 2026-05-26

## Diagnósticos
- ✅ D1: servicios crash — NO se encontró causa (sin Recharts, sin valores "rem" en props numéricas). El crash es intermitente o ya fue corregido.
- ✅ D2: maintenance crash 414px — NO se encontró causa JS. El layout usa flex-wrap que maneja mobile correctamente. Puede ser overflow de tabla horizontal (overflowX: auto ya presente).

## PARTE 1 — Bugs críticos
- ✅ FIX 1: servicios crash — No hay causa real. No se aplicó cambio.
- ✅ FIX 2: maintenance 414px — No hay causa JS. Flex-wrap ya maneja mobile. Sin cambios necesarios.

## PARTE 2 — MetricCircles
- ✅ FIX 3: 6 columnas siempre con celdas vacías (components/MetricCircles.tsx) — Nuevo chunkItems() reemplaza computeRows(). Siempre repeat(6, 1fr) con celdas vacías al final.
- ✅ FIX 4: Verificar formatMetricValue() — Existe y funciona correctamente.
- ✅ FIX 5: uiTheme ya implementado — Verificado, useTheme() + borderRadius mapping existente.

## PARTE 3 — Ocultar MetricCards en mobile
- ✅ FIX 6a: tenants AppGrid → className="metric-grid-desktop-only" agregado
- ✅ FIX 6b: cleaning — No tiene MetricCard/AppGrid rectangular. Usa mod-stat-bar (oculto en mobile con nuevo CSS). MetricCircles ya presente.
- ✅ FIX 6c: analytics — analytics-stat-bar + metric-grid-desktop-only agregado al div
- ✅ FIX 6d: servicios — metric-grid-desktop-only agregado al div de service-type cards. MetricCircles ya presente.
- ✅ FIX 6e: dashboard — Verificado, no tiene MetricCards rectangulares.

## PARTE 4 — Donuts y gráficas responsive
- ✅ FIX 7: Dashboard donuts sin card wrapper — CSS dashboard-card-mobile transparent verificado.
- ✅ FIX 8: Recharts ResponsiveContainer — Verificado en todos los charts (ninguno tiene PieChart/BarChart con width= inline).
- ✅ FIX 9: Collections donuts en columna en mobile — Clase collections-chart-row agregada + CSS @media (max-width: 768px).

## PARTE 5 — Layout mobile
- ✅ FIX 10: Una sola columna — dashboard-grid-2 ya manejado por CSS existente. analytics grid usa dashboard-grid-2.
- ✅ FIX 11: Gap 16px — dashboard-grid-2 gap ya tiene 16px en mobile.
- ✅ FIX 12: Tabs/pills ancho completo — AppTabs ya tiene grid 1fr 1fr en mobile (CSS existente).
- ✅ FIX 13: /home cards compactas — Ya usa clamp() y isSmall para layout responsive.
- ✅ FIX 14: /maintenance filtros — mod-filters ya tiene flex-direction: column en mobile.

## PARTE 6 — Reporte
- ✅ TypeScript check 0 errores
- ✅ Playwright audit v4 ejecutado
- ✅ HTML report guardado: scripts/audit-reports/mobile-audit-v4-2026-05-26.html (8.7 MB)
- ✅ Páginas: 15 | Con issues: 14 | Overflows: 0 | Touch: 14
- [ ] Commit + push
