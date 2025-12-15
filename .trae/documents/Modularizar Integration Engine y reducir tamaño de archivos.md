## Objetivo
Maximizar legibilidad y entendibilidad del Integration Engine, modularizando por dominios y añadiendo soporte de rangos de fechas para ventas y llamadas, sin romper compatibilidad.

## Principios de legibilidad
- Funciones pequeñas y con propósito único (≤100 líneas por archivo ideal).
- Nombres explícitos y consistentes para módulos y funciones.
- Datos inmutables en flujos de transformación y resultados tipados.
- Errores y logs con contexto claro (acción, integración, campaña, batch).

## Estructura propuesta
- `index.ts` (orquestador HTTP)
  - Parseo de request (incluye `from`, `to`, `days`), selección de adapter con `getAdapter(...)`, despacho de acciones.
- `actions/`
  - `fetch-sample-fields.ts` y `repair-history.ts` extraídos desde `index.ts`.
  - Exportan `handle(req, supabase)` para claridad y pruebas.
- `core/`
  - `users.ts`, `campaigns.ts`, `sales.ts`, `calls.ts`, `mappings.ts` (extraer funciones actuales de `core.ts`).
  - `index.ts` expone `IngestionEngine` como fachada manteniendo el API existente.
- `adapters/`
  - Mantener `adversus.ts`, `enreach.ts`, `interface.ts`, `registry.ts`.
- `utils/`
  - `batch.ts`, `retry.ts`, `logging.ts` (helpers puros y reutilizables).
- `types.ts`
  - Añadir `DateRange = { from: string; to: string }` (ISO8601), `FetchParams` para claridad.

## Soporte de rangos de fechas
- Request Body (Edge Function):
  - Aceptar `from` y `to` (ISO8601) además de `days`.
  - Validación simple: `from <= to`, fechas válidas, `days` solo si no hay rango.
- Flujo en `index.ts`:
  - Si llega `from/to` → preferir rango; si no, usar `days`.
  - Pasar `DateRange` a adapters si soportan el método por rango, si no, fallback a `days` (diferencia de días) para compatibilidad.
- Contrato de adapters (sin romper compatibilidad):
  - Mantener `fetchSales(days, campaignMappings?)` y `fetchCalls(days)`.
  - Añadir métodos opcionales: `fetchSalesRange(range: DateRange, campaignMappings?)` y `fetchCallsRange(range: DateRange)`.
  - `index.ts` detecta y usa los métodos de rango si existen; si no, calcula días y llama al método existente.
- Frontend batching:
  - Permitir enviar `from/to` en ventanas (p.ej. 7 días) desde el frontend.
  - Opcional: aceptar `windowSizeDays` y `cursor` para que el frontend itere rangos; Edge Function responde con `nextCursor` cuando proceda.

## Cambios técnicos clave
- Extraer acciones a `actions/` con firmas claras.
- Dividir `core.ts` por dominios y reexportar `IngestionEngine` desde `core/index.ts`.
- Añadir `DateRange` y `FetchParams` en `types.ts`.
- Extender adapters con métodos de rango opcionales sin modificar firmas existentes.
- `index.ts`:
  - Lectura y validación de `from/to`.
  - Elección de `fetch*Range` o fallback a `days`.
  - Logs descriptivos con contexto y conteos.

## Optimización y resiliencia
- `batch.ts`: chunking y limitador de concurrencia para grandes volúmenes.
- `retry.ts`: backoff exponencial para llamadas externas.
- `logging.ts`: formateo consistente y campos clave.

## Compatibilidad
- Import `IngestionEngine` se mantiene (vía `core/index.ts`).
- Métodos actuales de adapters siguen operativos; los de rango son opcionales.
- Respuestas HTTP preservan estructura actual, con campos adicionales solo si se usan rangos (`dateRange` en `details`).

## Plan de implementación
1. Crear `core/*` y `core/index.ts` reexportando `IngestionEngine` sin modificar su API.
2. Extraer `actions/fetch-sample-fields.ts` y `actions/repair-history.ts` y actualizar `index.ts` para delegar.
3. Añadir `types.ts` con `DateRange` y `FetchParams`.
4. Implementar en `index.ts` la lógica de `from/to` con validación y fallback a `days`.
5. Implementar en adapters los métodos opcionales `fetch*Range` (cuando la API lo soporte) con fallback.
6. Introducir `utils` (`batch`, `retry`, `logging`) y usarlos en `core/sales.ts` y `core/calls.ts`.
7. Pruebas de humo y validación de logs.

## Pruebas
- Enviar `actions: ["sales"]` con `from/to` y verificar que se usa `fetchSalesRange` o fallback.
- Validar `calls` con rango.
- Batching desde frontend enviando ventanas y verificando `integration_logs`.

¿Confirmas este plan con foco en legibilidad y soporte de rangos de fechas para proceder?