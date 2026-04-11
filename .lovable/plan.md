

## Kompakt kalender: Kun de næste 7 dage

### Idé

Erstat den fulde månedskalender med en simpel liste/row af de næste 5–7 dage (kun dage med ledige slots). Ingen månedsskift-pile, ingen tom padding — bare de relevante dage.

### Ændringer

**`src/pages/recruitment/PublicCandidateBooking.tsx`**
- Fjern `currentMonth`, `subMonths`, `addMonths`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`, `startPadding` og al månedskalender-logik
- Erstat med en simpel horisontal row af `availability.days` (filtreret til kun dage med slots)
- Vis maks 7 dage som klikbare kort/knapper: ugedag + dato (fx "Man 14. apr")
- Fjern ChevronLeft/ChevronRight navigation
- Layout: i stedet for 2-kolonne grid, vis dage øverst og slots nedenunder i ét flow

**`src/components/recruitment/BookingPreviewTab.tsx`**
- Samme ændring — erstat månedskalenderen med den kompakte dag-row
- Hold preview synkroniseret med den offentlige side

### Resultat

Kandidaten ser kun de relevante dage (maks 1 uge frem) som store, tydelige knapper — ingen forvirring med tomme måneder eller navigationsknapper.

