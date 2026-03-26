
Problem
- Jeg har fundet den konkrete årsag: dette forecast-team har ingen rækker i `shift` og ingen i `employee_standard_shifts`, men de har en aktiv `team_standard_shift` med mandag-fredag.
- `useClientForecast.ts` tæller lige nu kun vagter fra `shift`, så resultatet bliver nødvendigvis `0` for alle.
- Derudover har flere medarbejdere `employee_master_data.team_id = null`, så løsningen skal bruge `team_members` som sand kilde til team, ikke kun `employee_master_data`.

Plan
1. Opdatér `src/hooks/useClientForecast.ts`
   - Udvid medarbejder-fetch til også at hente `employment_start_date`.
   - Hent planlægningsdata i samme hook:
     - `shift`
     - `employee_standard_shifts`
     - `team_standard_shifts`
     - `team_standard_shift_days`
     - `absence_request_v2`
     - `booking_assignment` som FM-backup
   - Byg samme vagt-hierarki som resten af appen:
     1. Individuel vagt
     2. Booking assignment (FM)
     3. Medarbejder-standardvagt
     4. Team-standardvagt
     5. Evt. weekday-fallback hvis der ikke findes anden plan

2. Erstat nuværende `shiftCount`- og `remainingShifts`-beregning
   - `shiftCount` skal ikke være “antal rækker i shift”.
   - Det skal være antal planlagte arbejdsdage fra medarbejderens `employment_start_date` til forecast-cutoff, fratrukket godkendt fravær.
   - `remainingShifts` skal beregnes fra dagen efter cutoff til månedens slutning med samme hierarki.

3. Ret type-klassifikation
   - `isNew` skal fortsat afgøres af `new_seller_threshold`, men nu mod den rigtige historiske vagtmængde.
   - Det vil gøre at fx medarbejdere startet i februar bliver “Etableret”, mens marts-startere stadig kan være “Ny”.

4. Behold salgslogikken som den er
   - MTD/projection-salg skal ikke ændres i denne omgang.
   - Kun vagtberigelse og type skal rettes, så vi ikke risikerer at bryde de korrekte salgstal igen.

5. QA efter implementering
   - Åbn forecastet `02de9a87-6414-4f30-8d18-ee7df05197e2`.
   - Bekræft at “Vagter” ikke længere er 0 for alle.
   - Bekræft at teamet får blandede typer (“Ny” og “Etableret”).
   - Bekræft at “Rest. vagter” også bliver > 0 for medarbejdere med planlagte dage resten af måneden.

Tekniske detaljer
- Berørt fil: `src/hooks/useClientForecast.ts`
- Vigtig designregel: brug `team_members.team_id` som team-kilde, fordi flere i teamet mangler `employee_master_data.team_id`.
- Live-data jeg fandt:
  - `shift` for teamet: 0 rækker
  - `employee_standard_shifts` for teamet: 0 rækker
  - `team_standard_shifts`: aktiv dagsvagt man-fre
- Derfor er den nuværende kode logisk korrekt ift. sin query, men funktionelt forkert ift. jeres planlægningsmodel.
