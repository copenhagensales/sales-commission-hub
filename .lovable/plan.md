

# Plan: Ret beregningslogik for annulleringer og fradrag

## Ønsket forretningslogik

Beregningen skal ske i følgende rækkefølge, baseret på **indtjeningen** (ikke omsætningen):

```
1. Start med basis indtjening (26.951 kr)
2. Træk annullering % fra indtjening → 26.951 - 10% = 24.255,9 kr
3. Træk fradrag % fra det resterende → 24.255,9 - 10% = 21.830,31 kr
```

---

## Teknisk ændring

**Fil:** `src/pages/reports/RevenueByClient.tsx` (linje 585-593)

**Fra (nuværende logik):**
```typescript
const cancellationAmount = client.totalRevenue * (cancellationPct / 100);
const revenueAfterCancellation = client.totalRevenue - cancellationAmount;
const deductionAmount = revenueAfterCancellation * (deductionPct / 100);
const adjustedEarnings = client.totalEarnings - cancellationAmount - deductionAmount;
```

**Til (ny logik):**
```typescript
// 1. Start med basis indtjening
// 2. Træk annullering % fra indtjeningen
const cancellationAmount = client.totalEarnings * (cancellationPct / 100);
const earningsAfterCancellation = client.totalEarnings - cancellationAmount;
// 3. Træk fradrag % fra det resterende beløb
const deductionAmount = earningsAfterCancellation * (deductionPct / 100);
const adjustedEarnings = earningsAfterCancellation - deductionAmount;
```

---

## Eksempel med Relatel

| Trin | Beregning | Resultat |
|------|-----------|----------|
| Basis indtjening | - | 26.951 kr |
| Annullering (10%) | 26.951 × 10% | 2.695,1 kr |
| Efter annullering | 26.951 - 2.695,1 | **24.255,9 kr** |
| Fradrag (10%) | 24.255,9 × 10% | 2.425,59 kr |
| Justeret indtjening | 24.255,9 - 2.425,59 | **21.830,31 kr** |

---

## Fil der ændres
- `src/pages/reports/RevenueByClient.tsx`

