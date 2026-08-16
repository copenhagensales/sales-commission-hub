# Holdkonkurrence i Superligaen (Hold-fanen)

Én samlet holdkonkurrence pr. sæson, som kører over hele sæsonperioden efter kvalifikationen (Sæson 4: 17/8–28/9). Ingen ændring af den individuelle konkurrence, point, divisioner eller løn.

## Regler

- Hvert hold deltager automatisk — ingen tilmelding. Hold = `teams` via `team_members`, undtagen "Stab".
- Kun de 5 sælgere med højest provision (kr) på holdet i perioden tæller i holdets total. Øvrige ignoreres, og top 5 opdateres løbende (en sælger tæller med, så snart han er i top 5).
- Holdspillet kører automatisk for enhver ny sæson, men viser først data efter kvalifikationsrunden (fra `start_date`).
- Under kvalifikationen viser Hold-fanen en "starter 17/8"-tilstand med nedtælling, ingen tal.

## Sådan ser Hold-fanen ud (som screenshot)

```text
[ Individuel ] [ Hold ]   SÆSON 4 · Holdkonkurrence   Runden slutter om ...
Kvalifikationsrunde · 5 hold · 42 sælgere

+-------------------- PODIUM (2 · 1 · 3) --------------------+
|   Fieldmarketing        TDC Erhverv        Relatel         |
|     178.650 kr           256.800 kr        132.300 kr      |
+------------------------------------------------------------+

+---- "Til #1" lollipop-graf: alle hold, provision + afstand ---+

+---- Tabel: # | HOLD | PROVISION | I DAG (+kr, ±pladser) | v ---+
     Udvidet række: holdets top 5 sælgere med provision
```

- Topboksen (grøn status, Sæson-nr, nedtælling, sæsonvælger) bevares uændret; undertitlen bliver "Holdkonkurrence · <måned>" og status-linjen viser antal hold og antal tællende/aktive sælgere.
- Podium for top 3, lollipop-graf med afstand til #1 ("fører" / −78.150), og tabel med rangering, provision, dagens tilvækst og pladsændring i dag.
- Rækkerne kan foldes ud og viser holdets 5 tællende sælgere (navn som "Kasper M" via `formatPlayerName`) med deres provision.

## Teknisk

Alt beregnes read-only i frontend — ingen nye tabeller, ingen migration, ingen ændring af edge functions eller pricing/løn.

- Ny hook `src/hooks/useLeagueTeamCompetition.ts`:
  - Periode = sæsonens `start_date` → `end_date` (fallback: i dag hvis sæsonen ikke er slut).
  - Provision pr. medarbejder via `get_sales_aggregates_v2` (`p_group_by: "employee"`) for perioden, og en ekstra kald for perioden minus i dag (til dagsdelta og pladsændring). Dagens tal genbruger mønsteret fra `useLeagueTodayProvision`.
  - Medarbejder → hold via `team_members` + `teams` (Stab filtreres fra); navne fra `employee_master_data`.
  - Sorterer hver holds medlemmer på provision, tager top 5, summerer → holdets total. Beregner rangering nu vs. rangering uden i dag → pladsændring.
  - React Query, `staleTime` 60s, `refetchInterval` 120s, query-key `"league-team-competition"`.
- Nye komponenter i `src/components/league/`: `TeamCompetitionView.tsx` (samler), `TeamPodium.tsx`, `TeamDistanceChart.tsx`, `TeamStandingsTable.tsx` — genbruger eksisterende design-tokens og stil fra `PremierLeagueBoard`/`HallOfFamePodium`.
- `src/pages/CommissionLeague.tsx`: erstat placeholderen i `leagueView === "team"` med `<TeamCompetitionView season={season} />`; hero-undertitel og status-tekst tilpasses valgt visning.
- Grøn/gul zone: kun UI + ny read-only hook. Ingen `supabase`-kald i JSX.
