# Holdkonkurrence i venstre kolonne på Superliga Live

Venstre kolonnes roterende scener viser holdkonkurrencens placering (lollipop-graf "TIL #1" som på billedet) på alle faner. Ingen ændringer i point, provision, løn eller den individuelle konkurrence.

## Sådan bliver det

- Holdkonkurrence-grafen vises i alle fire roterende scener i venstre kolonne: Top 3-overblik, Bevægelser, Statistik & Records og Ligaoverblik.
- Følgende sektioner fjernes helt: "Dagens Top 5", "Højeste provision i sæsonen", "Team Ranking", "Mest tjent sidste time" og "Gennemsnit per division".
- Grafen er en lollipop: hold på venstre side, provision som farvet linje + prik, og til højre "fører" for #1 og afstand (fx −111.068 kr) for de øvrige. Overskrifter "PROVISION" og "TIL #1".
- Reglerne er de samme som på Hold-fanen i Superligaen: alle hold deltager, "Stab" udelades, FM-holdene tælles under "Fieldmarketing", og kun holdets 5 bedste sælgeres provision tæller.
- Er holdkonkurrencen ikke startet, eller er der ingen data, vises en diskret linje i stedet for grafen.
- Mobilfanerne bruger samme scener og følger automatisk med.

## Teknisk

TV-boardet henter alt via edge function `tv-league-data` (anon udefra, service role internt). Holdkonkurrencen kan derfor ikke bruge frontend-hooken `useLeagueTeamCompetition`, som kræver login.

- `supabase/functions/tv-league-data/index.ts`: nyt felt `teamCompetition` i payloaden, beregnet med samme logik som hooken:
  - `get_league_team_provision(p_start, p_end)` for holdkonkurrence-perioden (kvalifikationens startdato → i dag/sæsonslut, dansk tid).
  - Hold og medlemmer fra `employee_team_attribution`; "Stab" filtreres fra; alias-mapping YouSee FM / Yousee FM / Eesy FM → Fieldmarketing.
  - Pr. hold: sortér medlemmer på provision, tag top 5, summér → holdets total; returnér sorteret liste med rangering.
  - Read-only. Eksisterende felter, RPC'er og beregninger røres ikke.
- Ny præsentationskomponent `src/components/league/TvTeamCompetitionBars.tsx`: lollipop-graf med holdnavn, farvet linje, prik og "fører"/afstand til #1. Genbruger farvepalette og stil fra `TeamDistanceChart`.
- `src/pages/tv-board/TvLeagueDashboard.tsx`:
  - Udvid `LeaguePayload` med `teamCompetition`.
  - Indsæt `TvTeamCompetitionBars` i alle fire scener (`overview`, `SceneMovements`, `SceneRecords`, `SceneLeagueOverview`).
  - Fjern blokkene "Dagens Top 5", "Mest tjent sidste time" (Bevægelser), "Højeste provision i sæsonen", "Team Ranking" og "Gennemsnit per division" (Records) — inkl. de nu ubrugte props (`todayTopEarners`, `topLastHour`, `teamRankings`, `records.divisionAverages`-brug) i disse komponenter.
  - Felterne i edge-payloaden bevares (bruges muligvis andre steder — tjekkes med søgning før evt. oprydning).
- Zone: grøn/gul (UI + read-only udvidelse af TV-edge function). Ingen migration, ingen RLS-, pricing- eller lønændringer.
