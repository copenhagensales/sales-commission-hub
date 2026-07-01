## Ny retning: automatisk tilmelding

I stedet for både A (frys) og B (rullende sync) laver vi det simple: **alle relevante medarbejdere er automatisk med i den aktive sæson.** Tilmeldings-UI'et beholdes kun til opt-out (spectator).

## Hvad "alle relevante" betyder — kræver din stillingtagen

Vi har disse aktive `job_title`-værdier i dag:

| Job title | Forslag | Note |
|---|---|---|
| Salgskonsulent | ✅ med | sælger TM |
| Fieldmarketing | ✅ med | sælger FM |
| Teamleder | ❌ ude | leder |
| Assisterende Teamleder | ❌ ude | leder |
| Assisterende Teamleder TM | ❌ ude | leder |
| Fieldmarketing leder | ❌ ude | leder |
| Ejer | ❌ ude | leder |
| Backoffice | ❌ ude | stab |
| Rekruttering | ❌ ude | stab |
| SOME | ❌ ude | stab |
| (null) | ❌ ude | ukendt titel — sikrest at holde ude |

**Spørgsmål 1:** Er listen ovenfor korrekt? Særligt "assisterende teamledere" — nogle steder sælger de også. Skal de med?

## Plan

### 1. Ny helper: `isLeagueEligible(employee)`

Én kilde til sandhed for hvem der er med. Placeres i `src/lib/leagueEligibility.ts` + spejles i `supabase/functions/_shared/leagueEligibility.ts`.

Regel (v1):
```
eligible = is_active = true
        AND job_title IN ('Salgskonsulent','salgskonsulent','Fieldmarketing','fieldmarketing')
```

### 2. Auto-enroll for aktiv sæson

Ny funktion `syncLeagueEnrollments(seasonId)` i `supabase/functions/league-calculate-standings/index.ts`:

- Hent alle `is_active = true`-medarbejdere.
- Filtrér med `isLeagueEligible`.
- Upsert `league_enrollments (season_id, employee_id, is_active=true, is_spectator=false)` for hver.
- Rør IKKE eksisterende rækker hvor `is_spectator=true` (brugerens eget opt-out bevares) — vi bruger `onConflict: season_id,employee_id, ignoreDuplicates: true`.
- Kaldes:
  - Ved sæson-overgang `qualification → active` (i `calculate-kpi-values/autoTransitionSeasonStatuses`).
  - Ved hver kørsel af `league-calculate-standings` mens sæson er `qualification` eller `active` (fanger nye ansættelser løbende).

### 3. Sync late enrollees til `season_standings`

Samme problem som før (Frederik Donner): nye eligible medarbejdere skal også ind i `season_standings` når sæsonen er aktiv.

Ny funktion `syncLateEnrollmentsToSeasonStandings(seasonId)`:
- Diff `league_enrollments` (aktive, ikke-spectator) vs `season_standings.employee_id`.
- Manglende → indsæt i **laveste division**, rank efter sidste, 0 point / 0 provision / 0 rounds_played.
- Kaldes efter hver qual-beregning når sæson er `active`.

**Spørgsmål 2:** Skal late-comers ind i laveste division (fair — de har ikke kvalificeret sig), eller placeres efter deres qual-provision i den relevante division?
→ **Anbefaling: laveste division.** Simpelt, retfærdigt over for dem der har spillet siden start.

### 4. Datafix for S3 (aktiv sæson nu)

Ét-gangs-kørsel af de to sync-funktioner mod S3:
- Tilmelder de sælgere der ikke er med (ud af 47 tilmeldte i dag — vi tjekker hvor mange eligible mangler).
- Indsætter de 5 manglende i `season_standings` (inkl. Frederik Donner) i laveste division.

**Spørgsmål 3:** Skal S3's division 3 (18 spillere, burde være 10) **omfordeles** nu, eller **bevares som den er** til næste sæson?
→ **Anbefaling: bevares.** Omfordeling midt i sæsonen ændrer folks division og påvirker point-formlen for allerede spillede runder. Læringen tages med til S4.

### 5. UI-oprydning

- `MyEnrollment` / tilmeldingsknap: skjul "Tilmeld"-knappen når brugeren allerede er auto-tilmeldt. Vis kun "Deltag som tilskuer"/"Deltag som spiller"-toggle.
- Ledere/stab ser en besked: "Ligaen er kun for sælgere."

### 6. Ude af scope

- Pricing, løn, RLS. Ingen ændringer der.
- Historiske sæsoner (S1, S2). Rører ikke deres data.

## Åbne spørgsmål (svar før jeg går i gang)

1. **Job-title-listen** — er tabellen ovenfor korrekt? Særligt: skal "Assisterende Teamleder" / "Assisterende Teamleder TM" med?
2. **Late-comer division** — laveste (anbefalet) eller efter qual-provision?
3. **S3 division 3-fix** — bevares (anbefalet) eller omfordeles nu?
4. **Opt-out** — skal medarbejdere kunne fravælge sig ligaen (spectator-toggle), eller er auto-tilmelding tvungen?

## Filer der berøres

- `src/lib/leagueEligibility.ts` (ny, grøn zone)
- `supabase/functions/_shared/leagueEligibility.ts` (ny, gul zone)
- `supabase/functions/league-calculate-standings/index.ts` (gul/rød — liga-motor)
- `supabase/functions/calculate-kpi-values/index.ts` linje 259–430 (rød — sæson-init)
- `src/hooks/useLeagueData.ts` (gul — UI-hooks)
- `src/components/league/*` — kun visning af enrollment-status (grøn)

Rød zone: godkendelse krævet for edge functions. Grøn zone kan jeg lave umiddelbart.

Sig svar på 1–4, så bygger jeg.
