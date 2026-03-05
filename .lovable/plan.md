

## Gør periode og totaler tydeligere i Excel-eksporten

### Problem
Excel-filen mangler kontekst — leverandøren kan ikke se hvilken periode data dækker, eller hvad totalbeløbet er.

### Løsning
Tilføj **header-rækker** øverst i arket og en **totalrække** nederst:

**Fil: `src/components/billing/SupplierReportTab.tsx`** (Excel-logikken, linje ~901-938)

1. **Tilføj 2-3 header-rækker før tabeldata:**
   - Række 1: `Leverandørrapport: [lokationstype]`
   - Række 2: `Periode: [dato-range eller måned]`
   - Række 3: tom (separator)
   - Række 4: kolonneoverskrifter (nuværende headers)

2. **Tilføj totalrække efter data:**
   - Tom i tekst-kolonner, sum af Dage, sum af Beløb
   - Hvis rabat: også sum af Rabat og Efter rabat

3. **Fed skrift** på header-rækker og totalrække (via cell styling i xlsx)

Eksempel output:
```text
A1: Leverandørrapport: Kvickly
A2: Periode: Februar 2026
A3: (tom)
A4: Lokation | ID | By | Uger & Dage | Dage | Beløb
A5-A17: (data)
A18: Total | | | | 56 | 57.000
```

Ingen database-ændringer. Ingen nye filer.

