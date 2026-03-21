

# Sikr telefonnumre ved import fremadrettet

## Problem
Adversus `/results` endpoint returnerer salg **uden** `lead.phone`. Adapteren sætter `customerPhone: s.lead?.phone || ""` som altid er tom.

`buildLeadDataMap` henter allerede lead-data via `/leads/{leadId}` for at finde OPP-numre, men **gemmer ikke telefonnummeret** fra lead-svaret — kun `opp`, `resultData` og `resultFields`.

## Løsning
Udvid `buildLeadDataMap` til også at gemme `phone` fra lead-data, og brug det i sale-objektet.

## Ændringer

### 1. `supabase/functions/integration-engine/adapters/adversus.ts`

**Udvid return-typen for `leadIdToData`** (linje 565-566):
- Tilføj `phone: string | null` til map-værdien, så den også indeholder telefonnummeret

**I `buildLeadDataMap`** (linje 598-621):
- Ekstraher `phone` fra `leadData`: `const phone = leadData.phone || leadData.contactPhone || leadData.mobile || null`
- Gem det i map'et: `leadIdToData.set(leadId, { opp, resultData, resultFields, phone })`

**I `fetchSales`** (linje 297-319):
- Brug `leadData?.phone` som fallback for `customerPhone`:
  ```
  customerPhone: s.lead?.phone || leadData?.phone || ""
  ```

**I `fetchSalesRange`** (linje 471-487):
- Samme ændring: brug `leadData?.phone` som fallback

### Resultat
- Alle fremtidige Adversus-salg får telefonnummer direkte ved import
- Ingen ekstra API-kald — data hentes allerede i `buildLeadDataMap`
- Enrichment-healeren behøver ikke længere udfylde telefonnumre for nye salg

| Fil | Ændring |
|-----|---------|
| `supabase/functions/integration-engine/adapters/adversus.ts` | Tilføj `phone` til `buildLeadDataMap` og brug det i `fetchSales`/`fetchSalesRange` |

