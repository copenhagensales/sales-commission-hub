
Diagnose: 143 ser ud til at være et gammelt/stalet forecast-tal, ikke et tal den nuværende beregningskode burde producere.

Jeg har fundet tre konkrete ting:

1. Melissa har godkendt ferie 1.-29. marts, så marts-ugerne bør springes over i EWMA.
2. `143` matcher meget præcist det gamle mønster, hvor marts-uger blev talt som 0-SPH-uger.
3. Der er en ny, reel fejl i den nuværende kode: Melissa’s FM-salg matches både via `agent_email/work_email` og via `raw_payload.fm_seller_id`, så et friskt recalc risikerer at dobbelt-tælle hendes salg.

Plan

1. Ret salgsattribution i `src/hooks/useClientForecast.ts`
- Erstat de to parallelle spor (`salesByEmailByWeek` + `salesByEmployeeIdByWeek`) med én samlet attribution pr. `sale.id`.
- Match hierarki:
  - først `raw_payload.fm_seller_id`
  - ellers `agent_email`/`work_email`
- Hver sale må kun tælle én gang pr. medarbejder.

2. Brug samme dedup-logik for “actual sales to date”
- Den samme dobbelt-tælling kan også ramme aktuelle salg i indeværende måned.
- Flyt derfor både historisk EWMA og current-month actuals over på samme fælles match-logik.

3. Gør team-standard fallback deterministisk
- `Fieldmarketing` har flere aktive `team_standard_shifts`, inkl. en uden dage.
- Ret map-opbygningen, så vi:
  - filtrerer tomme shift-dage væk
  - merger/deduper dage pr. team
- Så forecast ikke afhænger af tilfældig rækkefølge fra databasen.

4. Tving forecast til at recompute i preview
- Tilføj en `FORECAST_LOGIC_VERSION` i query key for `useClientForecast`
  eller sæt hooket til at refetch’e ved mount.
- Så preview ikke bliver stående på gamle cachede tal som 143 efter logikændringer.

5. Verificér Melissa specifikt
- Kontrollér at marts-ferieuger ikke indgår i EWMA
- Kontrollér at april-timer beregnes korrekt
- Kontrollér at hendes jan/feb-salg kun tælles én gang
- Bekræft at hun flytter sig væk fra 143 og lander i et realistisk 200+ niveau

Tekniske detaljer
- Fil: `src/hooks/useClientForecast.ts`
- Vigtige felter:
  - `sales.id`
  - `sales.agent_email`
  - `sales.raw_payload->>fm_seller_id`
  - `booking_assignment.date`
  - `absence_request_v2`
  - `team_standard_shifts` + `team_standard_shift_days`

Forventet effekt
- 143 forsvinder, fordi preview ikke længere viser gammel cache.
- Melissa bliver ikke længere trukket ned af marts-ferieuger.
- Melissa bliver heller ikke pustet kunstigt op af dobbelt-talte FM-salg.
- Forecastet bliver stabilt og forklarligt for FM-medarbejdere generelt.
