# Holdkonkurrence i venstre kolonne på Superliga Live

Venstre kolonnes to roterende scener viser i stedet holdkonkurrencens placering (lollipop-graf "TIL #1" som på billedet). Ingen ændringer i point, provision, løn eller den individuelle konkurrence.

## Sådan bliver det

```text
Scene "Bevægelser"                 Scene "Statistik & Records"
- Største spring op / fald          - Ligaens total i dag / Længste streak
- Mest tjent sidste time            - Gennemsnit per division
- [Dagens Top 5]  -> HOLDKONKURRENCE   - [Højeste provision + Team Ranking] -> HOLDKONKURRENCE
```

- Sektionen "Dagens Top 5" erstattes af holdkonkurrencens placering.
- Sektionerne "Højeste provision i sæsonen" og "Team Ranking" erstattes af samme holdkonkurrence-visning.
- Visningen er en lollipop-graf: hold på y-aksen, provision som farvet linje + prik, og til højre "fører" for #1 og afstand (−111.068 kr) for de øvrige. Overskrift "PROVISION" / "TIL #1" som på billedet.
- Reglerne er de samme som på Hold-fanen: alle hold deltager, "Stab" udelades, FM-holdene tælles under "Fieldmarketing", og kun holdets 5 bedste sælgeres provision tæller.
- Før holdkonkurrencen er startet (eller hvis der ingen data er) vises en diskret linje i stedet for grafen.
- Mobilfanerne "Bevægelser" og "Records" følger automatisk med, da de bruger samme scener.

## Teknisk

TV-boardet henter alt via edge function `tv-league-data` (anon, service role internt). Holdkonkurrencen kan derfor ikke bruge frontend-hooken `useLeagueTeamCompetition`, som kræver login.

- `supabase/functions/tv-league-data/index.ts`: nyt felt `teamCompetition` i payloaden. Beregnes med samme logik som hooken:
  - `get_league_team_provision(p_start, p_end)` for sæsonens holdkonkurrence-periode (kvalifikationens startdato → i dag/sæsonslut, dansk tid).
  - Hold og medlemmer fra `employee_team_attribution`; `Stab` filtreres fra; alias-mapping YouSee FM / Yousee FM / Eesy FM → Fieldmarketing.
  - Pr. hold: sortér medlemmer på provision, tag top 5, summér → holdets total. Sorteret liste med rangering returneres.
  - Læses read-only; ingen ændring af eksisterende felter, RPC'er eller beregninger.
- Ny komponent `src/components/league/TvTeamCompetitionBars.tsx` (præsentation): lollipop-graf med holdnavn, farvet linje, prik, "fører"/afstand til #1. Genbruger farvepaletten og stilen fra `TeamDistanceChart`.
- `src/pages/tv-board/TvLeagueDashboard.tsx`:
  - Udvid `LeaguePayload` med `teamCompetition`.
  - `SceneMovements`: erstat "Dagens Top 5"-blokken med `TvTeamCompetitionBars`.
  - `SceneRecords`: erstat "Højeste provision i sæsonen" og "Team Ranking" med `TvTeamCompetitionBars`; behold total-i-dag/streak og divisionsgennemsnit.
  - Ubrugte props (`todayTopEarners`, `teamRankings`) fjernes fra de to scener; `teamRankings` bliver ikke fjernet fra edge functionen, hvis den bruges andre steder — det tjekkes før fjernelse.
- Zone: grøn/gul (UI + read-only udvidelse af TV-edge function). Ingen migration, ingen RLS-, pricing- eller lønændringer.
