

## Problem

Market bookings mangler slettefunktionalitet på tre niveauer, som regulære bookinger (fx Yousee) allerede har:

1. **Hele ugen/bookingen** — Markeder i "Bookinger"-fanen har ingen slet-knap (linje 944-955 mangler Trash2-ikon)
2. **Enkelt dag** — Ingen X-knap på dag-celler for at fjerne en dag fra markedsbookingen
3. **Enkelt medarbejder** — Ingen X-knap på medarbejdernavne for at fjerne en tildeling

Regulære bookinger har allerede alt dette (linje 764-771 for booking-slet, 795-815 for dag-slet, 837-855 for medarbejder-slet).

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `BookingsContent.tsx` (linje 930-1037) | Tilføj alle 3 slet-niveauer til "Markeder denne uge" sektionen |
| `MarketsContent.tsx` | Tilføj dag-slet og medarbejder-slet mutations + UI til marked-kort |

## Ændringer

### 1. BookingsContent.tsx — "Markeder denne uge" sektion

- **Booking-slet**: Tilføj Trash2-knap i header (linje ~944-955), der kalder eksisterende `setDeleteBookingId`. Tilføj også invalidering af `vagt-market-bookings-week` i `deleteBookingMutation.onSuccess`.
- **Dag-slet**: Tilføj `group/day` class + X-knap på booked dag-celler (kopier mønster fra linje 795-815), der kalder eksisterende `setDeleteDayData`. Tilføj invalidering af `vagt-market-bookings-week` i `removeDayMutation.onSuccess`.
- **Medarbejder-slet**: Tilføj `group` class + X-knap på medarbejdernavne (kopier mønster fra linje 837-855), der kalder eksisterende `setDeleteAssignmentData`. Tilføj invalidering af `vagt-market-bookings-week` i `deleteAssignmentMutation.onSuccess`.

Alle mutations og confirmation dialogs eksisterer allerede — de skal bare genbruge dem + tilføje ekstra query invalidering.

### 2. MarketsContent.tsx — Markeder-fanen

- Tilføj state for `deleteAssignmentData` og `deleteDayData` (samme typer som BookingsContent)
- Tilføj `deleteAssignmentMutation` og `removeDayMutation` (kopier fra BookingsContent, invalidér `vagt-market-bookings`)
- I booking-kortene (linje 384-462): Ændr fra simpel employee badge-liste til dag-grid med X-knapper på dage og medarbejdere
- Tilføj AlertDialogs for dag-slet og medarbejder-slet bekræftelse

