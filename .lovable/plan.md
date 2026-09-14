# Visningsnavn: "William S." i stedet for "William B."

## Mål
William Sean Maare Bai (Relatel) skal vises som **William S.** overalt hvor navnet forkortes til "Fornavn X." — TV-boards, leaderboards og dashboards. Hans fulde navn ændres ikke, og løn, provision, salg og attribution røres ikke.

## Hvorfor det ikke bare er én tekst
Det korte navn beregnes i dag ud fra det fulde navn (fornavn + første bogstav i efternavn). Logikken findes i flere kopier:

- `src/utils/formatting.ts` (`getDisplayName`)
- `src/lib/calculations/formatting.ts` (`formatDisplayName`)
- `src/hooks/useCachedLeaderboard.ts`
- `src/pages/CsTop20Dashboard.tsx`
- `supabase/functions/_shared/format-helpers.ts`, `tv-dashboard-data`, `calculate-leaderboard-incremental`, `calculate-kpi-values`

Derfor bliver "Bai" altid til "B.". Løsningen bliver data-drevet, ikke hardkodet i UI: navnet gemmes som en undtagelse i databasen og bruges af én fælles hjælper.

## Sådan gør vi
1. **Database:** nyt felt til kort visningsnavn på medarbejderdata (må være tomt = brug den automatiske forkortelse). Kun Williams række får værdien "William S.". Ingen sletning, ingen ændring af fornavn/efternavn.
2. **Opslag:** en læsefunktion, der returnerer fuldt navn → kort visningsnavn for de få medarbejdere der har en undtagelse. Læsbar for de brugere/boards der i dag kan se leaderboards (inkl. TV-boards).
3. **Fælles hjælper:** én funktion der først slår undtagelsen op og ellers falder tilbage til den nuværende forkortelse. Samme funktion spejles i backend-mappen, så frontend og backend giver samme resultat.
4. **Frontend:** de sider/komponenter der viser korte navne henter undtagelserne via en React Query-hook og bruger den fælles hjælper i stedet for de lokale kopier.
5. **Backend/boards:** de funktioner der beregner leaderboard- og TV-data hentes undtagelserne én gang pr. kørsel og bruger den fælles hjælper. Cachede leaderboards genberegnes, så det nye navn slår igennem.

## Afgrænsning
- Ingen ændring i salg, provision, løn, pricing, roller eller RLS-adgang til persondata.
- Initialer i avataren (WB) følger samme regel og bliver "WS", så visningen er konsistent.
- Steder hvor det fulde navn står (medarbejderkartotek, kontrakter, lønsider) er uændrede.

## Teknisk
- Migration: `ALTER TABLE public.employee_master_data ADD COLUMN IF NOT EXISTS display_name_short text NULL` + kommentar; dataopdatering sætter `display_name_short = 'William S.'` for id `362c2441-4ee3-4c42-a12e-5b657fee4dcb`.
- Ny `SECURITY DEFINER` funktion `get_display_name_overrides()` → `(full_name text, display_name_short text)` med `search_path = public` og `GRANT EXECUTE` til `authenticated` (+ `anon` hvis TV-boards kører uden login).
- `src/utils/formatting.ts`: `resolveDisplayName(fullName, overrides)` og `resolveInitials(fullName, overrides)`; `getDisplayName`/`getInitials` bevares som fallback.
- Ny hook `src/hooks/useDisplayNameOverrides.ts` (React Query, lang staleTime) — komponenter kalder ikke Supabase direkte.
- Konsumenter der opdateres: `CphSalesDashboard.tsx`, `ClientDashboard.tsx`, `CsTop20Dashboard.tsx`, `PowerdagBoard.tsx`, `useCachedLeaderboard.ts`, `CphBoardComponents.tsx`/`TvDashboardComponents.tsx` (kun visning).
- Edge functions: `_shared/format-helpers.ts` får samme funktion; `tv-dashboard-data`, `calculate-leaderboard-incremental`, `calculate-kpi-values` henter override-map og bruger den. Leaderboard-cache invalideres/genberegnes efter deploy.
- Verifikation: typecheck + browserkontrol af Relatel-boardet (forventet "William S." og initialer "WS"), samt kontrol af at hans salgs-/provisionstal er uændrede før/efter.
