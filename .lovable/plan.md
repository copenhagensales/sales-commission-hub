

# Fix: Produkter med manglende kampagnetilknytning

## Problem
226 af 435 produkter har `client_campaign_id = NULL`, hvilket gør dem usynlige i Provisionssatser-fanen. De fleste er forældede, men ca. 20 bruges aktivt i salg.

## Løsning (2 dele)

### 1. UI-fix: Vis også produkter uden kampagne
Ændre queryen i `CommissionRatesTab.tsx` så den bruger et LEFT JOIN i stedet for `!inner`, og viser produkter uden kampagne under en "Ikke tilknyttet"-gruppe.

**Fil:** `src/components/mg-test/CommissionRatesTab.tsx`
- Ændr `.select("id, name, commission_dkk, revenue_dkk, client_campaign_id, client_campaigns!inner(client_id)")` til `.select("id, name, commission_dkk, revenue_dkk, client_campaign_id, client_campaigns(client_id)")`
- Filtrer manuelt på `client_id` i koden i stedet for at lade `!inner` gøre det

### 2. Data-fix: Link AKA-produktet (godkendt)
Kør den allerede godkendte migration for "Salg - AKA":
```sql
UPDATE products
SET client_campaign_id = '823f33d0-e405-4e1a-a20b-f73baaadaefa'
WHERE id = 'efb8f102-15b7-4fbf-a88c-da0be48f37bb'
  AND client_campaign_id IS NULL;
```

De øvrige 225 produkter forbliver uændrede — de fleste er ubrugte og bør linkes manuelt hvis de skal bruges igen.

## Filer der ændres
- `src/components/mg-test/CommissionRatesTab.tsx` (query + filter)
- Én data-migration for AKA-produktet

