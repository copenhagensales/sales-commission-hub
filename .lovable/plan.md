

# Fix: Martinas manglende salg i Salgsregistreringer

## Rodaarsag

Martina har **359 FM-salg** i databasen, men siden viser kun ca. 112. Det skyldes at queryen i `EditSalesRegistrations.tsx` (linje 135-147) bruger en simpel `.select()` uden pagination. Supabase returnerer maks 1.000 raekker pr. query, og med **2.509 FM-salg** i den valgte periode afskaaeres resten. Da resultatet er sorteret efter dato (nyeste foerst), mister Martina sine aeldre salg.

## Loesning

Erstat den direkte Supabase-query med systemets eksisterende `fetchAllRows` utility, som automatisk paginerer og henter alle raekker.

## Tekniske detaljer

**Fil**: `src/pages/vagt-flow/EditSalesRegistrations.tsx`

AEndring i `queryFn` (linje 134-148):
- Erstat `supabase.from("sales").select(...).eq(...).gte(...).lte(...).order(...)` med `fetchAllRows()`
- `fetchAllRows` bruger `.range()` internt med batches paa 500 raekker og henter automatisk alle sider
- Sortering haandteres via `orderBy`-optionen

Den opdaterede query vil se ud som:

```text
const data = await fetchAllRows(
  "sales",
  "id, sale_datetime, customer_phone, raw_payload, created_at",
  (query) => query
    .eq("source", "fieldmarketing")
    .gte("sale_datetime", `${dateRange.from}T00:00:00`)
    .lte("sale_datetime", `${dateRange.to}T23:59:59`),
  { orderBy: "sale_datetime", ascending: false }
);
```

Tilfoej import af `fetchAllRows` fra `@/utils/supabasePagination` oeverst i filen.

## Effekt
- Alle Martinas 359 salg vil vaere synlige
- Alle 2.509+ FM-salg i perioden hentes korrekt
- Ingen oevre graense paa antal raekker
- Eksisterende filtrering, gruppering og redigering fungerer uaendret

