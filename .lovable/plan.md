

## Vis Top 5 sælgere fra CS Top 20 på Powerdag Board

Tilføj en sektion nederst på Powerdag-boardet der viser de 5 bedste individuelle sælgere fra dagens CS Top 20 leaderboard.

### Ændring

**Fil: `src/pages/dashboards/PowerdagBoard.tsx`**

1. Importer `useCachedLeaderboard`, `formatDisplayName`, `getInitials` fra `@/hooks/useCachedLeaderboard`
2. Kald `useCachedLeaderboard("today", { type: "global" }, { limit: 5 })` for at hente top 5 sælgere
3. Tilføj en ny sektion efter team-standings med:
   - Overskrift: "🏅 Top 5 Sælgere — I dag"
   - Liste med avatar-cirkel (initialer), navn, team-badge (farvekodet), antal salg og provision
   - Styling der matcher det eksisterende board-design (mørke kort, glow-effekter)
   - Staggered fade-in animation som resten af boardet

Layout pr. sælger-række:
```text
[Rank] [Avatar] Navn [Team-badge]    Salg    Provision
```

Ingen database-ændringer — bruger eksisterende cached leaderboard data.

