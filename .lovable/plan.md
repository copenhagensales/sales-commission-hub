

## Plan: Vis booking-konflikter tydeligt inde på Booking-siden

### Problem
Den røde badge ved "Booking" i sidebaren viser antal medarbejdere med konflikter (tildelt bookinger på dage hvor de har godkendt fravær). Men når man åbner Booking-siden, er der ingen indikation af **hvilke** bookinger eller medarbejdere der er berørt.

### Hvad den røde badge betyder
Badgen tæller medarbejdere der er tildelt en booking (`booking_assignment`) på en dato der overlapper med en godkendt fraværsperiode (`absence_request_v2`). F.eks. hvis 1 medarbejder har godkendt ferie men stadig er tildelt en vagt.

### Ændringer

**1. Tilføj en advarselsbanner øverst på BookingManagement-siden** (`src/pages/vagt-flow/BookingManagement.tsx`)
- Hent samme konflikt-data som sidebar-badgen (booking_assignment + absence_request_v2)
- Vis en synlig advarselsboks med liste over berørte medarbejdere og datoer
- Klikbar: hver konflikt linker til den relevante booking/uge

**2. Tilføj tooltip på sidebar-badgen** (`src/components/layout/AppSidebar.tsx`)
- Wrap badgen i en Tooltip der forklarer: "X medarbejder(e) er tildelt vagter under godkendt fravær"

### Teknisk detalje

Konflikten beregnes allerede i `AppSidebar.tsx` (linje 315–361). Vi genbruger samme logik i en hook, så både sidebar og Booking-siden kan bruge den uden duplikeret kode:

- Ny hook: `src/hooks/useFmBookingConflicts.ts`
  - Returnerer `{ conflicts: Array<{ employeeId, employeeName, date, bookingId }>, count }`
  - Bruger samme query som sidebar men med flere detaljer (medarbejdernavn, booking-info)
- `AppSidebar.tsx`: Brug hooken i stedet for inline query + tilføj Tooltip
- `BookingManagement.tsx`: Brug hooken og vis advarselsbanner med detaljer

### Filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useFmBookingConflicts.ts` | Ny hook med konflikt-logik |
| `src/pages/vagt-flow/BookingManagement.tsx` | Vis advarselsbanner med konflikter |
| `src/components/layout/AppSidebar.tsx` | Brug ny hook + tilføj tooltip på badge |

