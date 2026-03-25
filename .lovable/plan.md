
Ja — den nuværende logik kan godt forklare, hvorfor tallet kun faldt fra 1063 til 1011, men nej: det gør ikke tallet troværdigt.

## Min vurdering
Det lille fald er konsistent med den nuværende kode, men den absolutte størrelse på 1011 ser for høj ud i forhold til de Eesy TM-tal, du selv nævner.

## Hvad jeg fandt i koden
1. Der ligger 2 Eesy TM-opstartshold i data:
   - 7 personer med start **2026-03-31**
   - 8 personer med start **2026-04-14**

2. Cohort-beregningen bruger ikke uge-for-uge logik. I `src/lib/calculations/forecast.ts` beregnes et hold sådan her:
   - én samlet `weeksInPeriod`
   - én samlet `rampFactor`
   - én samlet `survivalFactor`
   - derefter:  
     `effectiveHeads × weeklyHours × weeks × attendance × baselineSph × ramp`

3. Ramp og survival vælges ud fra **midpoint** i perioden:
   - Holdet fra **31/3** lander cirka på **dag 14** i april og får derfor **95% ramp** for stort set hele april
   - Holdet fra **14/4** lander cirka på **dag 8** i april og får også **95% ramp** for hele sin april-periode

Det er den største røde lampe: holdet der starter 14/4 får i praksis uge-2 ramp på næsten hele april, selvom en stor del af perioden burde ligge i uge 1 med **65%**.

## Hvorfor faldet kun blev 52 salg
Det skyldes survival-logikken, ikke at tallet er “rigtigt”.

Den nye survival-profil er meget hårdere ved dag 30 og 60:
- gammel: 92 / 84 / 74 / 66
- ny: 91 / 79 / 55 / 30

Men april-holdene bliver i den nuværende model kun evalueret omkring:
- **dag 14** for holdet fra 31/3
- **dag 8** for holdet fra 14/4

Så modellen mærker mest:
- ca. **84% → 79%**
- ca. **91% → 88%**

Det er kun nogle få procentpoint, så et fald fra **1063 → 1011** er faktisk helt forventeligt under den nuværende midpoint-logik.

## Hvorfor 1011 stadig ser forkert ud
Der er to sandsynlige årsager:

### A. Ramp-up beregnes for aggressivt
Begge hold får reelt **95% ramp** på næsten hele deres aktive april-periode. Det er for højt, især for holdet der starter 14/4.

### B. Baseline-SPh for nye hold er sandsynligvis for høj
I `src/hooks/useClientForecast.ts` hentes cohort-baseline som et simpelt gennemsnit af etablerede sælgeres SPH. Det er ikke bundet til den empiriske “41 pr. måned”-logik, du refererer til. Hvis den baseline er oppustet, bliver cohort-forecastet eksplosivt.

## Konklusion
Mit kvalificerede svar er derfor:

- **Ja**, jeg kan se præcis hvorfor survival-ændringen kun flyttede tallet lidt.
- **Nej**, jeg synes ikke 1011 virker plausibelt ud fra Eesy TM-ramp-dataene.
- Den vigtigste forklaring er, at cohort-modellen lige nu bruger **én midpoint-ramp og én midpoint-survival for hele perioden**, i stedet for at regne **uge for uge / dag for dag**.
- Derfor bliver især holdet fra **14/4** overvurderet.

## Plan for at gøre det korrekt
1. Omskriv cohort-beregningen til en **tidsopdelt simulering** fra startdato til periodeslut:
   - beregn pr. dag eller pr. uge
   - brug korrekt ramp for hvert interval
   - brug korrekt survival for hvert interval

2. Erstat den nuværende midpoint-logik i `forecastCohort()` med summering af:
   - aktive headcount over tid
   - timer over tid
   - ramp over tid

3. Auditér baseline for Eesy TM:
   - verificér om cohort-baseline skal være
     - vægtet SPH for etablerede Eesy TM-sælgere, eller
     - en særskilt Eesy TM steady-state baseline afledt af de faktiske uge 3+ / uge 4-tal

4. Tilføj et debug-breakdown i forecast-UI for hvert opstartshold:
   - headcount
   - aktive dage
   - vægtet ramp
   - vægtet survival
   - baseline SPH
   - forecast per hold

5. Backfill de eksisterende Eesy TM-cohorts med korrekt `client_campaign_id`, så profilvalget er eksplicit og ikke kun afhænger af fallback.

Hvis vi implementerer det, forventer jeg, at cohort-tallet falder markant og kommer langt tættere på din intuition end de nuværende 1011.
