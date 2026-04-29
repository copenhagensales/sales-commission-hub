## Mål

Gør det muligt at vælge **hvilken lønperiode** annulleringerne fra én upload skal trækkes fra sælger i — allerede ved upload-tidspunktet. Valget gælder **kun rækkerne fra denne specifikke upload**, ikke andre rækker i køen.

## Sådan fungerer det i dag

- I `UploadCancellationsTab.tsx` opretter `sendToQueueMutation` en række i `cancellation_imports` (med eget `id`) og N rækker i `cancellation_queue` med `import_id = imports.id` — **uden** at sætte `deduction_date`.
- `cancellation_queue.deduction_date` er nullable. Det udfyldes først manuelt i `ApprovedTab.tsx` ("Godkendte"-fanen) — pr. række eller via bulk-knappen "Ændr lønperiode for alle". Bulk-knappen i ApprovedTab opererer på de **filtrerede synlige rækker** uanset import — den er ikke import-scoped.
- Lønperiode = 15. → 14. (`getPayrollPeriod` i `src/lib/calculations/dates.ts`). `useSellerSalariesCached.ts` filtrerer på `deduction_date` (fallback til `reviewed_at`).

## Hvad der ændres

### 1. UI på upload-trinnet (Forhåndsvisning, før "Send til godkendelseskø")

Tilføj en sektion **"Trækkes på lønperiode"** i preview-trinnet i `UploadCancellationsTab.tsx`, lige over "Send til godkendelseskø"-knappen:

- Dropdown med 5 valgmuligheder, beregnet ud fra `getPayrollPeriod` / `getPreviousPayrollPeriod`:
  - Forrige lønperiode (15. forrige → 14. denne måned)
  - **Indeværende lønperiode** (15. denne → 14. næste måned) — default
  - Næste lønperiode
  - Lønperioden derefter
  - "Vælg specifik dato…" (åbner DatePicker — samme `Calendar`-komponent som `ApprovedTab` allerede bruger)
- Labels formateres med `date-fns` + `da` locale, fx "15. apr – 14. maj 2026".
- Bekræftelses-badge: **"Alle X rækker fra denne upload trækkes 14. maj 2026 (lønperiode 15. apr – 14. maj)"** — gør det utvetydigt at scope er denne upload.

### 2. Skriv `deduction_date` på alle rækker fra denne upload

I `sendToQueueMutation` (linje 2267 ff.) tilføjes feltet på hvert `cancellation_queue`-insert:
```ts
deduction_date: format(selectedDeductionDate, "yyyy-MM-dd")
```

- Datoen sættes til **slutdatoen for den valgte lønperiode** (den 14.) — matcher hvordan `useSellerSalariesCached` filtrerer på periode-interval.
- Alle queue-rækker oprettet i denne mutation deler samme `import_id` → kun rækker fra denne upload påvirkes. **Ingen UPDATE** på eksisterende rækker. Andre uploads, manuelt oprettede annulleringer og allerede godkendte rækker røres ikke.

### 3. Vis valget på import-loggen

Tilføj samme feltvalg som metadata på import-rækken, så det er sporbart i historik:
```sql
ALTER TABLE cancellation_imports ADD COLUMN default_deduction_date date;
```
- `CancellationHistoryTable.tsx` får en ny kolonne "Trækkes" (formattet kort: "Maj-løn (14/5)").
- Historik viser med ét blik hvilken lønperiode hver upload sendte sine rækker til.

### 4. Bevar manuel override i "Godkendte"-fanen

Eksisterende per-række kalender + bulk-knap i `ApprovedTab.tsx` røres ikke. Hvis nogen senere vil flytte enkelte rækker eller en hel batch, sker det fortsat dér.

## Berørte filer

- `src/components/cancellations/UploadCancellationsTab.tsx` — ny state `deductionDate`, nyt UI-blok i preview, ekstra felter i `cancellation_imports`- og `cancellation_queue`-inserts
- `src/components/cancellations/CancellationHistoryTable.tsx` — ny kolonne der viser default trækkedato pr. upload
- `src/lib/calculations/dates.ts` — ny lille helper `listPayrollPeriods(centerDate, count)` (læser eksisterende `getPayrollPeriod`, ingen ændring af kerneberegning)
- `supabase/migrations/<timestamp>_add_default_deduction_date.sql` — én ALTER TABLE

## Zone-vurdering

- `cancellation_queue` er rød zone (lønberegning). Vi **udfylder** kun et felt der allerede eksisterer (`deduction_date`) på nye rækker. Eksisterende rækker røres ikke. `useSellerSalariesCached.ts` røres ikke.
- `dates.ts` er rød (lønberegning). Vi tilføjer kun en wrapper-helper, ændrer ikke `getPayrollPeriod`.
- Migration tilføjer nullable kolonne — ingen breaking change, ingen RLS-impact.

## Edge cases

- Hvis brugeren ikke vælger eksplicit → default = indeværende lønperiode (matcher dagens implicitte adfærd hvor reviewed_at lander dér ved straks-godkendelse).
- "Korrekt match" (auto-approved ved upload) får også `deduction_date` sat — korrekt, da disse også fragår løn i den valgte periode.
- Eksisterende rækker i køen og rækker fra andre uploads påvirkes **ikke**.

## Ikke-omfattet (bevidst)

- Ingen per-række valg på preview (UI-overload). Hele uploaden får samme periode; per-række override forbliver muligt i "Godkendte"-fanen.
- Ingen ændring af bulk-knappen i ApprovedTab (den er filter-scoped, ikke import-scoped — bevidst).
- Trin 8 fra tidligere plan (cancellation_queue-skema-rens) er stadig udskudt.
