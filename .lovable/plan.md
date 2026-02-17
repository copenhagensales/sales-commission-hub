

# Fix: buildLeadDataMap refactor i adversus.ts

## Status

15 af 16 punkter i den godkendte plan er implementeret og virker. Det eneste der mangler er **buildLeadDataMap-refaktoren** (plan punkt B3) i `adversus.ts` linje 422-609.

## Hvad er problemet

Den nuvaerende `buildLeadDataMap` (linje 422-609) har to flaskehalse:

1. **Bulk kampagne-fetch med `pageSize=5000`** (linje 457): For store kampagner (fx Relatel 105958 med 5000+ leads) returnerer API'en kun de foerste 5000 - resten mangler
2. **Fallback begranset til `MAX_FALLBACK_LEADS = 20`** (linje 542): Naar leads mangler efter bulk-fetch, hentes max 20 individuelt - resten faar tom `leadResultData`

Resultat: Salg vises med "Lead data ikke modtaget fra kildesystemet" og pricing rules baseret paa leadResultData (fx Tilskud) matcher ikke.

## Loesning

Erstat hele `buildLeadDataMap` metoden (linje 422-609) med ny logik:

1. **Udtraek unikke `leadId`s** direkte fra sales-arrayet (typisk 50-200 unikke leads)
2. **Fetch ALLE leads individuelt** via den eksisterende `fetchLeadById` metode (linje 616-661) - denne er allerede testet og fungerer
3. **Batch i grupper af 5** med 200ms delay for rate limit respekt
4. **Ingen `MAX_FALLBACK_LEADS` begransning** - alle leads hentes

### Output-format er 100% identisk

- `Map<leadId, { opp, resultData, resultFields }>`
- OPP-pattern matching (`/OPP-\d{4,6}/`) bevares uaendret
- `resultFields` parsing (name/label -> value) bevares uaendret
- Baade `fetchSales` og `fetchSalesRange` kalder `buildLeadDataMap` - begge faar automatisk den nye logik

### Hvad roeres IKKE

- `core/sales.ts` - uaendret (straksbetalinger, pricing rules, normalize)
- `core/calls.ts` - uaendret
- Enreach adapter - uaendret (har sin egen lead-flow)
- Sessions-sync - uaendret (allerede implementeret)
- Alle andre filer - uaendret

## Teknisk detalje

### Fil: `supabase/functions/integration-engine/adapters/adversus.ts`

Erstat linje 422-609 med:

```text
buildLeadDataMap(sales, campaignConfigMap):
  1. Byg campaignId -> oppFieldId map fra campaignConfigMap (same logik som foer)
  2. Udtraek unikke leadIds fra sales (Set for dedup)
  3. Log antal unikke leads
  4. For hver batch af 5 leadIds:
     a. Parallel fetch via fetchLeadById(leadId)
     b. For hvert lead resultat:
        - Parse resultData array
        - Byg resultFields object (fieldName -> value)
        - OPP-pattern match paa alle field values
        - Gem i leadIdToData map
     c. 200ms delay mellem batches
  5. Log statistik (total leads, OPPs fundet, manglende)
  6. Return leadIdToData
```

### Noegleforskel fra gammel kode

| Gammel logik | Ny logik |
|---|---|
| Fetch 5000 leads per kampagne (bulk) | Fetch kun de leads der bruges i salg |
| Max 20 fallback leads | Ingen begransning |
| Mister leads i store kampagner | Henter praecis de leads der skal bruges |
| ~5000+ API kald per kampagne | ~50-200 API kald total (kun brugte leads) |

### Risiko: Lav

- `fetchLeadById` er allerede i brug og testet (linje 616-661)
- Output-format aendres ikke
- Alle downstream processer (pricing rules, normalization, OPP extraction) er upaavirkede
- Worst case: Revert til nuvaerende kode

## Forventet resultat

- Alle Adversus-salg faar korrekt `leadResultData`
- "Lead data ikke modtaget fra kildesystemet" forsvinder for Relatel og andre store kampagner
- Pricing rules baseret paa leadResultData (fx Tilskud) virker korrekt

