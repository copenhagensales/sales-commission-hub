## Plan: Safe-backfill på Eesy TM (kampagne 114001)

### Hvad
Kør `safe-backfill` på `integration-engine` for Eesy TM-integrationen for at hente evt. manglende salg de seneste 14 dage — inkl. nyligt åbnet kampagne 114001 (Tjenestetorvet Premium).

### Hvordan
Kald edge function `integration-engine` med:
- `action: "safe-backfill"`
- `integration_id: fe87f6eb-dc6a-4209-9a47-d84054381452` (Eesy TM, provider: adversus)
- `from: 2026-05-14`
- `to: 2026-05-28`
- `datasets: ["sales"]`
- `background: true`

Køres som ren tool-invocation via `supabase--curl_edge_functions` — ingen kodeændringer.

### Efter kørsel
Genkør samme dags-aggregat på `sales`-tabellen filtreret på `dialer_campaign_id = '114001'` for at se om nye dage/salg er kommet ind.

### Forbehold
- Hvis Eesy endnu ikke har givet integrationen læseadgang til kampagnen, returnerer Adversus ingen rækker for 114001 — backfill fejler ikke, men finder bare 0 nye salg.
- Backfill rammer hele Eesy TM (ikke kun kampagne 114001); andre kampagner upserts idempotent og påvirker ikke historik.
