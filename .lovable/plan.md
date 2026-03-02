

# Vis alle sælgere i leaderboard-tabellerne (ikke kun top 10)

## Ændring
Fjern begrænsningen på 10 rækker i leaderboard-tabellerne, så alle sælgere med data vises. Brugere kan scrolle ned for at se resten.

## Tekniske detaljer

### 1. `TvDashboardComponents.tsx` - TvLeaderboardTable
- Fjern `maxRows` default på 10 og `.slice(0, maxRows)` logikken
- Når `maxRows` ikke er sat, vises alle sælgere
- Behold `maxRows` som optional prop til TV-mode (hvor man ikke kan scrolle)
- Tilføj `max-height` med `overflow-y: auto` i ikke-TV-mode så tabellen kan scrolles

### 2. `ClientDashboard.tsx` - Kald til TvLeaderboardTable
- I standard dashboard-mode (ikke TV): send ingen `maxRows` prop, så alle vises
- I TV-mode: behold begrænsningen, da TV-skærme ikke kan scrolles

Ingen database-ændringer nødvendige.

