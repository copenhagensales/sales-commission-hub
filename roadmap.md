# Roadmap — DB-/lønberegning: korrekthed

Opgave fra Kasper (30/8 2026): assisterende teamledere med fast månedsløn tælles ikke med i DB pr. klient,
hardkodede forretningsregler skal ud i systemet, datakvalitet skal advares om, og beregningskernen skal testes.

## Del 1 — eksplicit lønmodel
- [x] Migration: `personnel_salaries.compensation_model` (`monthly_fixed` | `hourly` | `percentage`) + datamigrering (team_leader → percentage, >=1000 → monthly_fixed, <1000 → hourly med beløb flyttet til `hourly_rate`)
- [x] Fjern `HOURLY_RATE_THRESHOLD` fra `useAssistantHoursCalculation.ts`
- [x] Fjern `HOURLY_RATE_THRESHOLD` fra `useStaffHoursCalculation.ts`
- [x] `AddPersonnelDialog` + `EditPersonnelDialog`: eksplicit valg af lønmodel, label skifter mellem "Månedsløn (kr.)" og "Timesats (kr./time)"
- [x] `PersonnelSalaryTab`/oversigt viser den valgte model

## Del 2 — forretningsregler ud i systemet
- [x] Tabel `calculation_settings` + `calculation_settings_audit` (RLS: læs for alle, skriv kun med rettighed)
- [x] `clients.has_location_costs` erstatter `FM_CLIENT_NAMES` (navnematch)
- [x] Toggle for lokationsudgifter i klientadministrationen (MgTest → Kunder)
- [x] Feriepengesatser, arbejdsdage/md., ATP-sats og Stab-team læses ét sted (`useCalculationSettings`)
- [x] `FIXED_MONTHLY_OVERHEAD` beregnes fra data (Stab-udgifter + stabsløn)
- [x] `RevenueByClient`: `ALLOWED_EMAILS` → rettighedssystemet; `EESY_FM_ID`/`YOUSEE_ID` → `has_location_costs`
- [x] `LocationReportTab`: hardkodet `FM_CLIENTS`-liste → klienter med `has_location_costs`
- [x] Side "Beregningsindstillinger" under Løn med hjælpetekster + ændringslog
- [x] Ensret lederløn mellem `DBOverviewTab` og `ClientDBTab` (samme grundlag, ét kodested)

## Del 3 — datakvalitetspanel
- [x] Panel på DB pr. klient med de fem tjek (manglende lønrække, lønrække uden team, inaktive på team, team uden leder/procentsats, klient uden team)
- [x] "Mangler grundlag" i stedet for stiltiende 0
- [x] Inaktive medarbejdere tælles ikke i ATP-beregningens `teamMemberCount`

## Del 4 — verifikation
- [x] Tests: proratering, feriepenge pr. type, ATP, lederløn med/uden minimumsløn, fordeling på klienter (omsætnings- og DB-andel)
- [x] Typecheck + testkørsel

## Åbne punkter (kræver beslutning fra Mathias/Kasper)
- `CombinedSalaryTab` viser fortsat `monthly_salary` som teamleder-placeholder i stedet for den DB-beregnede lederløn (uændret i denne opgave).
- Data: 4 assistenter i `team_assistant_leaders` har ingen aktiv `personnel_salaries`-række (Sebastian V. Bangsbo, Felix J. A. Kjeldsen, Mathias Grubak, Annika Søndergaard) og 2 inaktive ligger stadig på team (Rasmus A. Eltong, Eline-Kirstine Jørgensen). Panelet viser dem nu; rettelse af data kræver beslutning.

## Del 5 — oprydning af teamtilknytninger for inaktive medarbejdere
- [x] Niveau 2 (beregninger): verificeret allerede opfyldt — `useClientDbData` bygger `activeMemberCounts` via `activeIds.has()` + `getActiveTeamAssistantIds`, og `ClientDBTab`/`DBOverviewTab` læser begge fra samme hook. ATP rammer derfor kun aktive.
- [x] Datakvalitetspanelets tjek "Inaktive medarbejdere stadig tilknyttet et team" viser alle 79 rækker.
- [x] Niveau 1 (trigger ved deaktivering) — VALGT: mulighed A (hærd historik først, derefter trigger, derefter oprydning).
- [x] Niveau 3 (oprydning af 77+2 rækker) — VALGT: mulighed A.

### A1 — hærd historisk teamattribution (skal være færdig FØR oprydning)
Fuld audit (baggrundsagent) fandt flere afhængigheder end de oprindelige fem:
- [ ] `sync_last_team_id()` nulstiller `last_team_id` ved DELETE → skal bevare `OLD.team_id` (ellers ryger selve fallback-værdien)
- [ ] `fn_remove_assignments_on_team_member_delete()` kaskaderer og sletter `employee_client_assignments` (264 rækker for inaktive) → skal springe inaktive over
- [ ] `get_league_team_provision()` → `last_team_id`-fallback
- [ ] `get_team_performance_summary()` → `team_emp` med fallback, `emp_count` kun aktive
- [ ] `EmployeeCommissionHistory.tsx` → team fra `employee_master_data.team_id ?? last_team_id`
- [ ] `NewEmployeesTab.tsx` → `last_team` fallback (viser bevidst inaktive)
- [ ] `HistoricalTenureStats.tsx` → `last_team` fallback (bygget til inaktive)
- [ ] `useLeagueTeamCompetition.ts` → fallback
- [ ] `calculate-leaderboard-incremental` → fallback i employee→team map
- [ ] `calculate-kpi-values` (5 steder) → fallback
- [ ] `tv-dashboard-data` (2 steder: TdcErhvervData, CsTop20Data) → fallback
- [ ] Ikke påvirket (verificeret): `DailyReports`, churn-komponenter, `useKpiTest`, `useSellerSalariesCached` (har allerede fallback), vagtplan, `send-deactivation-reminder`, `get_contract_compliance`, `get_cs_top20_custom_period_leaderboard`

### A2 — trigger ved deaktivering
- [ ] `remove_deactivated_employee_from_teams()`: sæt `last_team_id` eksplicit (AFTER-trigger), fjern fra `team_members`, `team_assistant_leaders`, nulstil `teams.team_leader_id`
- [ ] Log til ny tabel `team_membership_removal_log`

### A3 — oprydning af eksisterende data
- [ ] Snapshot + slet 77 `team_members` + 2 `team_assistant_leaders` for inaktive
- [ ] Verificér churn pr. team, DailyReports og EmployeeCommissionHistory før/efter

## Del 6 — løn kun ét sted (stamkortet er sandheden)
- [x] Migration 1: lønfelter (`personnel_category`, `salary_percentage_rate`, `salary_minimum`, `salary_hours_source`, `salary_start_date`, `salary_notes`) på `employee_master_data`
- [x] Migration 1: `sync_personnel_salary_from_master()` + trigger → `personnel_salaries` er afledt spejl
- [x] Migration 1: direkte skrivning til `personnel_salaries` blokeret via RLS
- [ ] De seks assistenter/ledere sættes til `monthly_fixed` med korrekt beløb
- [ ] Sejer Sylvester Schmidt tilføjes `team_assistant_leaders` på Eesy TM
- [ ] Frontend skriver løn via stamkortet: `AddPersonnelDialog`, `EditPersonnelDialog`, `AssistantSalary`, `StaffSalary`, `TeamLeaderSalary`
- [ ] Rapport pr. medarbejder hvor kilderne var uenige

## Del 7 — superadmin til løn- og overskudstal
- [ ] Tabel `superadmins` (e-mail som data) + `is_superadmin()` + seed km@/mg@/lm@copenhagensales.dk
- [ ] Kun superadmin kan tildele/fjerne superadmin (ejer kan ikke)
- [ ] RLS: `personnel_salaries` (superadmin + egen), `calculation_settings`, `team_expenses`, `client_adjustment_percents`, `fixed_costs`
- [ ] Kolonnerettigheder: `employee_master_data.salary_amount`/`salary_percentage_rate`/`salary_minimum`/`salary_notes` kan ikke læses direkte
- [ ] RPC `get_employee_salary_details()`: superadmin (alle) / egen række / sælgere uden `personnel_category` — med logning i `sensitive_data_access_log`
- [ ] Frontend: `useIsSuperadmin`, guards på DB pr. klient, DB-oversigt, Omsætning per klient, Beregningsindstillinger, personalelønfaner, Excel-eksport
- [ ] Erstat `select("*")` på `employee_master_data` (7 steder) + vagtplanens lønopslag

