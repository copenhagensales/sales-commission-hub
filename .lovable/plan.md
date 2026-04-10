

## Fix: Oplæringsbonus vises fejlagtigt som "Diæt"-tag

### Problem
`booking_diet`-tabellen bruges til **både** diæter og oplæringsbonusser (differentieret via `salary_type_id`). Men queryen i booking-oversigten henter alle rækker uden filter — så oplæringsbonusser vises som orange "Diæt"-tags.

### Løsning

**Fil: `src/pages/vagt-flow/BookingsContent.tsx`**

1. **Filtrer diet-query** (linje ~302): Tilføj `.eq("salary_type_id", dietSalaryType.id)` så kun ægte diæter hentes. Gør queryen afhængig af at `dietSalaryType` er loaded.

2. **Tilføj separat query for oplæringsbonus**: Hent `booking_diet`-rækker filtreret på `salary_type_id = trainingBonusSalaryType.id` (kræver at training salary type også fetches — den hentes muligvis allerede i EditBookingDialog men ikke i BookingsContent).

3. **Tilføj training salary type query** i BookingsContent (ligesom diet salary type allerede hentes på linje 313-326).

4. **Byg separat lookup-map** for oplæringsbonusser (`trainingByBookingDate`).

5. **Render separat tag** for oplæringsbonus — indigo/lilla badge med `GraduationCap`-ikon og teksten "Oplæring" i stedet for orange "Diæt", på begge steder hvor diet-tagget renderes (linje ~1234 og ~1521).

### Resultat
- Diæt-tags vises kun for ægte diæter (orange, gaffel-ikon)
- Oplæringsbonusser vises med eget tag (indigo, graduation-ikon)
- Ingen data ændres — kun visningslogik

