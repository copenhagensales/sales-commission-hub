## Symptom
Bruger trykker "Indsend svar" på bil-quiz → toast "Der opstod en fejl. Prøv igen." Ingen detalje vises. Quiz kan ikke gennemføres → bruger forbliver låst ude af systemet.

## Rod-årsager (evidens)

**1. UNIQUE-constraint blokerer retake/gen-indsendelse**
`supabase/migrations/20251206095611_…sql:8` definerer `CONSTRAINT car_quiz_unique_employee UNIQUE (employee_id)` på `car_quiz_completions`.
`src/hooks/useCarQuiz.ts:114-118` laver `.insert({ employee_id })` uden `upsert`. Anden gang (retake efter udløb, eller hvis en tidligere completion findes) fejler insert med `23505 duplicate key`. Mutation kaster → generisk toast.

**2. RLS-blokering hvis auth-email ikke matcher `employee_master_data`**
RLS på begge tabeller kræver `employee_id = get_current_employee_id()` (migration `20251206102556_…sql:22`, `20251206095611_…sql:17`). `get_current_employee_id()` matcher via `auth_user_id` eller email-lookup på `private_email`/`work_email`. Hvis nyligt oprettet bruger har en email der ikke matcher 1:1 (fx kun `work_email` udfyldt og bruger logget ind med privat email, eller omvendt), returnerer den NULL → INSERT afvises af RLS.

Hook'ets eget employee-lookup (`useCarQuiz.ts:73-77`) bruger `ilike` mod begge felter og kan finde employee'n — men RLS-funktionen sammenligner kun `lower(...) =` på de samme to felter, så de bør være enige. Hvis fejlen er denne, kommer den fra RLS, ikke fra hook-lookup.

**3. Generisk fejl-toast skjuler diagnosen**
`src/pages/CarQuiz.tsx:146-148` viser samme toast uanset hvad. Vi kan ikke se om det er duplicate-key, RLS, mangler employee, eller netværk.

## Fix (gul zone — pages + hook + RLS-policy)

### Ændring 1 — `src/hooks/useCarQuiz.ts`
- Erstat `car_quiz_completions`-insert (linje 114-118) med `.upsert({ employee_id, passed_at: new Date().toISOString() }, { onConflict: 'employee_id' })`. Løser retake-cases og er idempotent.
- I `mutationFn`: kast en `Error` med konkret besked (`submissionError.message`, `completionError.message`, "Employee not found") i stedet for generisk throw, så toast kan vise reel årsag.

### Ændring 2 — `src/pages/CarQuiz.tsx`
- `onError: (err) => toast.error(err.message || "Der opstod en fejl. Prøv igen.")` så brugeren (og vi) ser hvad der reelt fejler.

### Ændring 3 — RLS for retake (`car_quiz_completions`)
INSERT-policy giver ret til INSERT, men ikke UPDATE. `upsert` med eksisterende række kræver UPDATE-rettighed. Tilføj migration:
```sql
CREATE POLICY "Employees can update own quiz completion"
ON public.car_quiz_completions
FOR UPDATE
USING (employee_id = get_current_employee_id())
WITH CHECK (employee_id = get_current_employee_id());
```

### Verifikation
1. Test som logget-ind FM-bruger der allerede har en completion: indsend igen → ingen duplicate-key fejl, `passed_at` opdateret.
2. Test som ny bruger uden completion: virker som før.
3. Hvis fejlen stadig opstår: den nye toast viser nu om det er RLS (`new row violates row-level security`), employee-mismatch, eller noget tredje — så kan vi diagnosticere præcist næste runde.

## Uden for scope
- Pricing, løn, GDPR, rolle-system.
- At "passed" beregnes baseret på checkboxes alene (separat diskussion).
- Lock-overlay logik (`useCarQuizLock`) — kun submit-flowet fixes her.
