

# Fix: Tilføj OPP-matching i produkt-aware blokken for TDC Erhverv

## Problem
Produkt-betingelserne sætter `hasAdvancedProductMatching = true`, som returnerer ved linje 1812 — **før** OPP-matchingen (linje 1833). TDC Erhverv bruger udelukkende OPP til at finde salg, så resultatet er 0 matches.

## Excel-struktur bekræftet
Filen har kolonnerne: `Lukkedato`, `OPP-nr.`, `Salgsmulighed opretter`, `TT`, `TT mandat`, `TT trin`, `Produkt`, `Pris`, `Indeks`, `Antal`, `CPO Total`. Flere produktrækker per OPP grupperet med en "Total"-række. Strukturen er identisk med hvad systemet allerede parser via `consolidateOppRows`.

## Løsning
Indsæt **Pass 1c: OPP-matching** i den produkt-aware blok (efter Pass 1b log på linje 1435, før Pass 2 på linje 1437).

### Pass 1c logik:
1. Tjek om `oppColumn !== "__none__"` og der er OPP-numre i data
2. Byg `uploadedRowsByOpp` map og `indexByOpp` fra `dedupedData` (samme logik som standard-blokken linje 1863-1945)
3. Brug `consolidateOppRows` til at samle produktrækker per OPP (genbrug funktionen fra linje 1897)
4. Iterér `candidateSales`, match via `extractOpp(sale.raw_payload)`
5. For hvert match:
   - **Annulleringer**: Bestem `targetProductName` via `findMatchingProductId` mod `_product_rows`
   - **Kurvrettelser** (`basket_difference`): Bestem `targetProductName` fra systemets eksisterende `sale_items` (sammenlign CPO/dato)
6. Tilføj til `productMatched` og `matchedIndicesLocal`

### Fil: `src/components/cancellations/UploadCancellationsTab.tsx`
- Flyt `consolidateOppRows`-funktionen op **før** den produkt-aware blok (eller definer som separat utility), så den kan bruges begge steder
- Indsæt Pass 1c mellem linje 1435 og 1437
- Ingen andre filer ændres

### Resultat
TDC Erhverv-uploads matcher igen via OPP-nummer, med korrekt produktmapping for annulleringer og CPO-baseret matching for kurvrettelser.

