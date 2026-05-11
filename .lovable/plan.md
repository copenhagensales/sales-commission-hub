## Diagnose

**Bruger:** Lucas Vico Petersen (`471ebb1a-983a-4d09-b48d-6a954aafd1e0`, work_email `luvp@copenhagensales.dk`).

**Faktisk DB-tilstand (lige nu):**
- Lucas ER tilmeldt aktiv sæson `f1df70db` (`league_enrollments.d9548614`, `is_active=true`, `is_spectator=false`, enrolled 6/5).
- Han har også standing i `league_qualification_standings` (5.250 kr, 27 deals).
- Kun ét `employee_master_data`-record, kun ét aktivt team (Eesy TM), ingen Stab-medlemskab.

**Symptom i screenshot:**
1. UI viser "Tilmeld mig nu" → `useMyEnrollment` returnerede `null`, selvom rækken findes.
2. Klik → toast "Cannot coerce the result to a single JSON object" (PostgREST `PGRST116`: `.single()` / `.maybeSingle()` fik 0 eller >1 rækker).

**Rod-årsag (mest sandsynlig):** `useEnrollInSeason` i `src/hooks/useLeagueData.ts`:

`src/hooks/useLeagueData.ts:283-288`
```ts
const { data: existing } = await supabase
  .from("league_enrollments")
  .select("id, is_active")
  .eq("season_id", seasonId)
  .eq("employee_id", employee.id)
  .maybeSingle();   // ← fejler hvis der findes >1 række (active + inactive)
```

`maybeSingle()` kaster "Cannot coerce" hvis der er flere rækker. Der er INGEN unique constraint i DB der forhindrer flere `league_enrollments`-rækker pr. (season_id, employee_id) — så samme par kan have både en historisk (is_active=false) og en ny række. Hos andre brugere har det allerede ramt (jf. `useUnenrollAndBecomeFan` der senere tilføjer en separat række ved spectator-skift).

Tilsvarende risiko: `.update().select().single()` (linje 297) og `.insert().select().single()` (linje 310) — hvis RLS filtrerer den returnerede række ved `SELECT after write` får man 0 rækker → samme fejl.

**Hvorfor `useMyEnrollment` returnerede null:** Den bruger `.maybeSingle()` med `.eq("is_active", true)` — hvis Lucas på et tidspunkt har haft 2 aktive rækker (fx fra en tidligere fan/player-skift bug), fejler det stille (kastet `error`, query returnerer ingen data, UI antager "ikke tilmeldt").

## Plan

**Scope:** Kun `src/hooks/useLeagueData.ts` (gul zone — liga-feature, ikke løn/pricing). Ingen DB-skema-ændringer i denne omgang.

### Steg 1 — Diagnose-bekræftelse (read-only, før kode-ændring)
- Kør query: `SELECT season_id, employee_id, count(*) FROM league_enrollments GROUP BY 1,2 HAVING count(*) > 1;` for at bekræfte om dubletter eksisterer. Hvis ja → liste antal berørte brugere.
- Tjek om Lucas har historik af spectator-skift der kan have lavet dubletter.

### Steg 2 — Fix mutation-robusthed (`useEnrollInSeason`, `useEnrollAsFan`, `useUnenrollAndBecomeFan`)
- Erstat `existing-check` med `.order("is_active", { ascending: false }).order("enrolled_at", { ascending: false }).limit(1).maybeSingle()` — så vi altid finder den nyeste/aktive uanset dubletter.
- Gør UPDATE/INSERT-result tolerant: brug `.maybeSingle()` + tjek for null + fallback re-fetch hvis RLS skjuler returneret række.
- Samme robusthedsfix i `useUnenrollFromSeason` og `useUnenrollAndBecomeFan` (samme mønster).

### Steg 3 — Fix read-hook (`useMyEnrollment`)
- Erstat `.maybeSingle()` med `.order("enrolled_at", { ascending: false }).limit(1).maybeSingle()` — defensivt mod dubletter.
- Behold `is_active=true`-filter.

### Steg 4 — Optional follow-up (rapporteres separat, IKKE i samme commit)
- Foreslå DB-migration: `UNIQUE (season_id, employee_id)` på `league_enrollments` + oprydning af eksisterende dubletter. Dette er en strukturel fix og kræver separat godkendelse — det er den rigtige løsning, men kode-fix ovenfor stopper bløder med det samme.

### Verifikation
- Bekræft Lucas's UI viser "tilmeldt"-state efter cache-invalidate (han ER allerede i DB).
- Test med en testbruger der har dubletter (hvis Steg 1 finder nogen).

## Hvad jeg IKKE rører
- DB-skema (foreslås kun som follow-up).
- Andre liga-hooks udover de nævnte.
- Ingen ændringer i RLS, permissions eller pricing.

Bekræft scope, så implementerer jeg Steg 1 (diagnose-query) først og rapporterer tilbage før Steg 2-3.
