
# Bulk-opdater Enreach pending salg til skipped

## Problem
5.881 Enreach-salg sidder fast i `enrichment_status = 'pending'` fordi de er oprettet via webhook (med `enreach-`-prefix) og ikke kan beriges via API. Enrichment-healeren skipper dem alligevel, men de tæller med i health checks og skaber falske alarmer.

## API-limit pavirkning
**Ingen.** Dette er en ren SQL UPDATE i databasen. Ingen eksterne API-kald involveres.

## Aendring

### SQL Migration
En enkelt UPDATE-sætning:

```sql
UPDATE sales
SET enrichment_status = 'skipped',
    updated_at = now()
WHERE integration_type = 'enreach'
  AND enrichment_status = 'pending';
```

Dette opdaterer alle 5.881 rækker paa et oejeblik.

## Forventet effekt
- "Salg uden sale_items" health check falder markant (de 390 i UI inkluderer mange af disse)
- "Enreach manglende enrichment" health check gaar fra 5.881 til 0
- Enrichment-healeren spilder ikke tid paa at loope over salg den alligevel skipper
- Ingen sideeffekter paa andre systemer
