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
