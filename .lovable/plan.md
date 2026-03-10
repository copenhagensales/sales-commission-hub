

# Forbedring af team-sammenlignings grafen

## Problem
Linjediagrammet er svært at aflæse — mange teams overlapper, null-værdier skaber huller, og det er svært at se hvilke teams der performer godt/dårligt.

## Foreslåede forbedringer

### 1. Skift til kombineret bar + linje chart
- **Stacked/grouped bar chart** per måned med churn % per team — lettere at sammenligne direkte.
- **Gennemsnitslinje** (ReferenceLine) beholdes som benchmark.

### 2. Interaktive filtre
- Tilføj team-toggle knapper over grafen (chips/badges), så man kan til/fravælge teams og fokusere på dem man vil sammenligne.

### 3. Bedre tooltip
- Vis team-navn, churn %, antal startere og antal stoppet i tooltip — giver kontekst til procenttallet.

### 4. Sortér og fremhæv
- Sortér teams i legenden efter højeste churn, så de "værste" er synlige først.
- Tilføj datapunkt-labels på vigtige værdier (over 20% churn).

### 5. Alternativ: Small multiples
- En lille graf per team (faceted/sparkline view) — lettere at se individuelle trends uden overlap.

## Teknisk plan
- Fil: `src/pages/OnboardingAnalyse.tsx`
- Tilføj et `selectedTeams` state med toggle-chips over grafen.
- Skift til `BarChart` med grouped bars (en farve per team) — mere læsbart end overlappende linjer.
- Forbedre tooltip med kohorte-detaljer (startere, stoppet, churn %).
- Filtrér `monthlyTeamTrend` data til kun valgte teams.
- Behold `TEAM_COLORS` mapping og `ReferenceLine`.
- Ca. 50 linjer ændringer i chart-sektionen + 15 linjer nyt state/UI for team-toggle.

