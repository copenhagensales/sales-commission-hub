

## Tilføj tidsperiode-kolonner til leverandørtype-oversigten

### Hvad ændres
Fjern "DB" kolonnen fra vendor type summary-tabellen. Erstat med **DB/dag opdelt i tidsperioder**: "Sidste 30 dage", "Sidste 3 mdr", "Sidste 6 mdr" og "All time" — så man kan se om lokationstyper performer bedre eller dårligere over tid.

### Fil: `src/pages/vagt-flow/LocationHistoryContent.tsx`

1. **Ny helper-funktion** `computeVendorSummaryForPeriod(locationData, bookings, periodStart)`:
   - Filtrerer hver lokations `weeklyBreakdown` til uger der falder inden for perioden (baseret på `week`/`year` → dato-konvertering)
   - Grupperer pr. `locationType` og beregner DB/dag for den filtrerede del

2. **Opdater `vendorTypeSummary`**: Beregn fire separate DB/dag-værdier pr. type:
   - `dbPerDay30` (sidste 30 dage)
   - `dbPerDay90` (sidste 3 mdr)
   - `dbPerDay180` (sidste 6 mdr)  
   - `dbPerDayAll` (all time / hele den valgte periode)

3. **Opdater tabel-UI**: Erstat "DB" kolonnen med fire periodekolonner:

| Type | Lokationer | Dage | Salg/dag | 30 dage | 3 mdr | 6 mdr | All time |

   - Hver periodekolonne viser DB/dag i kr med grøn/rød farve
   - Tilføj trend-indikator (↑/↓) hvis 30-dages DB/dag er bedre/dårligere end all time
   - Vis "–" hvis ingen data i perioden

4. **Periodefiltrering**: Brug booking `start_date`/`end_date` til at afgøre om en booking falder inden for en given tidsperiode, og beregn dage/DB proportionelt

### Sortering
Tabellen sorteres stadig efter all-time DB/dag (faldende).

