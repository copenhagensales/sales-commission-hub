## Problem

På en **afsluttet** sæson viser Hall of Fame forkerte data i de tre priskort, fordi `usePrizeLeaders` har en separat "qualification only"-gren der aktiveres når `season.status !== 'active'`. Den gren ignorerer alle færdigspillede runder. Derudover er confetti hægtet på `sessionStorage` og kører kun 1,8 sekunder én gang.

### Konkrete bugs i `src/hooks/useLeaguePrizeData.ts`

| Pris | Nuværende adfærd ved `status='completed'` | Skal være |
|---|---|---|
| Bedste Runde | Kun kval-runden (`qualBestRounds`) → viser "Theo E 36.720 kr" fra kval | Højeste `weekly_provision` på tværs af kval + R1–R6 (samme merge som active-grenen) |
| Sæsonens Talent | Bruger `current_provision` fra kval-tabellen i kr | Bruger `total_points` fra `league_season_standings` (filtreret på <90 dages ansættelse), samme som active+round≥2 |
| Sæsonens Comeback | Kun kval-intern rank-bevægelse (`previous_overall_rank` vs `overall_rank` i kval) | Forbedring fra kval-final-rank → season-final-rank (samme som active-grenen) |

### Confetti i `HallOfFamePodium.tsx`

- `sessionStorage`-gate forhindrer ny fyring efter første visning
- `duration = 1800` ms → stopper næsten med det samme
- Lav `particleCount: 4` per side

## Plan

### 1. `src/hooks/useLeaguePrizeData.ts` — behandl `completed` som `active`

Ændre branch-betingelsen fra `isActive` til `hasFinishedRounds` (`status in ('active','completed')`). Kort sagt:

- **`allStandings`**: Hent altid når sæsonen er active ELLER completed (i dag kun active).
- **`usePointsForTalent`**: True når sæsonen er completed, eller active med `currentRoundNumber >= 2`. (Completed = sæsonen er kørt færdig, points er endelige.)
- **Bedste Runde**: Fjern `if (isActive) … else …`. Kør altid merge af `qualBestRounds + finishedBestRounds` så længe sæsonen ikke kun er i kval-fase. Hvis sæsonen aldrig kom forbi kval (ingen `league_round_standings`-rækker), fungerer det stadig fordi `finishedBestRounds` er tom.
- **Comeback**: Brug season-standings-grenen når `status in ('active','completed')`. Kval-only-grenen bruges kun for ren kval-fase.

Den eneste reelle "kval-only"-gren tilbage er sæsoner med `status='qualification'` (eller hvad der nu signalerer at kun kval er kørt) — alt med færdige runder behandles ens.

### 2. `src/components/league/HallOfFamePodium.tsx` — konstant, kraftigere confetti

- Fjern `sessionStorage`-gate og `fired.current` engangs-logik.
- Skift fra "1,8 sek burst" til en `setInterval` der fyrer hver ~700-900 ms så længe komponenten er mountet.
- Hver fyring: `particleCount: 60` per side, fra venstre+højre nederste hjørner, varieret farve (guld/sølv/bronze + accent), `scalar: 1.1`, `gravity: 0.9`.
- Ekstra opstarts-burst: stort centerskud (`particleCount: 200`, `spread: 100`, `origin: { y: 0.6 }`) ved mount.
- Cleanup: `clearInterval` i return fra `useEffect`.
- Respektér `prefers-reduced-motion` (skip loop hvis brugeren har det slået til).
- Ingen ændringer til styling/markup udenfor `useEffect`.

### 3. Verifikation

- Åbn `/commission-league` med Sæson 1 (completed, 6 runder).
- Forvent: "Bedste Runde" viser højeste `weekly_provision` på tværs af kval+R1-R6 (sandsynligvis fra én af de afsluttede runder, ikke kval).
- "Sæsonens Talent" viser den nyansatte (<90 dage før sæsonstart) med flest `total_points`.
- "Sæsonens Comeback" viser største stigning fra kval-final-rank til season-final-rank.
- Confetti løber konstant fra begge nederste hjørner.

## Zone

Gul. Rør kun rapport/UI-hook (`useLeaguePrizeData`) og presentation-komponent (`HallOfFamePodium`). Ingen DB-ændringer. Ingen lønberegning, ingen pricing.

## Filer der ændres

- `src/hooks/useLeaguePrizeData.ts`
- `src/components/league/HallOfFamePodium.tsx`