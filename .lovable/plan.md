

## Fix: Behold moerkt tema i PDF-udskrift

### Problem
PDF-rapporten ser hvid ud fordi `@media print` CSS-reglerne (linje 220-246) overskriver det moerke tema med hvid baggrund og moerk tekst. Naar browseren "gemmer som PDF" bruger den print-stilarterne.

### Loesning
Fjern `@media print`-blokken helt, saa det moerke tema bevares i PDF'en. Tilfoej i stedet `color-adjust: exact` og `-webkit-print-color-adjust: exact` paa `body` for at sikre at browseren gengiver baggrundsfarver korrekt ved print/PDF.

### Teknisk aendring

**Fil:** `src/utils/supplierReportPdfGenerator.ts`

1. Tilfoej print-color properties til `body`-stilen:
   - `color-adjust: exact`
   - `-webkit-print-color-adjust: exact`
   - `print-color-adjust: exact`

2. Fjern hele `@media print { ... }` blokken (linje 220-246) saa det moerke tema bruges direkte i PDF'en.

### Resultat
- PDF'en vil have moerk baggrund og lyst tekst -- praecis som det ser ud i preview-vinduet
- Kun 1 fil aendres, ingen andre sideeffekter

