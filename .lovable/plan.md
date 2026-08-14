# Automatisk team-tilknytning fra opstartshold

## Hvad problemet faktisk er

Det er ikke "de mangler at få valgt et team" — teamet er valgt, men det bliver skrevet det forkerte sted.

Verificeret i koden og databasen:

- `src/lib/cohortMemberProcessing.ts:62` sætter `employee_master_data.team_id = cohort.team_id`, når medarbejderen oprettes fra holdet.
- Der bliver **aldrig** oprettet en række i `team_members`.
- Hele systemet bruger `team_members` som sandhed: team-oversigten (`TeamsTab.tsx:159-219`), RLS-funktionen `is_in_my_teams`, `last_team_id`-synk (`sync_last_team_id`) og automatisk klienttildeling (`fn_auto_assign_on_new_team_member`).

Derfor står 23 aktive medarbejdere i dag med `team_id` udfyldt og nul rækker i `team_members` — heraf de 4 du har markeret (Carl Dahlgaard Nielsen, Mathias Teddy Fejerskov, Silke Agergaard Jakobsen, Tobias Hoffmann Weisleder). Mathias Teddy har fx `team_id` = United fra holdet "Tryg - 10. august 2026", men ingen team-medlemskab.

## Løsningen

`team_members` er sandheden. `employee_master_data.team_id` behandles som "planlagt team" (intention fra holdet). Ingen ny kolonne, ingen ny tabel.

1. **Ved oprettelse fra hold (primær vej).** Én fælles hjælpefunktion `src/lib/employees/ensureTeamMembership.ts` opretter `team_members`-rækken ud fra holdets team. Kaldes fra `processCohortMember` (både "Start hold og send invitationer" og sen-tilføjelse via `AddMemberDialog`) og fra den nye aktiverings-flow (`activateEmployee.ts`), så alle veje går gennem samme logik.

2. **Selvhelende daglig job (sikkerhedsnet).** DB-funktion `sync_cohort_team_memberships()` (SECURITY DEFINER) + pg_cron dagligt kl. 05:30. Den opretter kun medlemskab når **alle** betingelser holder:
   - medarbejderen er aktiv
   - `employment_start_date <= i dag` og indenfor de seneste 30 dage
   - medarbejderen har **nul** rækker i `team_members`
   - der findes et team fra holdet (`onboarding_cohorts.team_id`), ellers fallback til `employee_master_data.team_id`

   De to guards (nul eksisterende medlemskaber + 30-dages vindue) er det vigtige: jobbet kan aldrig flytte nogen, aldrig overskrive en manuel team-flytning, og aldrig genoplive gamle deaktiverede sager.

3. **Engangs-backfill.** De 23 nuværende tilfælde får deres `team_members`-række ud fra hold-team, med `employee_master_data.team_id` som fallback. 3 personer (Magnus Nørgaard, Magnus Hansen, Carl Dahlgaard Nielsen) har hverken hold eller `team_id` — de bliver stående i "Medarbejdere uden team" og skal sættes manuelt.

4. **Hold-team ændres efter oprettelse.** Hvis teamet på et hold rettes, mens medlemmerne endnu ikke er startet, flyttes de med — men kun de medlemmer der stadig ligger på holdets gamle team og har startdato i fremtiden. Har nogen fået et andet team manuelt, røres de ikke.

## Problemer jeg har tjekket — og hvad de betyder

| Forhold | Konsekvens |
|---|---|
| `enforce_single_team_for_non_staff` sletter andre medlemskaber ved insert | Uproblematisk: vi indsætter kun for folk med nul medlemskaber. Stab (`is_staff_employee`) er undtaget og rammes ikke. |
| `fn_auto_assign_on_new_team_member` opretter `employee_client_assignments` | Det sker allerede i dag ved manuel team-tilføjelse — samme adfærd, ingen ny effekt. Feature flag `employee_client_assignments` er slået fra. |
| `is_primary` sættes ikke af triggeren | Uændret adfærd. Primær klient sættes stadig manuelt — vi ændrer ikke den regel her. |
| Medlemskab før startdato | Team-oversigten skelner allerede "På teamet nu" vs "Starter senere" på startdato, så fremtidige opstartere tælles korrekt. Teamlederen får til gengæld indsigt i dem inden start — det er ønsket. |
| Salgsattribution | Uændret. Ejerskab følger klientens team (`team_clients`), ikke sælgerens team. |
| Lønberegning | Uændret. Ingen filer i `src/lib/calculations/` eller `src/components/salary/` røres. |

## Åben beslutning jeg ikke gætter på

`employee_master_data.team_id`, `last_team_id` og `team_members` er tre lag for samme oplysning. Denne plan gør `team_members` til sandhed og `team_id` til intention, men rydder ikke op i dobbeltheden — det er en større beslutning (§7 i CLAUDE.md). Skal jeg lave en separat analyse af den bagefter?

## Zoner og teknik

- `src/lib/cohortMemberProcessing.ts` — gul (rekruttering/opstart)
- `src/lib/employees/ensureTeamMembership.ts` — ny fil
- `src/lib/employees/activateEmployee.ts` — ny fil fra sidste opgave
- Migration: `sync_cohort_team_memberships()` + pg_cron-schedule
- Backfill: dataændring via insert-værktøjet, ikke migration
- Ingen røde filer berøres. Én commit pr. del: (a) kode + migration, (b) backfill.
