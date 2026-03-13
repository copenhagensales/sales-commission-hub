

## Problem

Hillerød Kræmmermarked-bookingen for uge 11 **er** draft i databasen, men markedssektionen i Bookinger-tabben viser **hverken** et "Kladde"-badge eller en "Bekræft"-knap. Det er kun de almindelige bookinger der har draft-visning og bekræftelse — markeder er blevet glemt.

Det betyder at:
- August kan ikke se sine weekendvagter (fordi `MyBookingSchedule` kun viser confirmed)
- Manageren kan ikke se at bookingen mangler bekræftelse
- Der er ingen knap til at bekræfte den

## Plan

### 1. Tilføj draft-badge og bekræft-knap til markedsbookinger

**Fil**: `src/pages/vagt-flow/BookingsContent.tsx`

- Tilføj "Kladde"-badge ved hver markedsbooking der har `status === 'draft'` (samme gule badge som regulære bookinger)
- Tilføj en per-booking "Bekræft"-knap for draft-markeder
- Inkluder market drafts i `draftCount` og `confirmWeekMutation` så "Bekræft uge"-knappen også bekræfter markeder

### Ændringer i detaljer:

1. **`draftCount`** (linje ~788): Tilføj market drafts til optællingen
2. **`confirmWeekMutation`** (linje ~752-769): Inkluder market draft IDs i batch-bekræftelsen  
3. **Market booking rendering** (linje ~1248-1282): Tilføj "Kladde" badge + "Bekræft" knap (samme mønster som regulære bookinger i linje ~982-986)

### Resultat
- Manageren kan se at markeds-bookingen er en kladde
- "Bekræft uge"-knappen inkluderer nu også markeder
- Når den bekræftes, vil August kunne se sine weekendvagter

