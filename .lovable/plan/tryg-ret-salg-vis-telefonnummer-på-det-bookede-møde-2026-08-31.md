# Tryg - Ret salg: vis telefonnummer på det bookede møde

## Datagrundlag (bekræftet)

`sales.customer_phone` er udfyldt på Kanvas-salgene og matcher `raw_payload -> data -> Telefon1` (fx `25139306`, `30531522`). Ingen ny datakilde er nødvendig.

## Ændring

1. `src/hooks/useTrygKanvasSales.ts`
   - Tilføj `customer_phone` til `sales!inner(...)`-selecten.
   - Tilføj `customerPhone: string | null` på `TrygKanvasSale` og map værdien igennem.
2. `src/pages/reports/TrygEditSales.tsx`
   - Ny kolonne "Telefon" mellem Sælgernavn og Antal, med `tabular-nums`. Tom værdi vises som "—".
   - Opdater `colSpan` fra 5 til 6 i tomme/indlæser-rækker.

Ingen ændringer i sletning, beregninger eller adgangskontrol — udelukkende visning.

## Verifikation

- Typecheck
- Åbn siden og bekræft, at telefonnummeret vises på dagens rækker
