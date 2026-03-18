

## Draft-booking workflow ✅

### Implementeret
1. ✅ Database: `status text DEFAULT 'draft'` tilføjet til `booking`-tabellen. Eksisterende bookings sat til `confirmed`.
2. ✅ `BookWeekContent.tsx`: Nye bookings oprettes med `status: 'draft'`. "Bekræft uge"-knap batch-opdaterer drafts.
3. ✅ `SupplierReportTab.tsx`: Filtrerer kun `confirmed` bookings i leverandørrapporter.
4. ✅ `Billing.tsx`: Filtrerer kun `confirmed` bookings i fakturering.

## Fortrolige kontrakter ✅

### Implementeret
1. ✅ Database: `is_confidential BOOLEAN DEFAULT false` tilføjet til `contracts`-tabellen.
2. ✅ `can_access_confidential_contract()` security definer funktion — kun `km@` og `mg@` returnerer `true`.
3. ✅ RLS-policies opdateret: Owners, Teamledere og Rekruttering kan IKKE se fortrolige kontrakter (medmindre autoriseret). Medarbejderen selv kan altid se sine egne.
4. ✅ `SendContractDialog.tsx`: "Fortrolig"-toggle med lås-ikon, kun synlig for km@/mg@.
5. ✅ `Contracts.tsx`: Lås-ikon vises ved fortrolige kontrakter i listen.

## Liga Gameplay med Division-først Ranking ✅

### Implementeret
1. ✅ Database: 3 nye tabeller (`league_rounds`, `league_round_standings`, `league_season_standings`) + RLS + realtime.
2. ✅ Edge function: `league-process-round` — ugentlig rundebehandling med division-først pointmodel.
3. ✅ **Ny pointformel**: `max(0, (totalDivisions - division) × 20 - (rank - 1) × 5)` — garanterer divisionsbaseret point.
4. ✅ **Runde-multiplikator**: `[1.0, 1.2, 1.4, 1.6, 1.8, 2.0]` — point stiger i løbet af turneringen.
5. ✅ **14 spillere pr. division** (opdateret fra 10).
6. ✅ Op/nedrykning: **Top 3 rykker op**, **#12-14 ned**, **#4-5 vs #10-11 playoff** (højest provision vinder).
7. ✅ `calculate-kpi-values`: Sæsoninitialisering ved `qualification → active` + automatisk round-processing.
8. ✅ Frontend hooks: `useCurrentRound`, `useSeasonStandings`, `useRoundStandings`, `useRoundHistory`, `useMySeasonStanding`.
9. ✅ Nye komponenter: `ActiveSeasonBoard.tsx` (divisioner med samlet point) + `RoundResultsCard.tsx` (runderesultater med bevægelser + multiplikator-badge).
10. ✅ `CommissionLeague.tsx`: Håndterer `active` status med tabs "Samlet stilling" | "Denne uge" | "Rundehistorik".
11. ✅ Zone-logik opdateret i alle UI-komponenter: `QualificationBoard`, `ActiveSeasonBoard`, `PremierLeagueBoard`, `ZoneLegend`.

## Referral bonus-validering ved deaktivering ✅

### Implementeret
1. ✅ Database: `hired_employee_id UUID` kolonne tilføjet til `employee_referrals` — direkte link til den ansatte medarbejder.
2. ✅ Trigger: `remove_deactivated_employee_from_teams()` udvidet til automatisk at afvise referrals (`status = 'rejected'`) hvis medarbejderen stopper inden 60 dages ansættelse.
3. ✅ `useUpdateReferralStatus`: Understøtter nu `hired_employee_id` parameter.
4. ✅ Hiring-dialog i `Referrals.tsx`: Dropdown til at vælge medarbejder ved "Marker som ansat" — kobler henvisningen til medarbejderen for automatisk bonus-validering.
