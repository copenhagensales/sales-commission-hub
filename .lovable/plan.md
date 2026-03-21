

# Rul turbo-mode tilbage til normal drift

## Status nu
- Cron job #99 kører stadig i turbo: `*/5 * * * *` med `maxBatch: 80, turboMode: true`
- Turbo hjælper ikke — Adversus returnerer "empty lead data" (leads slettet/udløbet)
- 15.569 pending + 132 failed salg sidder fast

## Ændringer

### 1. Rul cron tilbage til normal
Opdater job #99:
- Schedule: `3,18,33,48 * * * *` (hvert 15. min)
- Payload: `{"maxBatch": 20}` (fjern turboMode)

### 2. Stop gentagende fejl
Sæt de 105 "empty lead data"-salg til `skipped` så healeren ikke bruger budget på dem igen:
```sql
UPDATE sales 
SET enrichment_status = 'skipped', 
    enrichment_error = 'lead_data_unavailable_in_source'
WHERE enrichment_status = 'failed' 
  AND enrichment_error = 'API returned empty lead data';
```

### 3. Behold turbo-koden
`turboMode`-parameteren forbliver i edge function som opt-in — ingen skade ved normal drift.

## Resultat
- Normal healer-drift genoptages (20 batch, 15 min interval)
- Ingen spildte API-kald på uopnåelige leads
- De ~15.500 pending salg heales gradvist (de der har tilgængelig data)

