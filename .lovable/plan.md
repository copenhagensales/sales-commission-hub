

# Vis point pr. plads + fjern "0 runder"

## Ændringer

### `src/components/league/ActiveSeasonBoard.tsx`

**1. Tilføj point-visning pr. plads**
- Importér/genimplementér `calculatePointsDisplay` fra `RoundResultsCard.tsx` (baseret på division, rank, totalDivisions, multiplier)
- Send `totalDivisions` og aktuel `multiplier` (fra rundenummer) til `SeasonPlayerRow`
- Vis point-badge ved hver spiller, f.eks. `+25 pt` i en lille badge/tekst efter provision
- Brug eksisterende formel: `basePoints = max(0, (totalDivisions - division + 1) * 20 - (rank - 1) * 5) × multiplier`

**2. Fremhæv den blinkende prik**
- Den grønne pulse-dot eksisterer allerede for spillere med `todayProvision > 0`
- Gør den mere synlig: større størrelse (h-2 w-2), stærkere glow-effekt med `shadow-[0_0_6px_rgba(16,185,129,0.6)]`

**3. Fjern "0 runder"**
- Linje 388-392: Fjern hele blokken der viser `{standing.rounds_played} runder`, eller vis kun når `rounds_played > 0`

### Props-ændringer
- `ActiveSeasonBoard` skal modtage `currentRoundNumber?: number` for at beregne multiplier
- `SeasonPlayerRow` får nye props: `pointsAtStake: number`

### `src/pages/CommissionLeague.tsx`
- Send `currentRoundNumber` til `ActiveSeasonBoard`

| Fil | Ændring |
|-----|---------|
| `src/components/league/ActiveSeasonBoard.tsx` | Tilføj point-badge, fremhæv pulse-dot, fjern/skjul "0 runder" |
| `src/pages/CommissionLeague.tsx` | Send `currentRoundNumber` prop |

