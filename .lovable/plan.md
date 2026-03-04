

## Plan: Erstat "Anvend" med 3 target-niveauer

### Ændring

I `src/pages/TeamGoals.tsx` (linje 378-393) erstattes den nuværende "Foreslået mål: X [Anvend]" sektion med 3 klikbare target-knapper baseret på forecast-beregningen:

- **+5%**: `Math.round(forecast * 1.05)`
- **+10%**: `Math.round(forecast * 1.10)`  
- **+15%**: `Math.round(forecast * 1.15)`

### UI

```text
💡 Forecast: 510
  Baseret på 13 medarbejderes salg/dag i Februar 2026

  [+5%: 536]  [+10%: 561]  [+15%: 587]
```

Klik på en knap sætter `form.sales_target` til den valgte værdi. Forecast-basetallet vises stadig som reference men uden "Anvend"-knap.

### Fil
- `src/pages/TeamGoals.tsx` — Erstat linje 379-393 med forecast-label + 3 target-knapper

