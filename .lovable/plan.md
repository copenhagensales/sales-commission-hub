
# Påmindelser om stande/roll-ups på vagtplanen

## Hvad
Vis en diskret, men tydelig påmindelse til medarbejdere om at medbringe stande og roll-ups den første dag de er booket på en lokation, og at tage dem med hjem på den sidste dag.

## Hvor
`src/pages/vagt-flow/MyBookingSchedule.tsx` — medarbejdernes vagtplan.

## Logik
I `dayData`-opbygningen (useMemo) beregnes for hvert assignment om det er den **første** eller **sidste** dag for den pågældende booking (ikke kun for ugen, men baseret på alle assignments medarbejderen har for det booking_id):

- **Første dag for bookingen:** Vis en grøn callout: "Husk stande og roll-ups"
- **Sidste dag for bookingen:** Vis en orange callout: "Husk at tage stande og roll-ups med hjem"

Da vi allerede fetcher assignments pr. uge, udviddes queryen til også at hente alle datoer for hvert booking_id (for at finde den absolutte første/sidste dag, også på tværs af uger). Alternativt kan vi bruge booking-objektets `start_date`/`end_date` — men da assignments allerede er fetched, bruges en ekstra query for alle datoer pr. booking.

## UI-design
Kompakt callout i samme stil som hotel- og note-callouts:
- **Første dag:** Grøn baggrund, ikon (PackageOpen/ArrowUp), kort tekst
- **Sidste dag:** Orange baggrund, ikon (PackageMinus/ArrowDown), kort tekst
- Placeres lige under badges-rækken (bil/diæt/hotel), før hotel-detaljen
- Tager minimal plads og skiller sig ud uden at forstyrre

## Tekniske ændringer

### `src/pages/vagt-flow/MyBookingSchedule.tsx`
1. **Ny query** — hent alle assignment-datoer for de aktuelle booking_ids (ikke begrænset til ugen) for at bestemme absolut første/sidste dag:
   ```
   SELECT booking_id, date FROM booking_assignment
   WHERE employee_id = :employeeId AND booking_id IN (:bookingIds)
   ORDER BY booking_id, date
   ```

2. **I useMemo (dayData)** — tilføj `isFirstBookingDay` og `isLastBookingDay` pr. assignment ved at sammenligne med alle datoer for det booking.

3. **I renderingen** — tilføj to kompakte callouts efter badges-rækken:
   - Grøn callout for første dag med `Package`-ikon og teksten "Husk at medbringe stande og roll-ups"
   - Orange callout for sidste dag med `Package`-ikon og teksten "Husk at tage stande og roll-ups med hjem"
