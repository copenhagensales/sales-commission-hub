

## Problem

CS Top 20 dashboardet viser kun én enkelt liste (lønperiode) i TV-mode, og bruger faste `1920×1080` dimensioner der ikke fylder skærmen ud på TCL TV'et (samme problem som liga-dashboardet).

## Løsning

Ombyg TV-mode layoutet til 3 kolonner side om side — **Top Dag**, **Top Uge**, **Top Lønperiode** — og brug viewport-relative units (`w-screen h-screen`) så det fylder hele skærmen.

## Ændringer i `src/pages/CsTop20Dashboard.tsx`

1. **Hent alle 3 perioder i TV-mode** via den eksisterende `useCachedLeaderboards` hook (today, this_week, payroll_period) — den findes allerede i `useCachedLeaderboard.ts`.

2. **Skift TV-container** fra `w-[1920px] h-[1080px]` til `w-screen h-screen`.

3. **3-kolonne grid i TV-mode**: `grid grid-cols-3 gap-6 flex-1 min-h-0` med tre `LeaderboardCard` instanser:
   - 🏆 Top Dag (today)
   - 📅 Top Uge (this_week)  
   - 💰 Top Lønperiode (payroll_period)

4. **Forstør tekst i TV-mode**: Titel `text-4xl`, leaderboard-navne `text-base`, provision `text-base`, padding `px-4 py-3` — så det er læsbart på afstand.

5. **Normal mode uændret** — den eksisterende enkelt-kolonne med period selector bevares.

## Tekniske detaljer

- Importér `useCachedLeaderboards` fra `@/hooks/useCachedLeaderboard` (allerede eksisterende)
- TV-mode henter parallelt `today`, `this_week` og `payroll_period` fra cached leaderboard
- Beholder fallback til edge function for TV-mode hvis cache er tom
- Ingen databaseændringer

