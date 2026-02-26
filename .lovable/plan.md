

## Fix: Fraværsadvarsel vises for hele ugen i stedet for kun valgte dage

### Problem
Når Julie har fravær mandag og tirsdag, men bookingen kun er på fredag, vises fraværsadvarslen (grøn boks + "vacation, day_off") alligevel. Det er fordi koden tjekker om medarbejderen har **nogen som helst** fravær i ugen - ikke om fraværet overlapper med de **valgte dage**.

Interessant nok gør dropdown-listen det korrekt allerede (linje 1296-1298) - den tjekker kun de valgte booking-dage. Men den ydre visning (linje 1270-1274) bruger en bredere check.

### Løsning
Ændre linje 1270-1274 i `EditBookingDialog.tsx` til kun at markere medarbejderen hvis fraværet overlapper med de faktisk valgte dage (`booked_days`).

### Ændring i `src/components/vagt-flow/EditBookingDialog.tsx`

**Linje 1270-1274**: Erstat den brede `absencesByEmployeeAndDay.has(emp)` check med en dag-specifik check der bruger `booking?.booked_days`:

- `hasAbsence` skal tjekke om medarbejderens fravær overlapper med `booked_days`
- `absenceTypes` skal kun vise fraværstyper for de overlappende dage, ikke alle ugens fravær

Det er en ~6-linjers ændring der sikrer at advarslen kun vises når fraværet faktisk konflikter med de valgte booking-dage.

