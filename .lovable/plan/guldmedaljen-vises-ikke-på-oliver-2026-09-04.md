# Guldmedaljen vises ikke på Oliver

## Hvad jeg har bekræftet

- Oliver står på 5/5 (100%) på boardet, så han er en gyldig kandidat.
- Tabellen `monthly_goal_first_achievers` er tom (0 rækker) — der er altså aldrig gemt en målopnåer. Uden en gemt række viser boardet ingen medalje, da medaljen kun tændes ud fra databasens låste vinder.
- Koden findes i repoet: action `monthly-goal-first-achiever` (`supabase/functions/tv-dashboard-data/index.ts:343`) og handleren (`:2818-2932`), og hooken `src/hooks/useTdcMonthlyGoal.ts` sender kandidaterne.
- Edge-loggen fra kl. 10:25 viser kaldet `tdc-monthly-goal`, men intet spor af `monthly-goal-first-achiever` og ingen fejl fra handleren.

## Sandsynlig årsag (ikke bekræftet endnu)

Edge functionen `tv-dashboard-data` er efter alt at dømme ikke blevet deployeret efter tilføjelsen af den nye action. Den kørende version kender derfor ikke `monthly-goal-first-achiever`, falder igennem til standardsvaret, og hooken finder ingen `firstAchiever` — helt lydløst, fordi kaldet er pakket i en `try/catch` der bevidst ignorerer fejl.

Jeg kan ikke teste endpointet udefra, fordi functionens auth-gate kræver TV-kode eller en brugersession (mine testkald gav 401), så deployment-hypotesen skal verificeres ved at deploye og derefter måle effekten.

## Plan

1. Deploy `tv-dashboard-data` (ingen kodeændring — koden ligger klar i repoet).
2. Genindlæs `/dashboards/tdc-monthly-goal` som logget ind bruger og verificér:
   - at der nu findes præcis én række i `monthly_goal_first_achievers` for `tdc-monthly-goal` / `2026-09`
   - at rækken peger på Oliver
   - at medaljen og guldbaren vises ud for hans navn
3. Hvis rækken stadig ikke oprettes: læs handlerens fejl i edge-loggen og gør fejlen synlig i stedet for at sluge den — tilføj en `warning` fra hooken, så et brud fremover kan ses på boardet i stedet for at forsvinde.

## Teknisk note

Låsen er `UNIQUE(board_key, month_key)` med `upsert(..., { ignoreDuplicates: true })`, så når først Oliver er gemt, kan pladsen ikke overtages senere i september. Ingen ændringer i løn, pricing, RLS eller salgsdata.
