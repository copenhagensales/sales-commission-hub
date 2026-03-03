

## Analyse: Hvorfor steg oversigts-totalen til 280k?

**Årsag:** Begge tabs bruger nu den korrekte ISO-konvertering, men effekten er modsat for de to beregningstyper:

### Oversigten (steg)
For bookinger **uden** `total_price` (de fleste Coop-lokationer) beregnes beløbet som `dagspris × dage`. Før rettelsen blev fredage sprunget over, så der blev talt færre dage → lavere beløb. Nu tælles fredage korrekt med → flere dage → højere beløb. **Det nye tal (280k) er det korrekte.**

Eksempel fra skærmbilledet: Herning Centeret viser nu 15 dage × 1.200 kr = 18.000 kr. Før rettelsen var det måske 12-13 dage × 1.200 kr.

### Leverandørrapporten (faldt)
Leverandørrapporten har rabatlogik baseret på `min_days_per_location`. Når dagantallet stiger, kan flere lokationer nu opfylde minimumskravet → flere "placeringer" tælles → større rabat → lavere nettopris. Det er også korrekt.

### Konklusion
Der er **ingen fejl** — begge tal er nu mere præcise end før. Oversigten viser brutto (dagspris × korrekte dage), og leverandørrapporten anvender rabatter korrekt baseret på de opdaterede dagantal.

Ingen kodeændringer nødvendige.

