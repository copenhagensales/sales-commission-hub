

# Ensret Relatel Dashboard og TV-skærm visning

## Problem

Relatel dashboardet viser **Salg**, **Switch** og **Provision** kolonner i leaderboard-tabellerne, men TV-skærmen skjuler Switch-kolonnen. Dette skyldes at `showCrossSales` er sat til `{!tvMode}` -- altsaa kun synlig naar man IKKE er i TV-tilstand.

## Loesning

Aendr `showCrossSales` fra `{!tvMode}` til `{true}` paa alle tre `TvLeaderboardTable`-komponenter i `RelatelDashboard.tsx`, saa Switch-kolonnen altid vises -- baade paa det normale board og paa TV-skaermen.

## Tekniske detaljer

**Fil:** `src/pages/RelatelDashboard.tsx`

Tre steder (linje 243, 250, 257) aendres:

```
showCrossSales={!tvMode}
```
til:
```
showCrossSales={true}
```

`TvDashboardComponents.tsx` behoever ingen aendringer -- den understotter allerede `showCrossSales` i TV-mode med korrekt styling.

