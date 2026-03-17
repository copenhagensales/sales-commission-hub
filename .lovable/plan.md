

## Samlet plan: Ny ligastruktur + runde-multiplikator

### Overblik

Kombineret opdatering af hele ligaens gameplay: 14 spillere pr. division, nyt pointsystem, nye zone-regler, og stigende runde-multiplikator.

### Ny struktur

| Parameter | Nu | Nyt |
|---|---|---|
| Spillere pr. division | 10 | **14** |
| Pointformel | lineær | **max(0, (totalDiv - div) × 20 - (rank - 1) × 5)** |
| Oprykker | Top 2 | **Top 3** |
| Playoff op | #3 | **#4-5** |
| Safe | #4-7 | **#6-9** |
| Playoff ned | #8 | **#10-11** |
| Nedrykker | #9-10 | **#12-14** |
| Runde-multiplikator | ingen | **1.0 → 1.2 → 1.4 → 1.6 → 1.8 → 2.0** |

### Pointtabel (base, før multiplikator)

```text
Superliga: 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35
1. div:     80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15
2. div:     60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10,  5,  0,  0
...osv. Runde 4 ganger med ×1.6, runde 6 med ×2.0
```

### Ændringer

**1. Database – sæsonkonfiguration**
- Opdater aktiv sæsons `config.players_per_division` til 14
- Sæt `end_date` til 6 uger efter kvalifikationsslut

**2. `league-process-round` edge function** (hoveddelen)
- Ny pointformel: `max(0, (totalDivisions - division) * 20 - (rank - 1) * 5)`
- Tilføj `ROUND_MULTIPLIERS = [1, 1.2, 1.4, 1.6, 1.8, 2.0]` – gang basepoint med faktor for `round_number`
- Nye bevægelsesregler:
  - Top 3 rykker op (undtagen Superligaen)
  - #12-14 rykker ned (undtagen bund-division)
  - Playoffs: #4-5 i lavere div vs #10-11 i højere div (2 playoff-kampe pr. divisionsgrænse)

**3. `league-calculate-standings` edge function**
- Samme nye pointformel for kvalifikationsvisning

**4. `RoundResultsCard.tsx`**
- Opdater `calculatePointsDisplay()` med ny formel + multiplikator baseret på `round.round_number`
- Vis multiplikator-badge i header (f.eks. "×1.4")

**5. Zone-logik i UI-komponenter** (4 filer)
- `QualificationBoard.tsx` – zone-grænser: promo ≤3, playoff 4-5 / 10-11, relegation ≥12
- `ActiveSeasonBoard.tsx` – samme zone-opdatering
- `PremierLeagueBoard.tsx` – samme zone-opdatering + dashed dividers
- `ZoneLegend.tsx` – opdater "Top 2" → "Top 3", tilføj "Playoff ned" som separat indikator

**6. Zone-beregning i `CommissionLeague.tsx`**
- Opdater zone-beregninger fra rank ≤2/≥9 til de nye grænser

