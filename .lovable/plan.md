

## Plan: Placements skal tælle sammenhængende dage (i træk)

**Problem:** Nuværende logik tæller placements som `Math.floor(totalDays / 5)` — den ignorerer om dagene er sammenhængende. 4 dage i uge 5 + 1 dag i uge 6 tæller fejlagtigt som 1 placement.

**Korrekt regel:** Kun sammenhængende sekvenser af bookede dage på 5+ dage tæller. Hver sekvens på ≥5 dage = 1 placement (ikke `floor(sekvenslængde/5)`).

### Ændring i `src/components/billing/SupplierReportTab.tsx`

**Ny hjælpefunktion** `countConsecutivePlacements(bookings, minDays)`:
1. Samler alle faktiske bookede kalenderdatoer for en lokation (fra alle bookings).
2. Sorterer dem kronologisk.
3. Finder sammenhængende sekvenser (dag-for-dag uden huller).
4. Tæller antal sekvenser med længde ≥ `minDaysPerLocation`.

**Erstat linje 289-291** — brug den nye funktion i stedet for `Math.floor(loc.totalDays / minDaysPerLocation)`.

### Opdater tekst/labels

Opdater "1 placering = min. X dage på samme lokation" til "1 placering = min. X sammenhængende dage på samme lokation" (linje ~722 og i PDF-generatoren + email-funktionen).

### Berørte filer

| Fil | Ændring |
|-----|---------|
| `SupplierReportTab.tsx` | Ny consecutive-counting funktion + opdater label |
| `supplierReportPdfGenerator.ts` | Opdater placement-tekst |
| `send-supplier-report/index.ts` | Opdater placement-tekst |

