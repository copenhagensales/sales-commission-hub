# Guldmedalje til den første der når sit individuelle target

På "TDC Månedsmål" får den første sælger, der når sit individuelle mål i en måned, en guldmedalje til højre for navnet og en guldfarvet progress bar. Pladsen låses i databasen, så den ikke kan overhales senere — også hvis andre senere overhaler i procent.

## Sådan virker det

1. Boardet henter data som i dag (via TV-edge functionen, så det også virker på skærme uden login).
2. Serveren tjekker, om der allerede er registreret en "første målopnåer" for måneden på boardet.
   - Findes der en: den returneres uændret. Ingen kan overtage den.
   - Findes der ingen, og en sælger har nået sit mål: den sælger låses som første målopnåer (kun én gang, atomisk).
3. Boardet viser guldmedalje-ikon efter navnet og guldfarvet bar for den låste sælger. Alle andre beholder nuværende farver.

## Teknisk

Ny tabel `public.monthly_goal_first_achievers` (rød zone: nyt skema + RLS):

```text
id             uuid pk default gen_random_uuid()
board_key      text not null      -- 'tdc-monthly-goal' (klar til Relatel senere)
month_key      text not null      -- 'YYYY-MM'
employee_id    uuid not null      -- employee_master_data.id
employee_name  text not null      -- navn på låsningstidspunktet
achieved_count numeric not null
goal           numeric not null
achieved_at    timestamptz not null default now()
UNIQUE (board_key, month_key)     -- sikrer at kun én kan låses pr. måned
```

Grants + RLS i samme migration:
- `GRANT SELECT ON ... TO authenticated, anon` (boardet vises også i TV-mode uden login), `GRANT ALL TO service_role`.
- RLS enabled: SELECT-policy for `anon` + `authenticated`. Ingen INSERT/UPDATE/DELETE-policies — kun edge functionen (service role) skriver.

`supabase/functions/tv-dashboard-data/index.ts` (action `tdc-monthly-goal`):
- Beregner sælgernes count præcis som i dag (samme fiber-vægtning, samme e-mail-matching, samme produkt-ekskludering) — ingen ændring i tællelogikken.
- Læser evt. eksisterende række for `('tdc-monthly-goal', månedsnøgle)`.
- Findes ingen, og mindst én sælger har `count >= goal` (goal > 0): indsæt den med højeste progress via `INSERT ... ON CONFLICT (board_key, month_key) DO NOTHING`, læs derefter rækken igen (så samtidige kald altid ender på samme vinder).
- Returnerer `firstAchiever: { employeeId, employeeName, achievedAt } | null` i payloaden.
- Individuelle mål er i frontend-config i dag, så målet sendes med i requesten (query-param) eller målafgørelsen sker ud fra samme config duplikeret server-side. Vi sender målene med fra klienten som en kompakt liste `employeeId:goal`, så der kun findes én kilde til målene (`src/config/tdcMonthlyGoals.ts`).

Frontend:
- `src/hooks/useTdcMonthlyGoal.ts`: sender målene med, læser `firstAchiever` og sætter `isFirstAchiever` på den matchende sælger i returdata.
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`: guldmedalje-ikon (lucide `Medal`, amber) efter navnet, og guld/amber gradient-bar i stedet for den normale statusfarve for den sælger.

Ingen ændringer i pricing, løn, provision, rapporter eller eksisterende salgsdata. Relatel-boardet ændres ikke i denne omgang (tabellen er dog forberedt via `board_key`).
