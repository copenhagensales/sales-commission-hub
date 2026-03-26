

## Gør Powerdag tilgængelig på TV-skærm

Powerdag skal tilføjes til TV board-systemet, så den kan vises via en adgangskode på `/t/XXXX`.

### Ændringer

**1. `src/pages/tv-board/TvBoardView.tsx`** — tilføj powerdag til component map:
```ts
import PowerdagBoard from "@/pages/dashboards/PowerdagBoard";
// i dashboardComponents:
"powerdag": PowerdagBoard,
```

**2. `src/pages/tv-board/TvBoardDirect.tsx`** — samme tilføjelse:
```ts
import PowerdagBoard from "@/pages/dashboards/PowerdagBoard";
// i dashboardComponents:
"powerdag": PowerdagBoard,
```

Det er alt. Powerdag-boardet har allerede TV-mode support (via `isTvMode()`, `useAutoReload`, skjult cursor). Herefter kan du oprette en TV-adgangskode til "powerdag" via TV Board Admin eller TvBoardQuickGenerator.

