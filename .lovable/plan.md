

## Tilføj TV-knap til Powerdag Board

Powerdag-boardet bruger ikke `DashboardHeader` og har derfor ingen TV-knap. Løsningen er at importere og tilføje `TvBoardQuickGenerator` i headeren.

### Ændring

**Fil: `src/pages/dashboards/PowerdagBoard.tsx`**

1. Importer `TvBoardQuickGenerator` fra `@/components/dashboard/TvBoardQuickGenerator`
2. Tilføj `<TvBoardQuickGenerator dashboardSlug="powerdag" />` i header-området ved siden af "Indtast salg"-knappen
3. Skjul knappen i TV-mode (når `isTvMode()` er true)

