# Eesy FM Månedsmål — kopi af Relatel-boardet, med voice-salg og redigerbare mål

## Hvad der bygges

Et nyt board "Eesy FM Månedsmål" med præcis samme udseende som Relatel Månedsmål: fælles mål med indeks, forventet-markør, dagsbokse for hver dag i måneden, og individuelle mål i to kolonner.

Forskelle:

1. **Tæller voice-salg på Eesy FM** — alle solgte produkter på Eesy FM undtagen "5G Internet". Annullerede og afviste salg tælles ikke med (samme regel som Relatel).
2. **Mål skrives i Stork** — både fælles mål og mål pr. medarbejder gemmes i databasen og kan redigeres direkte på siden af teamledelse og opefter. Mål sættes pr. måned, så historikken bevares måned for måned.
3. **Medarbejderlisten** viser kun sælgere med Eesy FM-salg i måneden — plus dem der har fået et mål, så et nyt mål er synligt fra dag ét.

### Redigering af mål

En "Redigér mål"-knap øverst på boardet åbner et panel med:
- Fælles mål for måneden (ét tal).
- En linje pr. medarbejder på listen med et målfelt.
- Gem-knap. Ændringer slår igennem på boardet med det samme.

Knappen vises kun for dem der har rettighed til det; alle andre ser boardet som læsning. På TV-skærm vises ingen redigering.

## Teknisk

**Database (migration)**
- Ny tabel `board_monthly_goals`: `board_key` (fx `eesy-fm-monthly-goal`), `month_key` (`YYYY-MM`), `employee_id` (NULL = fælles mål), `target_amount`, `created_by`, tidsstempler. Unik nøgle på (`board_key`, `month_key`, `employee_id`) med NULLS NOT DISTINCT, så fælles mål kun findes én gang pr. måned.
- GRANT: `SELECT, INSERT, UPDATE, DELETE` til `authenticated`, `ALL` til `service_role`, `SELECT` til `anon` (TV-boards læser uden login via edge function — kun mål-tal, ingen persondata).
- RLS: læsning for alle; skrivning/opdatering kun via `public.effective_is_teamleder_or_above()`.
- `updated_at`-trigger via eksisterende `update_updated_at_column()`.
- Ingen ændring af eksisterende tabeller, pricing, provision eller salgsdata.

**Edge function `tv-dashboard-data`**
- Nyt action `eesy-fm-monthly-goal` der genbruger `handleMonthlyGoal`-mønstret med Eesy FM klient-id `9a92ea4c-6404-4b58-be08-065e7552d552`.
- Sælgere udledes af salgenes `agent_email` (Eesy FM-teamet har ingen medlemmer; de 18 aktive mails ligger på Fieldmarketing-medarbejdere) via `employee_agent_mapping` → `agents.email` og `employee_master_data.work_email`.
- Mål for måneden læses med fra `board_monthly_goals`.

**Frontend**
- `src/config/eesyFmMonthlyGoals.ts`: sæt med 5G Internet-produkt-id'er der ekskluderes (`88cd756a-3413-4d2c-9c86-4fd3c6dae9a4`, `1e2f6001-c77f-4fe1-a71c-68f9dff5dcfb`) + hjælpefunktion.
- `src/hooks/useEesyFmMonthlyGoal.ts`: kopi af `useRelatelMonthlyGoal` med DB-mål i stedet for config-mål og voice-filter.
- `src/hooks/useBoardMonthlyGoals.ts`: læsning + gem (upsert) af mål med React Query og cache-invalidering.
- `src/pages/dashboards/EesyFmMonthlyGoalBoard.tsx`: kopi af `RelatelMonthlyGoalBoard` plus redigeringspanel (`Dialog` + `Input` fra `@/components/ui`).
- Rute `/dashboards/eesy-fm-monthly-goal` i `AppRouter`, dashboard-post i `src/config/dashboards.ts`, ny permission key til menupunktet (samme mønster som TDC/Relatel Månedsmål), og adgang gives til de roller der i dag ser Relatel Månedsmål.

**Uændret:** Relatel- og TDC-boards, pricing, provision, løn, annulleringer og alle eksisterende hooks.
