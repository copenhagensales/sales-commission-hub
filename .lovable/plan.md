# Sebastian mangler adgang til dagsrapporter

## Diagnose (bekræftet i data)

Sebastian Viktor Bangsbo Petersen er korrekt tilknyttet som assisterende leder:
- `team_assistant_leaders` → team `Eesy TM` (0cb1b854…) ✔

Men hans rolle er stadig sælger:
- `employee_master_data`: `job_title = 'Assisterende Teamleder TM'`, men `position_id = 729194f5…` = **Salgskonsulent** → `system_role_key = 'medarbejder'`
- `role_page_permissions`: `medarbejder` + `menu_reports_daily` → `can_view = false`, `visibility = 'self'`
- `assisterendetm` + `menu_reports_daily` → `can_view = true`, `visibility = 'team'`

Dermed får han slet ikke adgang til Dagsrapporter, og selv hvis siden åbnes, filtrerer `DailyReports.tsx:246-251` teams væk fordi scope er "egen".

Årsagen til at `position_id` ikke fulgte med: DB-triggeren `auto_set_position_id` sætter kun `position_id`, når feltet er **NULL** — den opdaterer ikke ved skift af jobtitel. Hans `team_id` er også NULL (uden betydning for dagsrapporter, men relevant andre steder).

## Løsning (kun Sebastian nu)

1. **Datarettelse for Sebastian:** sæt hans `position_id` til `454291a1…` (Assisterende Teamleder TM), så rolle matcher jobtitlen og han får `visibility = 'team'` på dagsrapporter.
2. Ingen ændring af trigger, ingen masse-oprydning, ingen kodeændringer i denne omgang (kan tages senere hvis du ønsker det).

## Teknisk

- Én targeted UPDATE på `employee_master_data` for id `f14d4afc-97e4-41f8-bc64-2d59c858914d`.
- `team_id` lades urørt — hans lederadgang kommer fra `team_assistant_leaders` (Eesy TM), som dagsrapporterne læser.
- Ingen ændringer i `permissionKeys.ts`, `DailyReports.tsx` eller RLS.
- Efter rettelsen skal Sebastian logge ud/ind (eller reloade), da rettigheder caches pr. session.

