

# Ret forecast: Inkluder salg fra stoppede medarbejdere i "faktisk salg til dato"

## Problem
Forecastets "faktisk salg til dato" tæller kun salg fra **aktive** medarbejdere (`is_active = true`). Medarbejdere der er stoppet i løbet af perioden har stadig lavet salg, men de tælles ikke med. Det forklarer forskellen mellem de viste 601 salg og det reelle tal.

## Løsning
I den del af `useClientForecast.ts` der henter **faktiske salg til dato** (sektion 8, linje ~858-930), skal vi udvide salgs-attribueringen til også at inkludere inaktive medarbejdere. Forecasting af fremtidige salg skal stadig kun bruge aktive medarbejdere.

## Ændringer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Hent også inaktive medarbejderes emails til brug i actual-sales-sektionen |

## Detaljer

1. **Hent alle (også inaktive) medarbejderes agent-emails** ved at lave en separat query for inaktive medarbejdere der har `employment_end_date` inden for forecast-perioden (dvs. stoppet i denne måned eller senere end periodens start).

2. **Udvid actual-sales logikken** (linje 858-930):
   - FM Pass 1 (linje 879): Fjern `activeIds.includes(sellerId)` checket — tæl salget med uanset om sellerId er aktiv, men tilskriv det til en "stopped employees" bucket i stedet.
   - Email Pass 2 (linje 915): Udvid email-listen til også at inkludere emails fra stoppede medarbejdere.
   - Salg fra stoppede medarbejdere tælles med i `actualSalesToDate` totalen, men **ikke** i de individuelle forecast-beregninger for fremtiden.

3. **Konkret implementation**:
   - Tilføj en query for inaktive medarbejdere med `employment_end_date >= forecastStartStr`
   - Byg et `allEmployeeEmailMap` der inkluderer både aktive og stoppede
   - Byg et `allEmployeeIds` set der inkluderer begge grupper
   - Brug `allEmployeeIds` og `allEmployeeEmailMap` i actual-sales sektionen
   - Bevar `activeIds` og `employees` til forecast-beregninger

