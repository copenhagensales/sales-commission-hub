

## Fjern decimaler fra provision-visninger i liga

Alle steder hvor `toLocaleString("da-DK")` bruges til at vise provision/kr-beløb i liga-komponenterne, skal der tilføjes `{ maximumFractionDigits: 0 }` så decimaler aldrig vises.

### Filer der ændres

1. **`ActiveSeasonBoard.tsx`** (linje 223, 226) — `total_points` og `total_provision`
2. **`RoundResultsCard.tsx`** (linje 86) — `weekly_provision`
3. **`CommissionLeague.tsx`** (linje 480) — `total_points`
4. **`PremierLeagueBoard.tsx`** (linje 335) — `current_provision`

Ændringen er simpel: `toLocaleString("da-DK")` → `toLocaleString("da-DK", { maximumFractionDigits: 0 })` eller wrap med `Math.round()`.

