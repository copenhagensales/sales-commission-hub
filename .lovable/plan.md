

# Plan: Vis kun starttidspunkt i tidsslots

## Opsummering
Fjern sluttidspunktet fra tidsslot-visningen, så der fx står "11:30" i stedet for "11:30 – 11:45".

## Ændringer

### 1. `src/pages/recruitment/PublicCandidateBooking.tsx`
- **Linje 314**: Ændr `{slot.start} – {slot.end}` → `{slot.start}`

### 2. `src/components/recruitment/CalendarBookingModal.tsx`
- **Linje 283**: Ændr `kl. {selectedSlot.startTime}–{selectedSlot.endTime}` → `kl. {selectedSlot.startTime}`
- Andre steder i filen der viser `startTime–endTime` tilsvarende

## Filer der ændres
- `src/pages/recruitment/PublicCandidateBooking.tsx`
- `src/components/recruitment/CalendarBookingModal.tsx`

