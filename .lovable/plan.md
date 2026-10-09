# Data import: kolonnedefinitioner og sletteregler for Eesy TM kurvrettelser

## Hvad der bygges
Under fanen "Manuelle data upload" på Data import:

1. **Kategorier (frit definerbare):** Ejere opretter selv kategorier med navn, beskrivelse og sletteregel i antal dage efter upload, fx "Kundetelefon – 90 dage".
2. **Upload-definition "Eesy TM kurvrettelser & salgsmatching":** En liste over kendte kolonnenavne fra arket. Hver kolonne knyttes til én kategori. Man kan tilføje kolonner med hånden eller indlæse kolonnenavne fra en eksempelfil. Kun overskrifterne læses, der gemmes ingen værdier.
3. **Status:** Siden viser, om alle kolonner har en kategori og en sletteregel.

På annulleringsfanen, kun for Eesy TM kurv- og kombineret upload:
- Kolonner, der ikke er defineret, fjernes fra rækkerne, før noget gemmes. Uploaden fortsætter.
- Der vises en advarsel som "2 kolonner blev ikke gemt, fordi de ikke er defineret: X, Y. Definér dem under Data import."
- Hvis definitionen ikke er sat op endnu, gemmes ingen kolonner ud over dem, matchingen bruger. Der vises en advarsel.

**Sletning:** Et dagligt job fjerner felterne i en kategori fra de gemte uploadrækker, når dagene er gået. Sletningen rammer kun feltværdien, ikke kurvrettelsen, matchingen, salget eller provisionen. Hver kørsel logges med antal felter i GDPR-oprydningsloggen.

## Afgrænsning
- Kun Eesy TM og kun kurv- og kombineret upload. Andre kunder, annulleringstyper, TDC og eksisterende sletteregler ændres ikke.
- Matching, kurvberegning og løn ændres ikke. Kolonner, matchingen bruger, skal altid være defineret, før uploaden kan køre.
- Kun ejere kan redigere definitioner.

## Åbent punkt (besluttes før sletjobbet aktiveres)
Allerede gemte Eesy TM-uploads rammes ikke af reglerne. Sletjobbet bygges, men kører kun på nye uploads, indtil I beslutter noget andet.

## Teknisk
- Migration med nye tabeller:
  - `data_import_categories`: id, navn, beskrivelse, `retention_days`.
  - `data_import_definitions`: id, nøgle `eesy_tm_basket`, client_id.
  - `data_import_column_rules`: definition_id, kolonnenavn normaliseret til små bogstaver uden ekstra mellemrum, category_id.
- Rettigheder på tabellerne: GRANT og RLS. Læsning for authenticated, så uploaden kan filtrere. Skrivning kun for ejer via eksisterende `is_owner`/superadmin-funktion.
- Ny kolonne `cancellation_queue.data_rule_applied_at` (nullable). Den markerer nye rækker, så sletjobbet kun rammer dem.
- Hook `useDataImportRules.ts` med React Query, og UI i `src/components/data-import/`.
- `UploadCancellationsTab.tsx` (rød zone, godkendes her): et filter på `uploaded_data`, før data indsættes, kun når klienten er Eesy TM og typen er basket eller both. Logikken ligger i `src/utils/dataImportFilter.ts` med test.
- Edge function `data-import-retention` (cron, dagligt) bruger `gdpr_strip_blocked_jsonb`-mønsteret. Den logger til `gdpr_cleanup_log` og starter med en tørkørsel, der kun viser antal.
- Test: filterfunktionen fjerner udefinerede kolonner og beholder definerede. Upload med fiktiv fil i browseren.
