# Fix: TDC Månedsmål-boardet viser ingen data

## Årsag (bekræftet)

Forespørgslen i `src/hooks/useTdcMonthlyGoal.ts:89` bruger:

```ts
.or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" })
```

`foreignTable` er den gamle option — supabase-js v2 hedder den `referencedTable`. Filteret bliver derfor lagt på `sale_items` i stedet for `sales`, og API'et svarer:

`{"code":"42703","message":"column sale_items.validation_status does not exist"}`

(verificeret med direkte REST-kald mod samme forespørgsel)

Hele queryen fejler, så hook'en returnerer ingen data — deraf "0 / 0", "Månedsmål mangler" og "Ingen aktive sælgere".

## Ændring

Kun `src/hooks/useTdcMonthlyGoal.ts`:
- Fjern `.or(...)`-filteret fra forespørgslen.
- Frasortér i stedet i JS-loopet, som allerede springer `cancelled` over: spring også `rejected` over (null/andre statusser tæller med). Samme resultat, uden fejlbehæftet filter-syntaks.

Ingen ændringer i mål-konfiguration, UI eller database.
