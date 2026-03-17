

## Rettelse: Top 3 baseres på point, ikke provision

### Problem
Top 3 præmierne (🥇🥈🥉) viser pt. spillere baseret på standings fra kvalifikation (provision). Men disse titler afgøres af **total_points** som kun gives efter hver runde i den aktive sæson. Under kvalifikation er der ingen point endnu.

### Ændringer

**`src/components/league/PrizeShowcase.tsx`**
- Når `isActive` er `false` (kvalifikation): Vis "Afgøres når sæsonen starter" for alle 6 kort – der er ingen point endnu, så ingen ligger til nogen titel
- Når `isActive` er `true`: Top 3 sorteres efter `total_points` (ikke `overall_rank`), og subtitle viser point
- `pointLabel` viser altid point (`X pt`), aldrig provision

**Ingen ændringer i hooks** – `total_points` er allerede tilgængelig fra season standings.

