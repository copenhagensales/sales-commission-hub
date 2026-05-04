## Tilføj ny graf: Ansøgninger pr. uge

Under den eksisterende "Ansøgninger over tid"-graf på `/recruitment` tilføjes en ny graf der viser udviklingen aggregeret pr. ISO-uge.

### Hvad bygges
- Nyt `Card` lige under den nuværende area chart med titel **"Ansøgninger pr. uge"**.
- Bar chart (Recharts) med én søjle pr. uge.
- X-akse label-format: `Uge 17` (med årstal i tooltip ved årsskifte).
- Tooltip viser: `Uge X, YYYY` + antal + dato-interval (man–søn).
- Samme periode-vælger (30d / 60d / 90d / 6m / 12m) — genbruger `chartPeriod`-state, så begge grafer følges ad.

### Data
- Genbruger samme rådata som den nuværende `chartData` (kandidater grupperet pr. dag).
- Aggregeres på frontend pr. ISO-uge med `date-fns` (`startOfISOWeek`, `getISOWeek`, `getISOWeekYear`) — ingen DB-ændringer.
- Tomme uger i perioden vises som 0 (kontinuerlig x-akse).

### Tekniske detaljer
- **Fil:** `src/pages/recruitment/RecruitmentDashboard.tsx` (eneste fil ændres).
- **Imports tilføjes:** `BarChart`, `Bar` fra recharts; `startOfISOWeek`, `endOfISOWeek`, `getISOWeek`, `getISOWeekYear` fra `date-fns`.
- **Ny memo `weeklyChartData`** der mapper `chartData` (daglige tællinger) → array af `{ weekKey, weekLabel, weekStart, weekEnd, count }`.
- Styling matcher eksisterende graf (samme `chartConfig`, `hsl(var(--primary))`, samme højde `h-[200px] sm:h-[300px]`).

### Zone
**Grøn zone** — ren UI/visualisering, ingen pricing/løn/RLS/DB påvirkes. Ingen migration. Ingen nye hooks.

### Out of scope
- Ingen ændring af eksisterende daglige graf.
- Ingen ny filtrering pr. status/kilde (kan tilføjes senere hvis ønsket).
- Ingen DB-ændringer.
