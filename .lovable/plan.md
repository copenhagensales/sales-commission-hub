

## Fix: Tilføj bekræftelses- og redigeringsfunktion for hoteltildelinger

### Problem
Når et hotel tildeles en booking, får det status "pending" (ubekræftet). Men der er ingen mulighed for at:
1. Bekræfte en hotelbooking (sætte status til "confirmed")
2. Redigere en eksisterende tildeling (ændre værelser, bekræftelsesnummer osv.)
3. Fjerne en tildeling

"Ændr"-knappen genbruger "Tildel hotel"-dialogen, som altid opretter en NY tildeling.

### Løsning
Ombyg "Ændr"-knappen til at åbne en redigeringsdialog med de eksisterende data, inkl. en "Bekræft"-knap.

### Tekniske ændringer

**Fil: `src/pages/vagt-flow/HotelsContent.tsx`**
- Send den eksisterende `bookingHotel`-data med til dialogen når man klikker "Ændr"
- Dialogen skal vide om det er en ny tildeling eller redigering af en eksisterende

**Fil: `src/components/vagt-flow/AssignHotelDialog.tsx`**
- Tilføj en optional `existingBookingHotel` prop med de eksisterende data
- Når `existingBookingHotel` er sat:
  - Pre-udfyld alle felter (hotel, check-in/out, værelser, bekræftelsesnummer, pris, noter)
  - Vis en "Status"-dropdown med valgene: Pending / Bekræftet / Annulleret
  - Ændr submit-knappen til at kalde `useUpdateBookingHotel` i stedet for `useAssignHotel`
  - Tilføj en "Fjern tildeling"-knap (rød) der kalder `useDeleteBookingHotel`
  - Ændr dialog-titlen til "Rediger hoteltildeling"

**Fil: `src/hooks/useBookingHotels.ts`**
- Hooks `useUpdateBookingHotel` og `useDeleteBookingHotel` eksisterer allerede -- ingen ændringer nødvendige her

### UI-flow efter ændringen

1. **Ny tildeling** (knappen "Tildel hotel"): Virker som nu -- tom dialog, opretter ny tildeling med status "pending"
2. **Rediger** (knappen "Ændr"): Åbner dialogen med eksisterende data pre-udfyldt. Brugeren kan:
   - Ændre status til "Bekræftet" via dropdown
   - Tilføje/ændre bekræftelsesnummer
   - Ændre antal værelser, pris, noter
   - Fjerne tildelingen helt
3. **Hurtig bekræftelse**: Tilføj en direkte "Bekræft"-knap på kortet (ved siden af "Ændr") for pending-bookinger, så man kan bekræfte med et klik uden at åbne dialogen

### Forventet resultat
- Ubekræftet booking: Viser gul badge + "Bekræft" knap + "Ændr" knap
- Bekræftet booking: Viser grøn badge + "Ændr" knap
- Klik "Bekræft": Sætter status direkte til "confirmed" (et klik)
- Klik "Ændr": Åbner dialog med alle felter pre-udfyldt og status-dropdown

