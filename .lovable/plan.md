# Slå Eesy FM og YouSee FM sammen til ét Fieldmarketing-hold

Opdelingen af Fieldmarketing i to hold i holdkonkurrencen rulles tilbage. Fieldmarketing bliver igen ét hold, der tæller al provision fra sine medlemmer — præcis som de øvrige hold (TDC Erhverv, United, Eesy TM, Relatel).

## Regler efter ændringen

- Fieldmarketing optræder som ét hold i podium, "Til #1"-grafen og tabellen.
- Al provision fra holdets medlemmer tæller, uanset brand (Eesy FM, YouSee, Hiper m.fl.).
- Top 5-reglen gælder som for alle andre hold: de 5 medlemmer med højest provision tæller i holdets total.
- Antal hold i topboksen går fra 6 tilbage til 5.
- Individuel liga, point, divisioner og løn er uændret.

## Teknisk

Kun frontend, read-only. Ingen migration, ingen ændring af pricing, løn eller edge functions.

- `src/hooks/useLeagueTeamCompetition.ts` (eneste fil):
  - Fjern `TEAM_COMPETITION_SPLIT_TEAM` og `TEAM_COMPETITION_SPLIT_TARGETS`.
  - Fjern `clients`-opslaget og de fire ekstra `get_sales_aggregates_v2`-kald med `p_client_id`, samt `splitData`/`splitMembers`-logikken.
  - Fieldmarketing-medlemmer grupperes igen i den normale `teamMap`-løkke via `team.id`.
  - `fetchProvisionByEmployee` beholdes, men `clientId`-parameteren kan fjernes, da den ikke længere bruges.
- Ingen ændringer i `TeamPodium.tsx`, `TeamDistanceChart.tsx`, `TeamStandingsTable.tsx`, `TeamCompetitionView.tsx` eller `CommissionLeague.tsx`.
- Grøn/gul zone: read-only hook, ingen `supabase`-kald i JSX.
