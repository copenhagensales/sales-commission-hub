

# Fix: Weekend-booking for Fieldmarketing medarbejdere

## Problem
Medarbejdere med individuelle vagter i weekenden kan ikke bookes fordi UI'en fejlagtigt viser dem som "Booket" selvom de kun er booket på hverdage.

## Årsag
`hasNoShiftsAtAll()` og medarbejder-dropdown logikken tjekker om medarbejderen har NOGEN bookinger i ugen, og markerer dem som "(Booket)" generelt - uden at skelne mellem hvilke specifikke dage de er booket.

## Løsning

### 1. Opdater medarbejder-dropdown visning
I `EditBookingDialog.tsx` (ca. linje 1192-1226), ændr logikken for "(Booket)" label så den kun vises hvis medarbejderen er booket på de specifikke dage der er valgt i `booked_days`:

```typescript
// Tjek kun om medarbejder er booket på de bookede dage (5=lør, 6=søn)
const bookedDays = booking?.booked_days || [];
const empHasBookingOnBookedDays = bookedDays.some(dayIndex => 
  empBookings?.has(dayIndex)
);
```

### 2. Opdater dag-validering
Sørg for at "Ingen vagt" advarslen kun vises når `hasShiftOnDay()` returnerer false, og at individuelle vagter i `shift` tabellen korrekt genkendes (dette ser ud til at virke baseret på netværksdata).

### 3. Fjern forkert "Allerede booket" advarsel
`employeesAlreadyBooked` beregningen skal også kun tjekke de faktisk valgte dage, ikke alle dage i ugen.

## Filer der skal ændres
- `src/components/vagt-flow/EditBookingDialog.tsx`

## Forventet resultat
- Marco, Lucas og Frederik kan bookes til lørdag/søndag
- "(Booket)" status vises kun for medarbejdere der faktisk er booket på de valgte dage
- Knappen viser "Tilføj 2 vagter" i stedet for "Tilføj 0 vagter"

