
Mest sandsynlige årsag er, at der er to fejl samtidig i forecast-hooken:

1. Stoppede medarbejdere bliver stadig ikke hentet rigtigt  
   I `src/hooks/useClientForecast.ts` hentes inaktive medarbejdere med `id in employeeIds`, hvor `employeeIds` kommer fra `team_members`. Når en medarbejder er fjernet fra `team_members`, returnerer den query tomt resultat. Det passer med netværksloggen, hvor den inaktive query gav `[]`, selv om der findes stoppede Eesy TM-medarbejdere med marts-salg.

2. “Actual sales to date” tæller ikke alle sale items  
   I current-period logikken deduplikeres der på `saleId`, mens der itereres over `sale_items`. Derfor tælles kun første linje pr. sale med, i stedet for summen af alle `quantity` for linjer med `counts_as_sale = true`. Det forklarer, hvorfor UI ligger omkring 603 i stedet for den fulde item-mængde.

Plan for rettelsen:

1. Ret datakilden for stoppede medarbejdere
   - I `src/hooks/useClientForecast.ts`
   - Hent inaktive medarbejdere via `employee_master_data.team_id in teamIds` + `employment_end_date >= forecastStartStr`
   - Ikke via `team_members`
   - Hent også deres agent-mappings, så vi ikke kun er afhængige af `work_email`

2. Ret actual-sales optællingen til item-niveau
   - Skift deduplikering i sektion 8 fra `saleId` til `sale_item`-niveau
   - Brug `sale_items.id` hvis muligt, ellers fallback til `saleId:itemIndex`
   - Summér `quantity` for alle linjer, der tæller som salg
   - Behold FM-pass først og email-pass bagefter, men dedup korrekt på item-niveau på tværs af begge passes

3. Behold forecast for fremtiden aktiv-only
   - Kun “actual sales to date” skal udvides
   - Remaining forecast, timer, churn og kapacitet skal stadig kun bygges på aktive medarbejdere

4. Gør UI totals konsistente
   - Når tidligere medarbejdere tæller med i `actualSalesToDate`, vil summary/KPI-toppen ellers kunne afvige fra breakdown-tabellen
   - Tilføj en lille reconciliation-linje eller metadata for “salg fra stoppede medarbejdere”, så totalerne giver mening uden at vise dem som aktive sælgere

5. Tving ny beregning i klienten
   - Bump `FORECAST_LOGIC_VERSION`, så eksisterende cache ikke skjuler rettelsen

Tekniske detaljer
- Primær fil: `src/hooks/useClientForecast.ts`
- Sandsynlige følgefiler hvis totaler skal vises konsistent:
  - `src/types/forecast.ts`
  - `src/components/forecast/ForecastBreakdownTable.tsx`
  - evt. `src/components/forecast/ForecastSummary.tsx` hvis vi vil vise en note om tidligere medarbejdere

Forventet effekt efter fix
- Topkortet skal ikke længere stå fast på ~860, hvis actuals alene allerede er højere
- “Der er allerede lavet X salg” skal matche den autoritative sale-item optælling
- Stoppede medarbejdere med marts-salg for Eesy TM skal tælle med i actuals, selv om de ikke længere findes i `team_members`
