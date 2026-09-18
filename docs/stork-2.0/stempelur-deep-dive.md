# Stempelur og tidsregistrering i Stork 1.0 — deep dive

Forarbejde til Lag E (Stork 2.0). Faktarapport, ingen anbefalinger.

Scope:
- Hvordan medarbejdere registrerer arbejdstid: stempelur, vagtplan, fravær.
- Hvordan tid redigeres, godkendes, ender i lønberegning.
- IKKE: provision/pricing-aggregering (separat rapport `beregningsmotor-deep-dive.md`).

Empirisk grundlag:
- Kode læst direkte fra repo `/home/user/sales-commission-hub` (state pr. 2026-05-13).
- DB-state læst fra `docs/system-snapshot.md` (auto-genereret).
- Live Supabase MCP forbundet til Stork 2.0 (greenfield) — ingen direkte queries mod 1.0 prod.

---

## 1. Domænet i én sætning

Stork måler arbejdstid på to konkurrerende måder: **planlagte vagter** (i `shift`-tabellen plus en team-template-hierarki) og **stempelinger** (i `time_stamps`). Pr. (medarbejder × klient) afgør en config-tabel hvilken kilde der gælder. Resultatet bliver timer × timesats = løn for ikke-sælgere.

## 2. Tabeller — det aktive lag

Tællinger fra `docs/system-snapshot.md`.

### `time_stamps` — 91 rækker

Selve stempeluret. Skema:
- `id`, `employee_id` (FK→employee_master_data, ON DELETE CASCADE), `shift_id` (FK→shift, ON DELETE SET NULL, nullable)
- `clock_in` timestamptz NOT NULL DEFAULT now() — **rå tidspunkt**
- `clock_out` timestamptz nullable — null mens aktiv
- `effective_clock_in`, `effective_clock_out` timestamptz — **klampet til vagt-tider**
- `effective_hours` numeric — beregnet ved clock-out
- `break_minutes` integer DEFAULT 60 — eksplicit pause-fradrag
- `note` text, `client_id` uuid nullable (sekundær klient)
- `edited_by` uuid, `edited_at` timestamptz — audit-trail for manager-redigeringer
- `created_at`, `updated_at` (latter via trigger `update_time_stamps_updated_at`)

Indekser: `idx_time_stamps_employee_id`, `idx_time_stamps_clock_in`, `idx_time_stamps_employee_clock_in`, `idx_time_stamps_employee_clockin` (dublet?), `idx_time_stamps_client_id`. **`employee_clock_in` og `employee_clockin` ligner duplikat-indekser.**

RLS: medarbejdere kan se/oprette/opdatere egne. Teamleders kan håndtere team-rækker. Owners kan alle.

**Ingen DB-trigger** beregner `effective_*` eller `effective_hours` — alle tre felter sættes fra app-koden.

Sample (`docs/system-snapshot.md:356786-356830`):
```
clock_in: 2026-01-15T07:30, clock_out: 13:45
effective_clock_in: samme, effective_clock_out: samme, effective_hours: 5.25
break_minutes: 60
```

### `shift` — 207 rækker

Individuelle vagter pr. dato. Skema:
- `employee_id`, `date` (date, NOT NULL), `start_time` (time UDEN tz), `end_time` (time UDEN tz)
- `break_minutes` integer DEFAULT 0
- `planned_hours` numeric GENERATED COLUMN (computed from start/end - break)
- `status` USER-DEFINED DEFAULT `'planned'::shift_status` (enum: `planned, completed, cancelled`)
- `note` text, `created_by` uuid
- Constraint `no_overlapping_shifts`: `UNIQUE (employee_id, date, start_time)` (**ikke en exclusion-constraint** — to vagter 08:00-12:00 og 11:00-15:00 på samme dag tillades, så længe start_time er forskellige).
- Triggers: kun `update_shift_updated_at`.

Bemærk: **`start_time`/`end_time` har ingen tidszone**. Overnight-vagter (22:00→06:00) håndteres ved at app-koden i `hours.ts:39-42` lægger 24×60 minutter til. DB-modellen kender ikke konceptet.

### `team_standard_shifts` — sample 2 rækker (live)

Template for default-vagter pr. team.
- `team_id` (FK→teams), `name`, `start_time`, `end_time`, `is_active` (default false), `hours_source` text DEFAULT `'shift'` (her sidder den **legacy** routing: `'shift'` eller `'timestamp'`)
- Triggers: `update_team_standard_shifts_updated_at`

Bemærk to samples har `start_time='00:00:00', end_time='00:00:00'` ("Deltid") som markør for "intet" — app-koden i `useStaffHoursCalculation.ts:258-263` springer over på denne værdi.

### `team_standard_shift_days` — 30 rækker

Per ugedag (1-7, ISO Monday=1) per template.
- `shift_id` (FK→team_standard_shifts), `day_of_week` integer NOT NULL, `start_time`, `end_time`
- UNIQUE (shift_id, day_of_week)

### `team_shift_breaks` — 22 rækker

Pauser pr. template.
- `shift_id`, `break_start`, `break_end`, `day_of_week` (nullable; null = alle dage)

**Bemærk: jeg har ikke fundet kode der LÆSER `team_shift_breaks`.** Alle hour-beregningshooks bruger:
- `shift.break_minutes` (på individuelle shifts), eller
- automatisk 30-min hvis dagsvagt > 6 timer (`hours.ts:9-12`), eller
- `time_stamps.break_minutes` (på clock-ins)

Pauserne i `team_shift_breaks` ser ud til at være data-only — ingen beregning rør dem.

### `employee_standard_shifts` — 6 rækker

Junction: medarbejder → custom shift template (override af team-default).
- `employee_id`, `shift_id` (FK→team_standard_shifts)
- UNIQUE (employee_id, shift_id) plus partial unique `unique_employee_standard_shift`
- Bruges af `useStaffHoursCalculation`/`useAssistantHoursCalculation` som mellem-niveau i vagtarvet.

### `absence_request_v2` — 826 rækker (live fraværsregister)

Skema:
- `employee_id`, `type` (enum `absence_type_v2`: **kun `'vacation'` og `'sick'`**)
- `start_date`, `end_date` (date), `start_time`, `end_time` (time, nullable for full-day)
- `is_full_day` boolean DEFAULT true
- `status` (enum `absence_request_status`: `pending, approved, rejected`), `reviewed_by`, `reviewed_at`, `rejection_reason`, `comment`, `postponed_until`
- Triggers: `recalculate_coaching_on_absence` (AFTER INSERT/UPDATE OF status, start_date, end_date) → kalder `recalculate_coaching_due_dates_for_employee()` for at justere onboarding-coaching-tasks. **Triggeren rører IKKE løn**.

**TypeScript-inkonsistens:** `useShiftPlanning.AbsenceRequest` interface (linje 47-50) lister fire typer: `"vacation" | "sick" | "no_show" | "day_off"`. DB-enum'en understøtter kun to. En INSERT med `'no_show'` eller `'day_off'` vil fejle.

### `employee_time_clocks` — sample 1 række

**Routing-config**, ikke rå tid. Pr. (employee_id × client_id × clock_type).
- `clock_type` enum `clock_type`: `'override'`, `'documentation'`, `'revenue'`
- `hourly_rate`, `cpo_per_hour`, `project_name`, `is_active`
- UNIQUE (employee_id, client_id, clock_type)

Bestemmer hvilken hours-kilde der gælder pr. medarbejder × klient — se `src/lib/resolveHoursSource.ts:1-80`:
- `'override'` → brug `time_stamps`
- `'revenue'` → brug `time_stamps` (med revenue-rate)
- `'documentation'` → brug `shift`-hierarki (men stempelinger logges som dokumentation)
- intet config → brug `shift`-hierarki (default)

### `personnel_salaries` — sample 2 rækker

Lønregister pr. medarbejder.
- `salary_type` text: `"staff"`, `"assistant"`, `"team_leader"` (separat fra `employee_master_data.salary_type`)
- `monthly_salary`, `hourly_rate`, `minimum_salary`, `percentage_rate`
- `hours_source` text DEFAULT `'shift'` — **legacy** kilde-vælger (før `employee_time_clocks`)
- `is_active`
- UNIQUE (employee_id, salary_type)
- RLS: kun owners kan se/redigere

### `payroll_error_reports`

Medarbejder-rapporteret fejl i løn. Kategorier ses som "Diet", "Provision" (sample).
- `payroll_period_start`, `payroll_period_end` (date)
- Sample-rækker viser perioder **2026-02-14 → 2026-03-14** (14→14, ikke 15→14 som helperen siger). Sandsynligvis off-by-one i UI-indtastning.

### `extra_work`

Medarbejder-anmodet ekstratid (overtime).
- `employee_id`, `shift_id` nullable, `date`, `from_time`, `to_time`, `hours`, `reason`
- `status` text DEFAULT `'pending'` (string, **ikke** enum — så validation er kun i TypeScript)
- `approved_by`, `approved_at`, `rejection_reason`

**Approved `extra_work`-rækker indgår ALDRIG i nogen hours-beregning.** Verificeret med grep: ingen af `useStaffHoursCalculation`, `useAssistantHoursCalculation`, `useEffectiveHourlyRate`, `calculate-kpi-values`, eller `tv-dashboard-data` læser `extra_work`. Det er en parallel approval-flow uden lønintegration.

---

## 3. Tabeller — det døde lag

Tre tabeller eksisterer men har 0 rækker og rør'es ikke af noget der reelt fungerer.

### `time_entry` (0 rækker) — død

Skema spejler `time_stamps`: `id, employee_id, shift_id, date, clock_in, clock_out, actual_hours, note`. Helt anden tabel uden `effective_*`-felter. **Aldrig brugt af stempelur-UI'et**. 

Bruges af:
- `useShiftPlanning.useTimeEntries` (`src/hooks/useShiftPlanning.ts:491-509`) → læser tabellen
- `useShiftPlanning.useClockIn` (`useShiftPlanning.ts:512-540`) → skriver til tabellen
- `useShiftPlanning.useClockOut` (`useShiftPlanning.ts:543-567`) → opdaterer
- `useShiftPlanning.useActiveTimeEntry` (`useShiftPlanning.ts:570-587`) → læser
- `src/components/shift-planning/TimeClock.tsx` (134 linjer) — bruger ovenstående hooks, men er **IKKE importeret** noget sted (`grep -rln "shift-planning/TimeClock" src/` finder kun selve filen)
- `src/pages/shift-planning/TimeTracking.tsx:79` — manager-view der læser fra tabellen og **altid viser tom liste** fordi tabellen er tom

`/shift-planning/time-tracking` er en registreret rute (`src/routes/config.tsx:256`). Når en teamleder åbner siden får de en tom tabel.

### `employee_absence` (0 rækker) — død (FM-legacy)

Stammede fra det selvstændige FM-system (migration `20251204093942`). Skema:
- `start_date`, `end_date`, `reason` (USER-DEFINED), `note`, `status` DEFAULT `'APPROVED'` (**uppercase!**)
- `is_full_day`, `start_time`, `end_time`
- `approved_by_employee_id`, `approved_at`, `rejection_reason`

Bruges af:
- `useTimeOffRequests`, `usePendingTimeOffCount`, `useApproveTimeOff`, `useRejectTimeOff`, `useCreateTimeOff` (`src/hooks/useTimeOffRequests.ts`) — alle læser/skriver `employee_absence`
- `src/pages/vagt-flow/TimeOffRequests.tsx` (vagt-flow time-off side) — registreret rute (`config.tsx:237`)
- Hooket joiner mod `employee.id` (FM-tabellen, ikke `employee_master_data`) — **dobbelt død** (forkert tabel + forkert join)

Hver gang `/vagt-flow/...time-off-requests` åbnes, viser den tom liste. Ingen rækker har fundet vej dertil siden FM-mergen.

### `time_off_request` — død (FM-legacy)

Fra samme FM-migration. Kun referencen er i `src/integrations/supabase/types.ts:13316`. Ingen kode læser/skriver. Død i kodebasen, måske eksisterer stadig som DB-tabel — snapshot mangler den.

### Mindre død kode

- `shift_notification` — kun i TypeScript-typer (`src/integrations/supabase/types.ts`). Ingen kode læser/skriver.
- `sms_notification_log` (med `sms_type` enum: `new_shift, updated_shift, deleted_shift, week_confirmation`) — fra FM-migration. Ingen `send-shift-sms` edge function findes. Ingen kode i `src/` skriver til tabellen. **Hele SMS-notifikations-systemet for vagter er aldrig bygget færdig**.
- `closing_shifts` — selv om det hedder "shifts" handler det om hvem der lukker kontoret hver ugedag og sender reminder-emails. Ikke tidsregistrering. (Sample viser `weekday=1, employee_name="Bornak", send_time=16:00`.)
- `useShiftPlanning.AbsenceRequest`-interfacets ekstra typer `'no_show'`, `'day_off'` — TypeScript-niveau dead (DB afviser).

---

## 4. Stempelur-flow — sådan registreres tid

### Indgang: medarbejder klikker stempel-ind

To næsten identiske UI-sider:

**`/time-stamp`** → `src/pages/TimeStamp.tsx` (340 linjer)
- Klassisk stempelur. Vises kun for brugere med permission `menu_time_stamp` (`routes/config.tsx:186`).
- Bruger `useTimeStamps()` (`src/hooks/useTimeStamps.ts:82-302`).

**`/my-time-clock`** → `src/pages/MyTimeClock.tsx` (341 linjer)
- Vises kun hvis medarbejderen har mindst én `employee_time_clocks`-række (gate via `useEmployeeTimeClocks`).
- Stort set samme UI, men viser også klok-konfiguration som badges.
- Begge sider bruger samme `useTimeStamps()`-hook → samme tabel.

Begge er registreret som live routes. Sidebar viser `/my-time-clock`-linket kun hvis `useHasActiveTimeClock` returnerer true (`src/components/layout/AppSidebar.tsx:60,694`).

### Clock-in-mutationen (`useTimeStamps.clockIn`)

`src/hooks/useTimeStamps.ts:181-221`:

1. Læs `employee_master_data.standard_start_time` (tekst-felt med format `"8.00-16.30"`).
2. Parse til `{start: "08:00", end: "16:30"}` via lokal helper `parseWorkingHours` (`useTimeStamps.ts:34-38`) — default `"09:00"`-`"17:00"`.
3. Beregn `effective_clock_in` via `calculateEffectiveTimes(clockIn, null, shiftStart, shiftEnd, breakMinutes)` (`useTimeStamps.ts:41-75`):
   - Klamper `effective_in = max(now, shiftStart)`.
4. Insert i `time_stamps`:
   - `clock_in: now` (rå)
   - `effective_clock_in: clamped`
   - `break_minutes: employee.salary_type === "hourly" ? 60 : 0` (læser **`employee_master_data.salary_type`**, ikke `personnel_salaries`)
   - `note, client_id` valgfri

Hvis en medarbejder stempler ind 07:00 men vagten starter 08:00 → `effective_clock_in = 08:00`. Det rå 07:00 bevares.

### Clock-out-mutationen

`src/hooks/useTimeStamps.ts:224-271`:

1. Hent eksisterende stamp.
2. Klamper `effective_clock_out = min(now, shiftEnd)`.
3. Beregn `effective_hours = (effective_out - effective_in)/3600 - break_minutes/60` (clamped ≥ 0).
4. Update `clock_out, effective_clock_in, effective_clock_out, effective_hours, note`.

### Manager-redigering

`src/hooks/useTimeStamps.ts:327-368` `useUpdateTimeStamp`:
- Kan opdatere `effective_clock_in`, `effective_clock_out`, `effective_hours`, `note`.
- Skriver `edited_by, edited_at`.
- **Rør IKKE `clock_in` / `clock_out` (de rå)**.

### Pause-default-mismatch

- `useTimeStamps.clockIn`: 60 min (hourly) / 0 min (else)
- `useTimeStamps.calculateEffectiveTimes`: default-param 60 hvis ikke override
- `time_stamps.break_minutes` (DB column default): 60
- `hours.ts.calculateHoursFromShift` (vagt-baseret): 30 min auto hvis vagt > 6 timer
- `kpi_definitions.break_deduction_per_day` (used by `useEffectiveHourlyRate`): default 1 time
- `team_shift_breaks` (eksplicitte pauser pr. template): **læses ikke af nogen kode**

Fem forskellige pause-modeller med tre forskellige default-værdier (0, 30 min, 60 min, 1 time).

---

## 5. Vagtplan-flow

### Skabelon-arkitektur (3 niveauer, manageret af teamleders)

```
team_standard_shifts (per team)
  ├── team_standard_shift_days (ugedag 1-7, start/end pr. dag)
  └── (team_shift_breaks — eksisterer men læses ikke)

employee_standard_shifts (per-medarbejder override)
  → peger på en alternativ team_standard_shifts.id

shift (individuel dato — overrider alt)
  → engangs-vagt for én specifik dato
```

Opløsningsorden i `src/lib/shiftResolution.ts:80-130` (canonical):

1. `shift`-tabellen for dato — hvis findes, brug den
2. `employee_standard_shifts.shift_id` → `team_standard_shift_days` for dagens day_of_week
3. Hvis ingen af de to: **`hasShift: false, 0 timer`** — eksplicit "ingen vagt".

**`src/lib/shiftResolution.ts` siger eksplicit (linje 14): "NO weekday fallback. A day without a configured shift = no work, regardless of day-of-week."**

MEN — det er den centrale lib. To gamle hooks (`useStaffHoursCalculation`, `useAssistantHoursCalculation`) implementerer en EKSTRA fallback: hvis ingen `employee_standard_shifts`-tilknytning findes, falder de tilbage til team-default. Disse hooks blev skrevet før `shiftResolution.ts`-libet.

### CRUD

`useShiftPlanning.ts` indeholder:
- `useShifts` (linje 90-127) — hent for periode + team
- `useMyShifts` (linje 130-148)
- `useCreateShift` (linje 151-174)
- `useUpdateShift` (linje 177-201)
- `useDeleteShift` (linje 204-221)

Toast'er på dansk: "Vagt oprettet", "Vagt opdateret", "Vagt slettet".

Manager-side: `/shift-planning` → `ShiftOverview.tsx` (1942 linjer — meget stor monolit, drag-and-drop UI).
Medarbejder-side: `MySchedule.tsx` viser deres egne shifts + absences + time_stamps for måneden (Mon-Fri only).

### Vagt-overlap

`shift.no_overlapping_shifts` er en UNIQUE constraint på `(employee_id, date, start_time)` — den fanger to-vagter-med-samme-start. **Den fanger IKKE faktisk overlap.** En vagt 08:00-16:00 og en vagt 11:00-14:00 på samme dag tillades. CLAUDE.md flag: "Vagt-overlap validering i DB-lag (kun UI-valideret i dag)" — bekræftet.

---

## 6. Fraværs-flow

### Live-vej

`absence_request_v2`-tabellen — 826 aktive rækker.

Insert: `useShiftPlanning.useCreateAbsenceRequest` (`useShiftPlanning.ts:341-363`). Status defaulter til `'pending'`.

Approve/reject: `useShiftPlanning.useUpdateAbsenceRequest` (`useShiftPlanning.ts:366-410`):
- Læser den nuværende brugers `employee_id` via `private_email`/`work_email` match (`useShiftPlanning.ts:374-383`)
- Update sætter `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`

UI-side: `/shift-planning/absence` → `AbsenceManagement.tsx`.

### Selv-registreringer

Medarbejder selv:
- `CreateAbsenceDialog` — opretter med `status='pending'` (afventer leder).

Leder for medarbejder:
- `MarkSickDialog` — opretter med `is_full_day=true, type='sick'`, men `useCreateAbsenceRequest` sætter status til `'pending'`. **Det er IKKE auto-godkendt.**

Sample-data viser at 825 af 826 rækker er `'approved'` med `reviewed_by: null` (ingen reviewer-id sat). Det betyder enten:
- Approval gik via direct SQL/admin tool (ikke gennem hook), eller
- En ældre version af hook'en auto-approvede, eller
- Manuel database-flip i UI'et

Mismatch mellem observeret state og kode-flow.

### Triggers på absence

`recalculate_coaching_on_absence` AFTER INSERT/UPDATE — KUN for onboarding-coaching-tasks, ikke løn. Migration `20251221163140`:
```sql
IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR
   (TG_OP = 'UPDATE' AND NEW.status = 'approved') THEN
  PERFORM recalculate_coaching_due_dates_for_employee(NEW.employee_id);
END IF;
```

Ingen trigger opdaterer payroll-cache eller andet ved fraværs-ændring.

---

## 7. Sådan ender tid i lønberegning

To primære hooks. Begge læser personnel_salaries for at finde løntype og hourlyRate/monthlySalary.

### `useStaffHoursCalculation` — staff-medarbejdere

`src/hooks/useStaffHoursCalculation.ts:1-319`.

Inputs:
- `periodStart`, `periodEnd`, `staffIds[]`, `useNewAssignments?`, `clientId?`

Steps:
1. Hent salaries: `WHERE salary_type='staff' AND is_active=true`.
2. Hent team-medlemskab, shift-hierarki, individuelle shifts, approved absences, time_stamps.
3. Bestem hours_source pr. medarbejder:
   - Hvis `useNewAssignments=true`: kald `resolveHoursSourceBatch(staffIds, clientId)` → `employee_time_clocks`-lookup.
   - Else: `personnel_salaries.hours_source` (default `'shift'`).
4. **Hvis månedsløn (monthlySalary > 1000, ingen hourlyRate)**:
   - Pro-rata: tæl arbejdsdage i periode vs. måned (skal matche en standard_shift_day_of_week).
   - `baseSalary = monthlySalary × prorationFactor`, `vacationPay = baseSalary × VACATION_PAY_RATES.STAFF`.
   - `workedHours` = arbejdsdage (tal — bemærk, IKKE timer).
5. **Hvis timeløn**:
   - Hvis `hours_source === 'timestamp'`: sum af `(co - ci)/60 - break_minutes` fra `time_stamps`.
     - Bruger **RÅ `clock_in`/`clock_out`** (linje 232-240), **IKKE `effective_*`**.
   - Hvis `hours_source === 'shift'`:
     - For hver dag i periode:
       - Hvis approved absence af type ≠ `'sick'`: skip dag.
       - **Sygdom skipper IKKE — dvs. syge-dage tæller som arbejde** (forskel fra assistant, se nedenfor).
       - Find vagt: `shift`-tabellen → `employee_standard_shifts` → `team_standard_shifts`.
       - Beregn timer via `calculateHoursFromShift(start, end)` (auto 30-min pause hvis > 6 timer).
     - Anti-double-counting hvis `clientId` sat OG shift-mode: træk timer for andre klienter's `time_stamps` fra.
   - `baseSalary = totalHours × hourlyRate`, `vacationPay = baseSalary × VACATION_PAY_RATES.STAFF`.

### `useAssistantHoursCalculation` — assisterende teamleders

`src/hooks/useAssistantHoursCalculation.ts:1-308`. Næsten identisk MEN:

- Filter `salary_type='assistant'` (ikke `'staff'`).
- **Ingen timestamp-mode** — kun shift-mode.
- **Alle absence-typer skipper** (også sygdom — anderledes fra staff).
- Bruger `VACATION_PAY_RATES.ASSISTANT` (12,5% jf. CLAUDE.md).
- Ingen `clientId`-parameter eller anti-double-counting.

### Drift mellem hooks: sygdom

- Staff hourly i shift-mode: sygdom giver løn (skipper kun ikke-sick fravær).
- Assistant i shift-mode: sygdom giver IKKE løn (alle fravær skipper).

Reglen er ikke dokumenteret nogen steder jeg har set. Begge er antagelig bevidste, men forskellen er let at overse.

### Drift mellem hooks: rate-detektion

Begge hooks bruger `HOURLY_RATE_THRESHOLD = 1000`:
```ts
const effectiveHourlyRate = hourlyRate > 0 
  ? hourlyRate 
  : (monthlySalary < HOURLY_RATE_THRESHOLD ? monthlySalary : 0);
```

Hvis `monthly_salary < 1000` (fx 800) bliver det fortolket som timesats — dvs. en medarbejder med `monthly_salary=800` får 800 kr/time. Tilsigtet eller bug? Magic number `1000` er hardkodet to steder.

### `useEffectiveHourlyRate` — ikke løn, men effektiv kr/time

`src/hooks/useEffectiveHourlyRate.ts:1-192`. Bruges som diagnostik på dashboards.

Strategi-hierarki (3 niveauer, fallback hvis tom):
1. `time_stamps` for perioden → sum (clock_out - clock_in) ÷ 60.
2. `shift` for perioden → parse `start_time/end_time` med basic Number.split (`useEffectiveHourlyRate.ts:127-145`).
3. `employee_master_data.standard_start_time` (text `"8.00-16.30"`) parset via lokal helper `parseStandardHoursPerDay` (`useEffectiveHourlyRate.ts:20-30`) — default 8 timer/dag hvis intet.

**Tre forskellige hours-kilder. Ingen reference til `useStaffHoursCalculation` eller helpers.**

Break-deduktion:
- Bruger `kpi_definitions.example_value` for slug `'break_deduction_per_day'` — default 1 time pr. dag.
- Trækker `workDays × breakDeductionPerDay` fra `totalHours`.
- Kan justeres via UI på KPI-definitionen.

Formel: `hourlyRate = totalCommission / (totalHours - workDays × breakDeduction)`.

Bruger `usePrecomputedKpis(["live_sales_hours", "total_commission"], "payroll_period", "employee", employeeId)` — så commission og hours kan komme fra KPI-cache (i stedet for live).

### `useSellerSalariesCached` — sælgerløn

Aggregér på tværs (bygger oven på sales-aggregat-rapporten, se `beregningsmotor-deep-dive.md`). Tid er IKKE primær input — sælgere får commission, ikke timeløn. `useSellerSalariesCached` trækker dog også `extra_work`-data ind? — nej, `grep` bekræfter at sælger-løn ikke læser `extra_work`-tabellen.

---

## 8. Edge functions og cron-jobs

### `calculate-kpi-values` (cron, hvert minut)

Migration `20260116023141`. `cron.schedule('calculate-kpi-values', '* * * * *', $$SELECT trigger_kpi_calculation()$$)`.

`trigger_kpi_calculation()` HTTP-poster til `/functions/v1/calculate-kpi-values`.

`calculate-kpi-values/index.ts:1894-1950` har en `calculateHoursForEmployees`-funktion. **Den er broken på flere måder:**

1. Bruger `time_stamps.date === dateStr` (`linje 1928`) — der findes IKKE en `date`-kolonne på `time_stamps` (kun `clock_in` timestamp). Så match'et fejler altid; timestamp-mode returnerer 0 timer.
2. Parsar `clock_in` og `clock_out` som `"HH:MM"` med `.split(":")` (`linje 1930-1931`) — men feltet er en ISO timestamp. Output bliver garbage.
3. Læser kun `primaryShifts` (team-template) — ignorerer både `shift`-tabellen og `employee_standard_shifts`. Så manager-tildelte custom-vagter er usynlige for KPI-hours.
4. Bruger `empShift.hours_source || "shift"` — det er `team_standard_shifts.hours_source`, IKKE `personnel_salaries.hours_source`. To forskellige kilder for samme felt-navn.
5. Hardkoder break: `rawHours > 6 ? 30 : 0` — magic numbers genkopieret (samme værdier som `hours.ts`, men inline).

Resultat: KPI-cache for hours er **ubrugelig** i timestamp-mode og ufuldstændig i shift-mode. Hvis sælger-dashboards bruger `live_sales_hours`-KPI'en til kr/time-beregning, får de forkerte tal.

### `tv-dashboard-data`

`tv-dashboard-data/index.ts:1780-1810` har næsten identisk kode. Samme broken pattern (`ts.date`, ingen individuelle shifts, broken parsing). Samme konsekvens.

### `calculate-kpi-incremental`

`calculate-kpi-incremental/index.ts` (308 linjer) bruger `getPayrollPeriod()` men beregner IKKE timer — den agregerer salg/commission. Hours-felter eksisterer ikke i denne incrementel-vej.

### `snapshot-payroll-period`

`snapshot-payroll-period/index.ts` (332 linjer). **Beregner IKKE timer** — kun salg/provision/revenue aggregeret over en lønperiode. Ingen brug af `time_stamps`, `shift`, `absence_request_v2`. Snapshotter til `kpi_period_snapshots` for udbetalingshistorik.

Kører ikke som cron i migrations — `supabase/config.toml` har `verify_jwt = false` på funktionen men ingen schedule. Antageligt kaldt manuelt eller fra en anden cron.

### KPI- og leaderboard-triggers

System-snapshot viser tre `trigger_*`-funktioner der HTTP-poster til edge functions:
- `trigger_kpi_calculation()` → `/calculate-kpi-values` med `body: {"chunk": "kpis"}`
- `trigger_kpi_incremental()` → `/calculate-kpi-incremental` med `body: {}`
- `trigger_leaderboard_calculation()` → `/calculate-kpi-values` med `body: {"chunk": "leaderboards"}`

De er SECURITY DEFINER og hardkoder URL + Bearer-token i selve PL/pgSQL-bodyen (oprindeligt migration brugte `current_setting()`, men live-version har hardkodet token — verificeret i snapshot linje 359865).

### Andre cron-jobs

`enrichment-healer` (kun for pricing/sales — uden for tid-domænet), `check-compliance-reviews` (compliance/AMO, ikke tid). Ingen cron rør tid-tabeller direkte.

### Trigger-oversigt for tid-tabeller

| Tabel | Triggers |
|---|---|
| `time_stamps` | `update_time_stamps_updated_at` (BEFORE UPDATE) |
| `time_entry` | `update_time_entry_updated_at` (BEFORE UPDATE) — død |
| `shift` | `update_shift_updated_at` (BEFORE UPDATE) |
| `team_standard_shifts` | `update_team_standard_shifts_updated_at` (BEFORE UPDATE) |
| `absence_request_v2` | `update_absence_request_v2_updated_at` + `recalculate_coaching_on_absence` (AFTER INSERT/UPDATE OF status, start_date, end_date) |
| `employee_absence` | (intet — død tabel) |
| `employee_time_clocks` | (intet) |
| `extra_work` | `update_extra_work_updated_at` (BEFORE UPDATE) |
| `personnel_salaries` | `update_personnel_salaries_updated_at` |
| `event_attendees` | `update_event_attendees_updated_at` |

**Ingen trigger** beregner timer, opdaterer caches, eller validerer business-regler ved INSERT/UPDATE på tid-data.

---

## 9. RPC'er der rør tid

Søgt i system-snapshot (`docs/system-snapshot.md`) og migrations.

| RPC | Domæne |
|---|---|
| `get_personal_daily_commission` | Sum af mapped_commission GROUP BY DATE (salg, ikke timer) |
| `recalculate_coaching_due_dates_for_employee` | Onboarding-tasks (ikke løn) |
| `create_onboarding_coaching_tasks_for_employee` | Onboarding-tasks |
| `is_vagt_admin_or_planner` | RLS-hjælper (auth check) |
| `can_view_employee` | RLS-hjælper |
| `get_current_employee_id` | RLS-hjælper |
| `is_teamleder_or_above` | RLS-hjælper |

**Ingen RPC beregner faktisk arbejdstid.** Al timer-logik ligger i frontend (`hours.ts`, `useStaffHoursCalculation`, `useAssistantHoursCalculation`, `useTimeStamps.calculateEffectiveTimes`) eller i broken edge function-kode (`calculate-kpi-values`, `tv-dashboard-data`).

---

## 10. Konkrete inkonsistenser og bugs

1. **`useStaffHoursCalculation` ignorer manager-redigeringer**: Læser RÅ `clock_in`/`clock_out` (`useStaffHoursCalculation.ts:232-240`), ikke `effective_clock_*`. Manager der retter en stempling så medarbejder ikke får for meget løn, ændrer ikke det udbetalte beløb.

2. **Duplikate stempelur-UI'er**: `/time-stamp` og `/my-time-clock`. Begge live, begge skriver samme tabel via samme hook. Forskellen er kun feature-gating på `employee_time_clocks`-config.

3. **Død `time_entry`-vej**: Egen tabel, fire hooks, en component, en hel rute (`/shift-planning/time-tracking`). Aldrig nogen rækker. Manager der åbner Time Tracking-siden ser altid tom liste.

4. **Død `employee_absence`-vej**: Egen tabel, fem hooks, en rute (`/vagt-flow/...time-off-requests`). Aldrig nogen rækker. Permission-controlled side viser konsistent tom.

5. **TypeScript-DB-mismatch på fravær**: TS-interface lister `'vacation' | 'sick' | 'no_show' | 'day_off'` men DB-enum'en `absence_type_v2` har kun `'vacation', 'sick'`. INSERT med extras fejler runtime.

6. **`no_overlapping_shifts`-constraint er misvisende**: Er en UNIQUE på `(employee_id, date, start_time)` — fanger kun identiske start-tider. Reel tids-overlap er IKKE blokeret.

7. **Edge function-hours-beregninger er broken**: `calculate-kpi-values` og `tv-dashboard-data` har samme tre bugs (forkert felt `ts.date`, forkert string-parse af ISO timestamp, ignorerer individuelle shifts). KPI-hours i cache er upålidelige.

8. **`team_shift_breaks` læses ikke**: 22 rækker med pause-tider pr. shift-template. Ingen kode rør dem. Datasæt uden konsumenter.

9. **Fem pause-modeller med tre default-værdier**:
   - 0 min (non-hourly clock-in)
   - 30 min (auto i `hours.ts` ved vagt > 6 timer)
   - 60 min (hourly clock-in default + DB column default + clamping-default)
   - 1 time (`kpi_definitions.break_deduction_per_day`, fleksibel)
   - `team_shift_breaks` (eksplicit pr. template — ubrugt)

10. **Tre måder at finde "antal timer pr. dag"**:
    - `useEffectiveHourlyRate.parseStandardHoursPerDay` (parser `"8.00-16.30"`)
    - `useTimeStamps.parseWorkingHours` (parser samme felt, lidt anderledes)
    - `useStaffHoursCalculation`-shift-loop (henter fra `team_standard_shift_days`)

11. **`employee_master_data.standard_start_time` er TEXT**: format `"8.00-16.30"`. Ikke en time-kolonne, ikke joinet med shift-templates. Parses inline med regex/split. **Hver hook implementerer sin egen parser**.

12. **Sygdom-håndtering inkonsistent**: Staff får løn for sygedage, assistant gør ikke. Begge regler er hardkodede i hooks uden DB-konfiguration.

13. **Magic number `HOURLY_RATE_THRESHOLD = 1000`** kopieret i to filer (`useStaffHoursCalculation.ts:19`, `useAssistantHoursCalculation.ts:7`). `monthly_salary < 1000` betyder "treat as hourly rate".

14. **Hardkodet lønperiode 15.→14**: `_shared/date-helpers.ts:78-90`. Ingen `pay_periods`-tabel, ingen `period_locks`, ingen DB-validation. CLAUDE.md flag bekræftet.

15. **`employee_master_data.salary_type` vs `personnel_salaries.salary_type`** har FORSKELLIGE værdisæt:
    - `employee_master_data`: `"provision" | "fixed" | "hourly" | null`
    - `personnel_salaries`: `"staff" | "assistant" | "team_leader" | "seller"?`
    - Begge kaldes `salary_type`, men beskriver forskellige ting (lønnings-model vs medarbejder-rolle).

16. **To hours_source-felter**:
    - `personnel_salaries.hours_source` (text, default 'shift') — LEGACY
    - `team_standard_shifts.hours_source` (text, default 'shift') — bruges af KPI-edge-functions
    - `employee_time_clocks.clock_type` (enum) — den NYE source-vælger
    - Hooket `useStaffHoursCalculation` vælger mellem (1) og (3) via `useNewAssignments`-flag.

17. **Approved `extra_work`-rækker indgår ikke i timer**: Ingen kode læser tabellen for løn. Approval-flow uden konsekvens. **Hvis en medarbejder anmoder om 2 timers overarbejde og det godkendes, ændrer det INTET ved deres løn.**

18. **`useTimeOffRequests`-hooket joiner på et felt der ikke findes**: `employee:employee_id (id, full_name, email, team)` — `employee_master_data` har ikke kolonnerne `full_name`, `email`, `team`. Ville fejle hvis tabellen havde rækker.

19. **`absence_request_v2` sample viser 825 af 826 har `status='approved'` med `reviewed_by=null`**: Approval gik ikke via `useUpdateAbsenceRequest`-hooket (som sætter reviewer_id). Direkte DB-flip eller ældre auto-approve er forklaringen.

20. **`payroll_error_reports` start-date matcher ikke `getPayrollPeriod`**: Sample-rækker har `payroll_period_start = "2026-02-14"` (14th) men helperen returnerer 15th. UI-eller-bruger off-by-one.

21. **Duplikate indexes på `time_stamps`**: `idx_time_stamps_employee_clock_in` og `idx_time_stamps_employee_clockin` — næsten sikkert duplikat-indeks med stavefejl.

22. **Hardkoded URL og Bearer-token i DB-funktioner**: `trigger_kpi_calculation`, `trigger_kpi_incremental`, `trigger_leaderboard_calculation` har hardkodet hele URL'en og JWT'en i deres PL/pgSQL body. Drift fra `current_setting()`-tilgangen i den oprindelige migration.

---

## 11. Hvor sandheden om "arbejdstid" reelt lever

Rangordning fra mest til mindst pålidelig:

1. **`time_stamps.clock_in` + `clock_out`** (RÅ tidspunkter) — det er hvad `useStaffHoursCalculation` bruger til løn i timestamp-mode.
2. **`shift.start_time` + `end_time` på en specifik dato** — næstmest pålidelig kilde, bruges i shift-mode.
3. **`team_standard_shift_days` for dagens ugedag** — fallback hvis individuelt shift mangler.
4. **`time_stamps.effective_*`** — kun til UI-visning. Manager-redigeringer her påvirker ikke løn.
5. **`employee_master_data.standard_start_time`** — TEXT-felt, kun fallback for `useEffectiveHourlyRate`-dashboards.
6. **KPI-cache (`live_sales_hours`)** — beregnet af broken edge function. Upålidelig.

---

## 12. Hvad er ikke verificeret

- **Faktisk antal rækker i prod**: Snapshots viser sample-data og `Approx rows: -1` for flere tabeller (typisk PII-tabeller). De konkrete tal er kun for de tabeller hvor snapshot rapporterer det.
- **Om cron `calculate-kpi-values` faktisk kører hvert minut**: Migration siger ja, men jeg kan ikke verificere live cron.job-state via MCP (peger på 2.0).
- **Om `payroll_error_reports`-status-overgange triggerer noget**: ingen kode jeg har fundet, men UI'er er ikke gennemgået i detalje.
- **Om `useStaffHoursCalculation` med `useNewAssignments=true` reelt er rullet ud**: feature flag-state ikke tjekket.
- **Hvilken version af `enrich_fm_sale` der reelt kører i prod** (nævnt i pricing-rapporten, samme tvivl gælder for tid-relaterede triggere fra de seneste migrations).

---

## 13. Hurtig referencetabel

| Spørgsmål | Svar |
|---|---|
| Hvor stemples ind/ud? | `time_stamps` via `useTimeStamps.clockIn`/`clockOut` |
| Hvor planlægges vagter? | `shift` (individuelt) + `team_standard_shifts`+`team_standard_shift_days` (templates) + `employee_standard_shifts` (override) |
| Hvor registreres fravær? | `absence_request_v2` (live), `employee_absence` (død) |
| Hvor registreres overtid? | `extra_work` (men feeder IKKE løn) |
| Hvor bestemmes om man bruger time_stamps eller shift? | `employee_time_clocks.clock_type` (ny) eller `personnel_salaries.hours_source` (gammel) |
| Hvor beregnes løn fra timer? | `useStaffHoursCalculation`, `useAssistantHoursCalculation` |
| Hvor er pausen defineret? | Fem steder, tre værdier (0, 30 min, 60 min, 1 time, [ubrugt: team_shift_breaks]) |
| Hvor er lønperiode defineret? | `_shared/date-helpers.ts` hardcodet 15.→14. Ingen DB-tabel. |
| Triggers der rør tid? | Kun `recalculate_coaching_on_absence` (onboarding, ikke løn). Resten er `_updated_at`. |
| Cron-jobs der rør tid? | `calculate-kpi-values` hvert minut (men hours-beregningen er broken) |
| Hvor er overlap-validering? | Kun UI-niveau. DB UNIQUE-constraint fanger kun identiske start_times. |

---

## 14. Konklusion (faktuel)

Stempelur-/tidssystemet har:
- **2 parallelle stempelur-implementationer** (én aktiv, én tom-men-rute), forskellige tabeller, forskellige hooks.
- **2 parallelle fraværssystemer** (én aktiv med 826 rækker, én tom rest af FM-merge).
- **2 parallelle "hvilken hours-source"-konfigurations-tabeller** (`personnel_salaries.hours_source` legacy, `employee_time_clocks` ny).
- **5+ skrive-veje for arbejdstid**, men kun **1 reel læse-vej for løn** (`useStaffHoursCalculation`).
- **0 RPC'er** der beregner arbejdstid. Al business-logik i frontend eller broken edge-kode.
- **0 triggers** der validerer eller cacher arbejdstid.
- **`extra_work` med approval-flow, men uden lønintegration** — udført arbejde forsvinder ud i blå luft.
- **Hardkodede konstanter** (pause-tærskler, lønperiode-grænser, magic 1000-tærskel) spredt over 5+ filer.
- **Manager-redigeringer af `effective_*` ændrer UI-visning men ikke løn-output**.

Det fungerer fordi: 100+ medarbejdere på månedsløn ikke har mange edge-cases, sælgere får commission (ikke timeløn), og staff/assistants har enkle deltidsmønstre. Det ser stabilt ud udefra, men kompleksiteten er fordelt på 12+ kodefiler og 9 tabeller hvoraf 3 er døde.

