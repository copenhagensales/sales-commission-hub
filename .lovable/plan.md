# Adgang til "Bulk Salg (Leder)" for Annika Søndergaard (anni@copenhagensales.dk)

## Nuværende tilstand (verificeret)

- Annika Søndergaard findes som aktiv medarbejder, job_title `Salgskonsulent`, team **United**, `work_email = anni@copenhagensales.dk`, `private_email = sondergaardannika@gmail.com`, med loginkonto.
- Fordi hun er på United, har hun allerede adgang til "Tast selv salg" og United-kanalen (`manual-sales/index.ts`: kanaler filtreres på teammedlemskab).
- Bulk-fanen er styret af en eksplicit allowlist, ikke af rolle:
  - Frontend: `src/pages/TastSelvSalg.tsx:63` → `isOwner || isBulkSalesEmail(user?.email)`, listen i `src/config/bulkSalesAccess.ts` (i dag kun Filips to adresser).
  - Backend: `supabase/functions/manual-sales/index.ts:17-20, 111` → `is_owner` eller samme allowlist (matcher login-email, `work_email` og `private_email`).

## Svar på dit spørgsmål

Nej — hun skal **ikke** gøres assisterende teamleder. Det ville ændre rolle, rettigheder og potentielt løn-/rapporteringslogik bredt, uden at give bulk-adgang: bulk-fanen tjekker ikke rolle, men allowlisten. Den rene og mindst risikable løsning er at tilføje hende til allowlisten.

## Hvad der ændres

1. `src/config/bulkSalesAccess.ts`: tilføj `anni@copenhagensales.dk` og `sondergaardannika@gmail.com` til `BULK_SALES_EMAILS`.
2. `supabase/functions/manual-sales/index.ts`: tilføj de samme to adresser til den spejlede liste (linje 17), så backend og UI er 1:1.

Ingen ændringer i selve import-, dublet- eller navnematch-logikken, ingen rolle- eller teamændringer, ingen DB-migration.

## Zone

`TastSelvSalg`-config (gul) + `manual-sales` adgangskontrol (rød: auth/adgang). Kræver din godkendelse.

## Test efter implementering

- Annika ser fanen "Bulk Salg (Leder)" og kan uploade Excel til United-kanalen.
- En anden United-sælger uden allowlist ser stadig ikke fanen og får 403 på `bulk_import`.
