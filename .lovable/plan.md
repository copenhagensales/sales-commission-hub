

## Diagnose af "loop" problemet

### Status efter sidste fix
Den nye `submit-employee-pulse-survey` edge function virker korrekt:
- 16/4: 6 responses, 6 completions (1:1)
- 17/4: 1 response, 1 completion (1:1)
- Ingen duplikat-employees per email
- `get_current_employee_id()` RLS-funktion bruger samme logik som edge function (auth_user_id først, derefter email)

### Hvor problemet sandsynligvis stadig findes

Selvom server-siden er korrekt, kan brugere stadig opleve loopet pga. **frontend cache / state-problemer**:

1. **Cache invalidation utilstrækkelig**: Efter submission invalideres `pulse-survey-completion`, men hooks har ingen `staleTime: 0` eller `refetchOnMount`. Ved navigation kan stale "false" stadig være i cache.

2. **`useShouldShowPulseSurvey` har ingen retry**: Hvis `useHasCompletedSurvey` rammer en transient netværksfejl returnerer den `false` → popup vises.

3. **Race condition mellem submission og cache update**: `handleSubmit` viser toast og navigerer, men `useShouldShowPulseSurvey` bruges andre steder (popup, lock, badge) og refetcher måske ikke straks.

4. **`PulseSurveyPopup` viser sig på enhver side**: Hvis en bruger lige har svaret men cache ikke er opdateret når de navigerer, dukker popup'en op igen.

5. **Manuel deduplication kan fejle**: `useHasCompletedSurvey` bruger `.maybeSingle()` - hvis RLS returnerer 0 rows pga. midlertidig session-issue → returnerer false.

### Plan

**1. Server-side defensiv healing**
Tilføj en RPC `pulse_survey_has_user_completed(survey_id)` der internt bruger `get_current_employee_id()` med samme logik som RLS. Dette eliminerer email-vs-auth_user_id mismatch fuldstændigt fra frontend.

**2. Opdater alle frontend hooks til at bruge RPC'en**
Erstat email-baseret employee lookup i:
- `useHasCompletedSurvey`
- `usePulseSurveyDismissal`  
- `usePulseSurveyDraft`
- `usePulseSurveyHasDraft`
- `usePulseSurveyLock`

Alle disse hooks bruger samme problematiske `.or(private_email.ilike,work_email.ilike)` mønster. RPC'en sikrer 100% konsistens med edge function og RLS.

**3. Aggressiv cache invalidering**
Efter submission, kald `queryClient.invalidateQueries()` for ALLE pulse-survey nøgler og tilføj `await queryClient.refetchQueries(['pulse-survey-completion'])` så popup'en med det samme ved at brugeren har svaret.

**4. Tilføj `staleTime: 0` og `refetchOnWindowFocus: true` på `useHasCompletedSurvey`**
Sikrer at hver gang brugeren skifter tab eller side, refetches completion-status.

**5. Heling for de 2 manglende fra 15. april**
Kør engangs-script der finder de 2 responses uden matching completion (15/4 - før fix) og forsøger at indsætte completion baseret på den nærmeste auth-bruger (eller bare deaktiverer aktiv survey for dem manuelt).

**6. Diagnostisk logging**
Tilføj console.log i `useHasCompletedSurvey` og `useShouldShowPulseSurvey` så vi kan se i logs HVILKEN bruger der oplever det og hvad der returneres.

### Tekniske ændringer

- Ny SQL function `public.has_completed_pulse_survey(_survey_id uuid) returns boolean` (SECURITY DEFINER, bruger `get_current_employee_id()`)
- Refactor af 5 hooks i `src/hooks/usePulseSurvey.ts` + `src/hooks/usePulseSurveyLock.ts` til at bruge denne RPC
- Cache config i `useHasCompletedSurvey`: `staleTime: 0`, `refetchOnWindowFocus: true`
- I `useSubmitPulseSurvey.onSuccess`: explicit `refetchQueries` + `setQueryData` for at sætte hasCompleted=true øjeblikkeligt
- Diagnostisk logging der kan deaktiveres via flag

Dette eliminerer enhver mulighed for mismatch mellem hvilken employee der "har besvaret" på server-side vs frontend.

