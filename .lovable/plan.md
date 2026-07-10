Ændr farven på "Fiber point" og "Fiber provi" celler i leaderboard-tabellerne fra primær (grøn) og foreground (hvid) til muted-foreground (grå).

## Ændring

**Fil:** `src/components/dashboard/TvDashboardComponents.tsx`

I `TvLeaderboardTable` body-cellerne for fiber-kolonnerne:
- Fiber point-cellen: erstat `text-primary` med `text-muted-foreground` (både tvMode og ikke-tvMode)
- Fiber provi-cellen: erstat `text-foreground` med `text-muted-foreground` i tvMode; tilføj `text-muted-foreground` i ikke-tvMode

Headers bevares uændret. Grøn zone (kun styling-tokens).
