

# Plan: Gør det tydeligere at i dag er den anbefalede bookingdag

## Opsummering
Forstærk den visuelle prioritering af "i dag" på den offentlige bookingside, så kandidaten intuitivt vælger den tidligste dato.

## Ændringer i `src/pages/recruitment/PublicCandidateBooking.tsx`

1. **Auto-vælg i dag**: Sæt `selectedDate` til den første tilgængelige dag automatisk, så tidsslots allerede vises ved load
2. **Urgency-banner over dagene**: Tilføj en lille besked som "Jo hurtigere du booker, jo hurtigere kommer du i gang 🚀" over dag-vælgeren
3. **Forstørret "i dag"-knap**: Gør den første dag visuelt større/mere fremtrædende med en pulserende ring eller tykkere border + grøn baggrund som default
4. **"Anbefalet"-badge → "I dag ✓"**: Ændr badge-teksten til "I dag" når datoen faktisk er i dag, og behold "Anbefalet" for andre dage
5. **Subtil opacity på senere dage**: Giv dag 3+ en lavere opacity (0.7) så de fremstår som sekundære valg

## Fil der ændres
- `src/pages/recruitment/PublicCandidateBooking.tsx`

