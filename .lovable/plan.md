

## Tilføj "Anbefalet"-badge på første ledige dag

Tilføj et lille "Anbefalet"-badge på den første dag i listen for at nudge kandidaten til at booke hurtigst muligt.

### Ændringer

**`src/pages/recruitment/PublicCandidateBooking.tsx`**
- I dag-knap-loopet: hvis `index === 0`, vis en lille grøn badge med teksten "Anbefalet" over eller under ugedagen

**`src/components/recruitment/BookingPreviewTab.tsx`**
- Samme ændring så preview matcher den offentlige side

