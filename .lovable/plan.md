

## Tilføj medarbejder og bil direkte på en dag

### Idé
På bookede dage i griddet vises to hover-knapper ved siden af den eksisterende "X"-knap:
- **Bruger-ikon (+)**: Åbner en lille popover med medarbejderliste — vælg en og de tilføjes direkte på den dag
- **Bil-ikon (+)**: Åbner en lille popover med billiste — vælg en og den tilføjes direkte på den dag

Dette gør det muligt at tilføje en enkelt medarbejder eller bil på én specifik dag uden at åbne EditBookingDialog.

### Ændringer i `BookingsContent.tsx`

1. **To nye inline popovers per booked day cell** — placeres i bunden af cellen (under eksisterende indhold):
   - `UserPlus` ikon → Popover med Select af tilgængelige medarbejdere (fra eksisterende `employees`-query). Ved valg køres `bulkAssignMutation` med én dato.
   - `Car` ikon (med +) → Popover med Select af tilgængelige biler (fra eksisterende `vehicles`-query). Ved valg insertes i `booking_vehicle`.

2. **Knapperne vises kun** når `canEditFmBookings && isBooked` — samme mønster som "X" knappen, med `opacity-0 group-hover/day:opacity-100`.

3. **Layout**: Knapperne placeres i bunden af dag-cellen som små ikoner, fx:
   ```
   ┌─────────┐
   │  Man  X  │
   │  13/3    │
   │  Anders  │
   │  🚗 Bil1 │
   │ [+👤][+🚗]│  ← hover-only
   └─────────┘
   ```

4. **Mutation for enkelt medarbejder**: Genbruger eksisterende `bulkAssignMutation` med én assignment og booking's start/end times.

5. **Mutation for enkelt bil**: Genbruger den eksisterende inline insert-logik fra `onAddVehicleAssignment`.

6. **Filtrering**: Medarbejdere der allerede er tildelt den dag filtreres fra. Biler der allerede er tildelt den dag filtreres fra.

7. **Anvendes i begge grids** (regular bookings + market bookings).

### Omfang
- Kun `BookingsContent.tsx`
- Ingen nye filer, komponenter eller database-ændringer
- Importér `UserPlus` fra lucide-react

