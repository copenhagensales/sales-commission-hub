

## Plan: Tydeliggør booking-tælling under rabatberegning

**Problem:** Under "Rabatberegning" vises kun "Bookinger: 27" (totalPlacements), men det er uklart hvordan tallet fremkommer — man kan ikke se forskellen mellem det samlede antal bookinger og de der kvalificerer til rabat.

**Ændring i `src/components/billing/SupplierReportTab.tsx`:**

I placement-based discount sektionen (linje 651-655), udvid "Bookinger"-feltet til at vise begge tal:

1. Beregn det samlede antal booking-records: `locationEntries.reduce((sum, loc) => sum + loc.bookings.length, 0)`
2. Vis under rabatberegning:
   - **Samlede bookinger:** fx 34 (antal booking-records i alt)
   - **Bookinger (min. 5 dage):** 27 (det tal der bruges til rabattrin)
   - En lille forklaringstekst: "Hver 5 dage på en lokation tæller som 1 booking"

Konkret ændres det første grid-felt fra bare at vise `totalPlacements` til at vise begge tal med labels, så det er tydeligt hvordan rabatten beregnes.

