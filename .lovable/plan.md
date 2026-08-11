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

## Løsning

1. **Datarettelse (rød zone – kræver din godkendelse):** sæt Sebastians `position_id` til `454291a1…` (Assisterende Teamleder TM), så rolle og jobtitel stemmer. Overvej samtidig at sætte hans `team_id` til Eesy TM.
2. **Rod-årsagen:** udvid `auto_set_position_id` til også at re-mappe `position_id`, når `job_title` ændres til en anden kendt stilling (kun når den nye titel matcher en række i `job_positions`, og kun hvis titlen faktisk er ændret). Så opstår samme skævhed ikke igen ved fremtidige forfremmelser.
3. **Efterkontrol:** find andre medarbejdere hvor `job_title` og `job_positions.name` for `position_id` ikke stemmer, og rapportér listen til dig før eventuelle rettelser (ingen masseopdatering uden din beslutning).

## Teknisk

- Migration: `CREATE OR REPLACE FUNCTION public.auto_set_position_id()` med `search_path = public`, uændret trigger-binding.
- Datarettelse via targeted UPDATE på ét `employee_master_data`-id.
- Ingen ændringer i `permissionKeys.ts`, `DailyReports.tsx` eller RLS — adgangen virker, når rollen er korrekt.
- Efter rettelse skal Sebastian logge ud/ind (eller reload), da rettigheder caches pr. session.
