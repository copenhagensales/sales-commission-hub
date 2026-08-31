# Tryg - Ret salg: redigerbar skabelon (delt)

## Hvad der bygges

1. Skabelon-boksen bliver større (bredere popover, flere linjer synlige).
2. Ny "Rediger"-knap i boksen. Den vises kun for dem, der allerede har adgang til siden (ejere samt Filip og Annika via `useTrygEditAccess`) — samme adgangskreds som resten af siden.
   - Klik → teksten bliver redigerbar, med "Gem" og "Annuller".
   - Gem skriver teksten til databasen, så alle med adgang ser samme tekst på alle enheder.
3. Kopiér-knappen på hver salgslinje bruger den gemte tekst og indsætter rækkens telefonnummer i `[Telefonnummer]`.
4. Hjælpetekst i boksen: placeholderen `[Telefonnummer]` skal bevares, ellers indsættes nummeret ikke.

## Teknisk

- Ny tabel `public.report_text_templates`: `key` (unik tekstnøgle, fx `tryg_cancel_meeting`), `body` (tekst), `updated_by`, `created_at`, `updated_at` med update-trigger.
  - GRANT til `authenticated` (select/insert/update) og `service_role`.
  - RLS: læsning for aktive medarbejdere; skrivning kun for ejere eller de e-mails, der har Tryg-adgang — håndhævet i databasen, ikke kun i UI.
  - Seed standardteksten som data efter migreringen.
- Ny hook `src/hooks/useReportTextTemplate.ts`: læser skabelonen efter nøgle (React Query) og en mutation til at gemme, med cache-invalidering. Ingen direkte Supabase-kald i komponenten.
- `src/pages/reports/TrygEditSales.tsx`: popover udvides (`w-[28rem]`, `rows={8}`), rediger/gem/annuller-tilstand, og både visning og kopiér-knap bruger teksten fra hooken med den nuværende hardkodede tekst som fallback.

Ingen ændringer i salgsdata, sletning, beregninger eller sideadgang.
