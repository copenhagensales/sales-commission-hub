

# Ny fane: Oplæringsbonus i EditBookingDialog

## Hvad
Tilføj en ny "Oplæringsbonus" fane i booking-dialogen der fungerer identisk med Diæt-fanen, men bruger lønarten "oplæringsbonus" fra `salary_types`.

## Database
**Opdater unique constraint** på `booking_diet` tabellen til at inkludere `salary_type_id`:
- Drop eksisterende constraint `booking_diet_booking_id_employee_id_date_key`
- Opret ny: `UNIQUE(booking_id, employee_id, date, salary_type_id)`

Dette tillader at en medarbejder kan have både diæt OG oplæringsbonus på samme dag/booking.

## Ændringer i `EditBookingDialog.tsx`

1. **Ny salary type query**: Hent "oplæringsbonus" fra `salary_types` (`.ilike("name", "%oplæringsbonus%")`)
2. **Ny assignments query**: Hent fra `booking_diet` filtreret på `salary_type_id` = oplæringsbonus-typen
3. **Ny state**: `selectedTrainingEmployee`, `selectedTrainingDays` (Set)
4. **Ny mutation**: `addTrainingBonusMutation` og `removeTrainingBonusMutation` — identisk med diet men med oplæringsbonus salary_type_id
5. **Ny TabsTrigger**: "Oplæring" med `GraduationCap` ikon
6. **Ny TabsContent**: Kopi af diet-fanen med grøn/indigo farvetema i stedet for orange
7. **Opdater TabsList**: `grid-cols-6` (fra 5)
8. **Opdater diet queries**: Filtrér eksisterende diet-queries til kun at hente rækker med diæt salary_type_id (så de to ikke blandes)
9. **Opdater upsert onConflict**: Tilføj `salary_type_id` til conflict-nøglen: `"booking_id,employee_id,date,salary_type_id"`

## Filer
- **Migration**: Opdater unique constraint på `booking_diet`
- **`src/components/vagt-flow/EditBookingDialog.tsx`**: Tilføj fane + logik

