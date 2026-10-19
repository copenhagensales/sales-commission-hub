# Word-skabelon: TDC Idriftsættelsesmail

Én Word-fil (`TDC_Idriftsaettelsesmail_skabelon.docx`) i Filer. Teksten er den samme som den, værktøjet laver i dag. Alle valg står med i filen.

## Opbygning
- **Faste afsnit** står uden markering: hilsen, "Videre forløb", "Sådan finder du dit simkortnummer" og afslutningen.
- **Valgfrie afsnit** får titlen "(Valgfrit)" i grå kursiv. Det gælder mobilt bredbånd, router, 5G Fri, tilskud, TDC Shop-teksten (kun ved terminaltilskud), funktioner og fordele.
- **Enten/eller-valg** får titlen "(Vælg én)". Det gælder:
  - Omstillingsløsning + One+ eller One+ Løsning
  - Opstart: når binding udløber eller ønskedato
  - Mobilt bredbånd: datadelingskort eller mobilevoice
  - Tilskud: med produktliste eller kun beløb
- **Felter, der skal udfyldes**, står med gul markering i [klammer]. Det gælder kontaktperson, telefonnummer, hovednummer, nummer, abonnement, simkort, beløb og produkt.
- Funktioner og fordele vises som en punktliste med alle muligheder. Man sletter dem, der ikke skal bruges.
- Abonnementer og routere vises som en liste over de muligheder, man kan vælge imellem.

## Teknisk
- Teksterne tages fra `buildMail()` og konstanterne i `TdcIdriftsaettelseForm.tsx`. Filen genereres med docx-js. Skriftypen er Calibri 11, og der bruges rigtige punktlister.
- Filen valideres, laves om til PDF og kontrolleres side for side.
- Der ændres ikke noget i appen eller i databasen.
