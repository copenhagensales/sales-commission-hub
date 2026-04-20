
## Fuldt overblik — Eesy TM Adversus, ALL TIME

| State | Antal | Første | Seneste | Allerede rejected | Vises forkert? |
|---|---|---|---|---|---|
| `success` | 466 | 2026-03-31 | 2026-04-20 | 0 | ✅ Korrekt |
| `in-progress` | **13** | 2026-03-23 | 2026-04-20 | 0 | ❌ Ja |
| `cancelled` | **7** | 2026-04-01 | 2026-04-20 | 7 | ✅ Allerede ryddet |

### Konklusion
- **13 salg vises lige nu fejlagtigt** på Eesy TM-dashboardet (alle `in-progress` — sælger har oprettet ordre, men ikke trykket gem/luk-som-success).
- De 7 `cancelled` er allerede markeret `rejected` (vises ikke).
- Datahistorikken på Eesy TM Adversus-integrationen går tilbage til 23. marts 2026.

### Plan — isoleret KUN til Eesy TM Adversus

**1. Ingestion-filter** i `supabase/functions/integration-engine/adapters/adversus.ts` (`fetchSales` + `fetchSalesRange`):
- Slå Eesy TM kampagne-ID'er op via `adversus_campaign_mappings` hvor `client_id = 81993a7b-ff24-46b8-8ffb-37a83138ddba`
- Filtrér KUN disse kampagner: behold hvis `state === 'success'`, drop ellers
- Andre Adversus-kampagner: ingen filter (uændret)

**2. Retroaktiv oprydning** (én SQL-migration):
```sql
UPDATE sales s
SET validation_status = 'rejected'
FROM client_campaigns cc
WHERE s.client_campaign_id = cc.id
  AND cc.client_id = '81993a7b-ff24-46b8-8ffb-37a83138ddba'
  AND s.integration_type = 'adversus'
  AND s.raw_payload->>'state' = 'in-progress'
  AND (s.validation_status IS NULL OR s.validation_status NOT IN ('rejected','cancelled'));
```
Forventet: **13 rækker** ryddes.

### Hvad jeg IKKE rører
- Andre Adversus-klienter (Yousee, Tryg, CODAN, TDC, Lovablecph osv.)
- Webhook-flow (allerede korrekt)
- DB-skema, cron-schedule, 60-min sync-frekvens
- Defensivt frontend-filter droppes — overflødigt når lag 1+2 dækker

### Verificering efter implementering
- Eesy TM-dashboard taller falder med 13
- Næste sync logger `[Adversus] Eesy TM state filter: X -> Y`
- Andre klienter uændret
