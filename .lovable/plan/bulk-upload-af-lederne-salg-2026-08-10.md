# Bulk-upload af Lederne-salg

Excel-filen fra Adversus (kolonner: Mobil, Kampagne, Sidst kontaktet af, Status, Emne-ID, Sidste kontakttidspunkt) skal kunne uploades og oprette præcis de samme salg som "Tast selv → Lederne" gør i dag — med dublet-sikring på mobilnummer.

## Sådan virker det for brugeren

1. Ejer vælger fanen "Bulk Salg (Leder)" og trækker .xlsx-filen ind i "Upload bulk-fil".
2. Filen læses i browseren, og der vises en oversigt: antal gyldige salg, antal dubletter, antal fejl.
3. Knappen "Importér salg" opretter salgene. Hver række bliver et Lederne-salg på den sælger der står i "Sidst kontaktet af", med salgsdato = "Sidste kontakttidspunkt" fra filen.
4. Rækker der ikke kunne oprettes vises i boksen "Fejl i upload" med Årsag, Sælger og Emne-id.

Fejlårsager der vises:
- Mobil mangler eller er ugyldig
- Sælger findes ikke / er inaktiv (navnet matcher ikke en medarbejder)
- Sælger mangler arbejdsmail
- Dublet: mobilnummeret er allerede registreret som Lederne-salg
- Dublet i filen (samme mobil optræder flere gange — første række vinder)
- Emne-ID er allerede importeret tidligere (samme fil uploadet igen)

Status-kolonnen bruges kun som sikkerhed: rækker der ikke er "Succes" springes over og vises som fejl. Kampagne-kolonnen gemmes som info, men bruges ikke til validering.

## Dublet-sikring

Et mobilnummer kan kun give provision én gang på Lederne — uanset dato og uanset om det første salg kom fra tast selv eller en tidligere bulk-upload. Nummeret sammenlignes normaliseret (mellemrum, +45 og bindestreger fjernes), så 20 10 38 09 og 2010 3809 tæller som samme nummer. Emne-ID bruges som ekstra nøgle, så samme fil kan uploades to gange uden at duplikere.

## Teknisk

**Frontend — `src/pages/TastSelvSalg.tsx`**
- `BulkUploadCard`: parser filen med `parseExcelFile` fra `src/utils/excel.ts`, normaliserer kolonnenavne, mapper rækker til `{ mobil, kampagne, saelger, status, emne_id, kontakt_tidspunkt }`, viser optælling + "Importér salg"-knap.
- Fejl fra importen løftes op i `TastSelvSalg` (delt state) og vises i den eksisterende `BulkUploadErrorsCard` — kolonnerne beholdes uændret.
- Ny hook `useBulkImportManualSales` i `src/hooks/useLederneSales.ts` der kalder edge-funktionen og invaliderer `manual-sales-mine`, `sales`, `sales-aggregates`.

**Backend — `supabase/functions/manual-sales/index.ts`**
- Ny action `bulk_import` (POST, `channel=lederne`), kun tilgængelig for kaldere der er manager/ejer (`is_manager_or_above`) — sælgere kan ikke bulk-importere.
- Pr. række:
  1. Normalisér telefonnummer; afvis tomme/for korte.
  2. Slå sælger op i `employee_master_data` på fulde navn (`first_name || ' ' || last_name`, case/whitespace-insensitivt) med `is_active = true`; kræv `work_email`.
  3. Dublet-tjek mod `sales` med `source = 'manual_entry'`, `client_campaign_id` = Lederne-kampagnen, samme normaliserede `customer_phone`, samt mod `raw_payload->>'subject_id'` for Emne-ID.
  4. Opret salg + `sale_items` med "Lederne"-produktet — samme felter som enkelt-oprettelsen, plus `raw_payload`: `bulk_import: true`, `subject_id`, `campaign_name`, `imported_by_employee_id`.
- Svarer med `{ created, skipped, errors: [{ reason, seller, subject_id }] }`.
- Ingen skemaændringer: dublet-nøglerne findes allerede i `sales.customer_phone` og `raw_payload`.

Ingen ændringer for fanerne "Lederne" og "Hiper Bredbånd".
