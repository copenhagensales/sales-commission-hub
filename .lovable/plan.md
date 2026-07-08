## Mål
Køre bagudrettet salgs-sync for Alka (Enreach-integration) fra 2026-04-09 til 2026-07-08 (90 dage) via eksisterende `integration-engine`-funktion. Ingen kodeændringer.

## Fakta
- Integration: `alka` (provider=`enreach`), id `48d8bd23-df14-41fe-b000-abb8a4d6cd1d`
- Nuværende data: 6 Alka-salg, alle fra 8/7
- Endpoint: `integration-engine` action `safe-backfill` findes allerede — dag-for-dag, budget-styret (Enreach: 240 req/min, 10.000/time, 30% reserveret til cron), sikker at køre uden at stoppe live-sync

## Handling (én shell-kald)
Invoker `integration-engine` med:
```
{
  "action": "safe-backfill",
  "integration_id": "48d8bd23-df14-41fe-b000-abb8a4d6cd1d",
  "from": "2026-04-09",
  "to": "2026-07-08",
  "datasets": ["sales"],
  "maxRecords": 600,
  "background": true
}
```
Kører i baggrunden — svar returneres straks, fremdrift ses i edge-logs.

## Verificering
Efter ~5–15 min:
1. `select count(*), min(sale_datetime), max(sale_datetime) from sales where client_campaign_id in (select cc.id from client_campaigns cc join clients c on c.id=cc.client_id where c.name ilike 'alka');`
2. Tjek `integration_sync_runs` for det backfill-run (status, api_calls_made, records)
3. Tjek edge-logs for evt. "stoppedEarly" eller budget-advarsler

## Hvis noget mangler
Hvis salg fra bestemte dage ikke kommer ind: kør igen for det snævre datointerval, eller kør `datasets=["sales"]` per kampagne med `campaignIds`.

## Åbne spørgsmål
Ingen — Alka-kampagnerne (Kanvas, Permission, Borsen) er allerede mappet i systemet (der ligger salg fra i dag), så attribution skulle virke ud af boksen.
