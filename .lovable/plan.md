

## Fix: Sygeløn som selvstændig udgift i DB-beregningen

### Problem
Sygeløn ganges i dag ind i sælgerlønnen som en faktor (`sellerSalaryCost * 1.05`), og derefter reduceres hele beløbet med annulleringsprocenten. Men sygeløn er en reel udgift vi betaler uanset annulleringer — den bør stå som en separat post.

### Ny beregningslogik

**Før (forkert):**
```
sellerCostWithSickPay = sellerSalaryCost × (1 + sygeløn%)
adjustedSellerCost = sellerCostWithSickPay × (1 - annullering%)
basisDB = adjustedRevenue - adjustedSellerCost - locationCosts
```

**Efter (korrekt):**
```
adjustedSellerCost = sellerSalaryCost × (1 - annullering%)
sickPayAmount = sellerSalaryCost × (sygeløn% / 100)          ← fast udgift
basisDB = adjustedRevenue - adjustedSellerCost - sickPayAmount - locationCosts
```

### Fil-aendringer

**`src/components/salary/ClientDBTab.tsx`** (linje 633-644):
- Fjern `sickPayFactor` og `sellerCostWithSickPay`
- Beregn `adjustedSellerCost` direkte fra `sellerSalaryCost * cancellationFactor`
- Behold `sickPayAmount = sellerSalaryCost * (sickPayPercent / 100)` som separat post
- Opdater `basisDB` til: `adjustedRevenue - adjustedSellerCost - sickPayAmount - locationCosts`

**`src/components/salary/ClientDBExpandableRow.tsx`**:
- Vis "Sygeløn" som en selvstændig udgiftslinje i den udvidede visning (hvis den ikke allerede gør det), så det er tydeligt at det er en separat omkostning og ikke en del af sælgerlønnen.

### Eksempel
Med 100.000 kr. sælgerløn, 5% sygeløn og 10% annullering:

| | Før (forkert) | Efter (korrekt) |
|---|---|---|
| Sælgerløn justeret | 100.000 × 1,05 × 0,90 = 94.500 | 100.000 × 0,90 = 90.000 |
| Sygeløn separat | (indeholdt i ovenstående) | 100.000 × 0,05 = 5.000 |
| Total omkostning | 94.500 | 95.000 |

Forskellen er lille men principielt korrekt: sygeløn er en fast udgift der ikke skal reduceres af annulleringsprocenten.

