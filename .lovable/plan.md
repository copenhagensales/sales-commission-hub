

# Tilfoej "Slet dag"-knap paa hver dag i booking-oversigten

## Oversigt

Tilfoej en slet-knap paa hver booket dag i booking-griddet, saa man kan fjerne en enkelt dag fra en booking. Naar dagen fjernes, slettes ogsaa alle medarbejder-tildelinger paa den dag, og dagen fjernes fra `booked_days`-arrayet.

## Aendringer

### Fil: `src/pages/vagt-flow/BookingsContent.tsx`

**Ny state:**
- `deleteDayData` -- holder info om den dag der skal slettes (booking id, day index, dato-label, antal tildelinger)

**Ny mutation: `removeDayMutation`**
1. Slet alle `booking_assignment` poster for den paagaeldende booking + dato
2. Opdater `booking.booked_days` og fjern det paagaeldende day-index fra arrayet via Supabase update
3. Hvis `booked_days` bliver tomt efter fjernelse, slet hele bookingen
4. Invalidere queries og vis toast

**UI-aendring i dag-cellen:**
- Naar `canEditFmBookings` er true og dagen er booket (`isBooked`), vis en lille slet-ikon (Trash2 eller X) i hjoernet af dag-cellen -- synlig ved hover
- Klik aabner en bekraeftelses-dialog (AlertDialog):
  - "Fjern [Dag] d. [dato] fra denne booking?"
  - Viser antal medarbejdere der ogsaa fjernes
  - "Annuller" / "Fjern dag" knapper

**Bekraeftelses-dialog:**
- Genbruger eksisterende AlertDialog-moenster allerede i filen
- Tekst: "Vil du fjerne [Man 9/2] fra denne booking? [X] medarbejder(e) vil ogsaa blive fjernet."

## Tekniske detaljer

```text
Dag-celle (hover):
+------------------+
|  Man        [X]  |  <-- slet-knap synlig ved hover
|  9/2             |
|  Alexander       |
|  Nora            |
+------------------+
```

Mutation flow:
1. `DELETE FROM booking_assignment WHERE booking_id = ? AND date = ?`
2. `UPDATE booking SET booked_days = (fjern index) WHERE id = ?`
3. Hvis nye `booked_days` er tom: `DELETE FROM booking WHERE id = ?`
4. Invalidate `["vagt-bookings-list"]`

Ingen database-migration noedvendig -- bruger eksisterende kolonner og tabeller.

