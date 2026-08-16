# Forhåndsvisning af hold-konkurrencen før sæsonstart

Mål: du skal kunne se hele hold-UI'et (podium, afstands-graf, tabel med top 5) med rigtige tal, allerede nu — uden at ændre hvornår konkurrencen reelt tæller for andre brugere.

## Sådan får du adgang

En skjult preview-tilstand, som kun aktiveres bevidst:

- Åbn `/commission-league?teamPreview=1` og vælg "Hold".
- Uden parameteren ser alle andre stadig "starter 17. august"-beskeden.
- Der vises et tydeligt badge "Forhåndsvisning – data fra kvalifikationsrunden", så tallene ikke misforstås som den rigtige holdkonkurrence.

Ingen rollekrav ud over den eksisterende adgang til Superligaen, og intet gemmes i databasen.

## Hvilke data vises i preview

Perioden for holdkonkurrencen er ikke startet, så preview bruger den periode der findes data for:
sæsonens hidtidige periode (kvalifikationsrunden) fra sæsonstart til i dag. Samme regler i øvrigt:
alle hold undtagen Stab, kun de 5 bedst tjenende sælgere pr. hold tæller, dagsdelta og pladsændring beregnes som normalt.

Når den rigtige periode (17/8–28/9) starter, skifter visningen automatisk til den — preview-parameteren har derefter ingen effekt.

## Teknisk

- `src/hooks/useLeagueTeamCompetition.ts`: tilføj `options?: { preview?: boolean }`. Når `preview` er sat og `hasStarted` er falsk, skal hooket ikke returnere tom tilstand, men beregne på perioden `season.start_date` → i dag (eller kvalifikationsperiodens datoer hvis de findes på sæsonen), og sætte nyt felt `isPreview: true` i returværdien. Query-key udvides med preview-flaget.
- `src/pages/CommissionLeague.tsx`: læs `teamPreview` fra `useSearchParams()` og send flaget videre til hold-visningen.
- `src/components/league/TeamCompetitionView.tsx`: når `isPreview` er sat, vis badge/banner øverst og render podium + graf + tabel i stedet for "starter"-beskeden.

Ingen ændringer i pricing, provision eller løn — kun læsning via den eksisterende `get_sales_aggregates_v2` RPC (grøn/gul zone: præsentation).
