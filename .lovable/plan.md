## Løsning B — permanent opt-in flag

### 1. Migration
Tilføj kolonne på `employee_master_data`:
```sql
ALTER TABLE public.employee_master_data
  ADD COLUMN can_work_fm boolean NOT NULL DEFAULT false;
```
Ingen RLS-ændringer (kolonnen arver eksisterende policies). Ingen backfill — kun opt-in.

### 2. Udvid FM-medarbejder-filtre (3 filer)

Erstat `.eq("job_title", "Fieldmarketing")` med `.or("job_title.eq.Fieldmarketing,can_work_fm.eq.true")` i:

- `src/pages/vagt-flow/Bookings.tsx` linje 153 (`fieldmarketing-employee-ids` query)
- `src/pages/vagt-flow/Bookings.tsx` linje 236 (`vagt-employees-active-master` query)
- `src/pages/vagt-flow/MarketsContent.tsx` linje ~154 (EditBookingDialog employees)

`useVagtEmployees()` i `src/hooks/useVagtEmployee.ts` filtrerer via team_members på Fieldmarketing-teamet — den lader vi være (kræver reelt team-medlemskab, hvilket Thorbjørn ikke har og ikke skal have).

### 3. Checkbox på medarbejder-profilen

I `src/pages/EmployeeDetail.tsx` under grundoplysninger tilføjes en Switch/Checkbox "Kan bookes på FM-vagter" der læser/skriver `can_work_fm`. Kun synlig for brugere der kan redigere medarbejderen (samme gate som resten af redigerings-felterne).

### 4. Ingen påvirkning af beregninger

Alle løn-, DB- og FM Shift Scope-beregninger scoper på `job_title`, ikke `can_work_fm`. Thorbjørn forbliver TM-sælger i alle rapporter — han optræder kun som "bookbar" i FM-booking-UI'en. Salg han taster på Eesy FM-vagter tilfalder Eesy FM-klienten via `client_campaign_id` på salget (som allerede sker for alle FM-salg), ikke via hans job_title.

### 5. Aktivér for Thorbjørn

Efter deploy: `UPDATE employee_master_data SET can_work_fm = true WHERE id = 'a5698dd5-c4e3-4438-94c3-bc8a1837ef61';`

Eller — endnu bedre — du klikker checkboxen på hans profil selv. Så tester vi UI'en samtidig.

### Rækkefølge
1. Migration (kræver din godkendelse i næste skærm)
2. Kode-ændringer i de 4 filer
3. Du tjekker checkboxen på Thorbjørns profil
4. FM-lederen booker ham på en Eesy FM-vagt via `/vagt-flow/booking`
5. Thorbjørn åbner `/vagt-flow/sales-registration` og taster salg

### Scope-bekræftelse
- 1 migration (1 kolonne, ingen data-migration)
- 4 filændringer
- Ingen ændring af pricing, løn, rapport-logik
- Ingen ændring af hans Relatel-arbejde
