## Mål
Du styrer selv hvornår en pulsmåling starter og stopper. Knappen virker altid. Systemet opretter ikke længere selv en undersøgelse d. 15. hver måned.

## Hvad jeg gør

### 1. Luk den nuværende maj-pulsmåling
Sætter `is_active = false` på maj-undersøgelsen (id `d5d0a842…`). De 12 besvarelser bevares — de er stadig synlige i resultater-visningen, men menupunktet/popup'en forsvinder for medarbejderne.

### 2. Slå auto-aktivering fra
Slår cron-jobbet `activate-pulse-survey-monthly` (kører 09:00 d. 15.) fra. Fra nu af opretter systemet ALDRIG selv en pulsmåling.

### 3. Tillad flere pulsmålinger pr. måned (migration)
Database har i dag `UNIQUE (year, month)` på `pulse_surveys`. Det skal fjernes — ellers kan du ikke starte en ny i samme måned hvis du allerede har lukket én.

### 4. Gør knappen "Aktiver ny pulsmåling" funktionel
Ny logik i `useActivatePulseSurvey` (`src/hooks/usePulseSurvey.ts`):
- Deaktiverer ALLE eksisterende aktive pulsmålinger for indeværende måned (sikkerhedsnet — der bør kun være én).
- Indsætter en ny række med `is_active = true` for nuværende `year/month`.
- Invaliderer cache så UI'et opdaterer.

`useActivePulseSurvey` ændres til `order by created_at desc limit 1` så vi altid får den nyeste aktive.

### 5. Tilføj "Luk aktiv pulsmåling"-knap i UI
I `src/pages/PulseSurveyResults.tsx` ved siden af de eksisterende knapper:
- Hvis der findes en aktiv undersøgelse for indeværende måned → vis rød "Luk aktiv pulsmåling"-knap der sætter `is_active = false`.
- "Aktiver ny pulsmåling" får tooltip/bekræftelse hvis der allerede er en aktiv (advarsel om at den nuværende lukkes).

## Hvad du efterfølgende gør
1. Tryk "Aktiver ny pulsmåling" når du vil starte en ny runde.
2. Kopiér `https://sales-sync-pay.lovable.app/survey`-linket fra siden og send det ud (Teams/mail).
3. Når du er færdig med en runde, tryk "Luk aktiv pulsmåling".

## Tekniske detaljer

**Migration:**
```sql
ALTER TABLE public.pulse_surveys DROP CONSTRAINT pulse_surveys_year_month_key;
```

**Data-ændringer (via insert-værktøj):**
```sql
UPDATE public.pulse_surveys SET is_active = false 
  WHERE id = 'd5d0a842-4409-421a-8926-9c6ef04d95c1';

SELECT cron.unschedule('activate-pulse-survey-monthly');
```

**Edge function `activate-pulse-survey`** beholdes uberørt (ingen kalder den efter cron er væk — kan ryddes op senere).

**Filer berørt:**
- `src/hooks/usePulseSurvey.ts` — ny aktiverings-logik + ny `useDeactivatePulseSurvey`-hook + opdater `useActivePulseSurvey`
- `src/pages/PulseSurveyResults.tsx` — tilføj luk-knap, opdater aktivér-knap med confirm-dialog

## Risiko
Lav. Kun pulsmålings-flowet røres. Eksisterende besvarelser og maj-undersøgelsens data slettes ikke.
