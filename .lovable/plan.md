# Word-skabelon: TDC Opsummering (Salgsværktøj)

Én Word-fil (`TDC_Opsummering_skabelon.docx`) i Filer med opsummeringsteksten fra "2. Opsummering" i TDC Salgsværktøj (typen "Ny implementeringsopsummering", som værktøjet bruger). Teksten er den samme, som værktøjet laver i dag, og alle valg står med.

## Opbygning
- **Faste afsnit** uden markering.
- **Valgfrie afsnit** med titlen "(Valgfrit)" i grå kursiv, fx mobilt bredbånd, router, omstilling, tilskud og opstart.
- **Enten/eller-valg** med titlen "(Vælg én)", fx Standard/Avanceret omstilling, opstartstidspunkt og bredbåndstype.
- **Felter, der skal udfyldes**, med gul markering i [klammer], fx antal, produktnavn, pris pr. måned, tilskudsbeløb og hardware.
- Abonnementer vises som en liste over mulighederne fra værktøjet.
- Engelsk version kommer med som eget afsnit, hvis værktøjet har den til denne type.

## Teknisk
- Tekst og betingelser tages fra `generateSummary.ts` (implementering-grenen) og valgene i `TdcOpsummeringForm.tsx`.
- Genereres med docx-js, Calibri 11 og rigtige punktlister. Filen valideres og kontrolleres side for side som PDF.
- Der ændres ikke noget i appen eller i databasen.
