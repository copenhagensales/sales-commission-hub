# Fieldmarketing deles i Eesy FM og YouSee FM (kun holdkonkurrencen)

Fieldmarketing-holdet erstattes i Hold-fanen af to hold: "Eesy FM" og "YouSee FM". Opdelingen sker pr. salg ud fra kunden, så en sælger kan bidrage til begge hold. Øvrige FM-salg (Hiper, Eesy TM m.fl.) tæller ikke i holdkonkurrencen. Den individuelle salgsliga, point, divisioner og løn ændres ikke.

## Regler

- Eesy FM-salg tæller på holdet "Eesy FM". YouSee-salg tæller på holdet "YouSee FM".
- Alle nuværende medlemmer af Fieldmarketing-holdet er med i begge hold, men bidrager kun med provision fra det pågældende brand.
- Top 5-reglen gælder pr. nyt hold: kun de 5 sælgere med højest provision inden for brandet tæller i holdets total.
- Sælgere uden salg på brandet i perioden vises ikke under holdet.
- Alle andre hold (TDC Erhverv, United, Eesy TM, Relatel) er uændrede og tæller al deres provision.
- Holdtallet i topboksen bliver dermed 6 hold i stedet for 5.

## Sådan ser det ud

Ingen layoutændringer — podium, "Til #1"-grafen og tabellen er som i dag, blot med "Eesy FM" og "YouSee FM" som selvstændige rækker i stedet for "Fieldmarketing". Farvepaletten tildeles automatisk, så de to hold får hver sin farve.

## Teknisk

Kun frontend, read-only. Ingen migration, ingen ændring af pricing, løn eller edge functions.

- `src/hooks/useLeagueTeamCompetition.ts` (eneste ændrede fil):
  - Nye konstanter: `TEAM_COMPETITION_SPLIT_TEAM = "Fieldmarketing"` og en liste over de afledte hold med tilhørende klientnavn: `[{ name: "Eesy FM", client: "Eesy FM" }, { name: "YouSee FM", client: "Yousee" }]`.
  - Slår klient-id'er op via `clients` (match på navn) — ingen hardkodede uuid'er.
  - Kalder `get_sales_aggregates_v2` (`p_group_by: "employee"`) yderligere to gange pr. periode med `p_client_id` sat til hver af de to klienter — både for hele perioden og for perioden minus i dag (til dagsdelta og pladsændring). I alt 4 ekstra kald, samlet i samme query.
  - Fieldmarketing-holdet udelades fra den normale gruppering; i stedet dannes to virtuelle hold-rækker med `team_id` som stabil syntetisk nøgle (`fm-eesy`, `fm-yousee`), medlemmer = FM-medlemmer med provision > 0 på det brand, top 5 og totaler beregnes med samme logik som i dag.
  - `totalPlayers`/`countingPlayers` opdateres, så en sælger kan tælle i begge hold.
- Ingen ændringer i `TeamPodium.tsx`, `TeamDistanceChart.tsx`, `TeamStandingsTable.tsx`, `TeamCompetitionView.tsx` eller `CommissionLeague.tsx`.
- Grøn/gul zone: read-only hook. Ingen `supabase`-kald i JSX.
