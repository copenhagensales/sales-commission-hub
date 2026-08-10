# Bulk Salg (Leder): forhåndsvis før registrering

Upload skal først vise hvad filen indeholder — antal gyldige salg og alle fejl — uden at oprette noget. Først når man trykker "Registrer salg" oprettes salgene.

## Flow for brugeren

1. Filen trækkes ind i "Upload bulk-fil".
2. Systemet læser filen og kører en tørkørsel mod backend: samme validering og dublet-tjek som en rigtig import, men ingen salg oprettes.
3. Boksen viser: "X salg klar · Y fejl", og "Fejl i upload"-tabellen udfyldes med Årsag, Sælger og Emne-id for alle problemrækker.
4. Knappen "Registrer salg" bliver aktiv (kun hvis der er mindst 1 gyldigt salg). Når den klikkes, oprettes salgene endeligt, og resultatet vises som i dag ("N salg oprettet").
5. "Fjern" nulstiller fil, optælling og fejlliste, så man kan uploade en rettet fil.

Efter en gennemført registrering vises den endelige fejlliste fra selve importen (typisk identisk med tørkørslens).

## Teknisk

**Backend — `supabase/functions/manual-sales/index.ts`**
- `bulk_import` udvides med et valgfrit `dry_run: boolean` i request body.
- Al validering (telefon-normalisering, sælger-opslag i `employee_master_data`, status-tjek, dublet på normaliseret mobil mod Lederne-salg all time, dublet på `raw_payload->>'subject_id'`, dublet inden for filen) kører uændret.
- Når `dry_run = true` springes alle inserts i `sales`/`sale_items` over; svaret bliver `{ ok: true, created: 0, would_create: N, skipped, errors: [...] }`.
- Uden `dry_run` er adfærden præcis som i dag (`created` tælles op).
- Adgangskrav uændret: kun manager/ejer.

**Hook — `src/hooks/useLederneSales.ts`**
- `BulkImportResult` får `would_create?: number`.
- `useBulkImportManualSales` accepterer `dry_run?: boolean` og sender det med i body. Cache-invalidering (`manual-sales-mine`, `sales`, `sales-aggregates`) sker kun når `dry_run` ikke er sat.
- Ny separat mutation-instans bruges til tørkørslen, så knap-state (`isPending`) for de to trin holdes adskilt.

**Frontend — `src/pages/TastSelvSalg.tsx` (`BulkUploadCard`)**
- Efter parsing kaldes tørkørslen automatisk; resultatet gemmes i ny state `preview: { wouldCreate, skipped } | null`.
- Fejl fra tørkørslen løftes op via den eksisterende `onErrors`-prop og vises i `BulkUploadErrorsCard`.
- Statuslinjen viser "Læser fil…" → "Kontrollerer…" → "X salg klar · Y fejl".
- Knappen skifter tekst fra "Importér salg" til "Registrer salg" og er disabled indtil tørkørslen er færdig og `wouldCreate > 0`.
- Ved klik køres den rigtige import (`dry_run` udeladt) med de samme rækker, og state nulstilles bagefter som i dag.

Ingen skemaændringer. Fanerne "Lederne" og "Hiper Bredbånd" berøres ikke.
