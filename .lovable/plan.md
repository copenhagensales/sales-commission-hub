

# Fix: Rul FM booking-only logik tilbage — brug vagtplan-hierarkiet korrekt

## Problemet
Brugeren forklarer at "ikke booket" på vagtplanen = medarbejderen HAR en vagt (fra employee/team standard), men er bare ikke tildelt en lokation endnu. Kun tomme celler (som Sandras "-") = ingen vagt.

Den nuværende `isFm`-logik springer employee standard og team standard over for FM-medarbejdere, hvilket er forkert. Melissa har vagter man-fre fra team standard — hun har bare ikke fået lokationer endnu.

## Korrekt logik
- **Sandra** (special shift med 0 dage): 0 vagter ✓ (allerede håndteret korrekt)
- **Melissa** (ingen special shift, team standard = man-fre): 22 vagter ✓
- **Alle FM-medarbejdere**: Brug det normale hierarki (individuel → booking → employee standard → team standard)

## Ændring i `src/hooks/useClientForecast.ts`

### 1. Fjern `isFm`-parameter fra `countShifts` (linje 330-374)
Fjern `isFm` parameteren og `!isFm` checket. Behold den eksisterende special-shift logik (som allerede håndterer Sandra korrekt).

### 2. Fjern `isFm`-logik fra `getNormalWeeklyShifts` (linje 378-420)
Fjern `isFm` parameteren og FM-booking-gennemsnit blokken. Behold special-shift og team standard logik.

### 3. Fjern `isFmEmployee` fra forecast-loopet (linje ~486-500)
Fjern FM-team detection og stop med at sende `isFm` til funktionerne.

## Resultat
- Melissa: team standard (man-fre) → 22 vagter → ~255 salg forecast ✓
- Sandra: special shift (0 dage) → 0 vagter → 0 forecast ✓  
- Alle andre FM uden special shift: team standard → korrekte vagter ✓

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Fjern isFm parameter og logik fra countShifts, getNormalWeeklyShifts, og forecast-loop |

