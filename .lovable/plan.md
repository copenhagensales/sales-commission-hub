
# Plan: Ret beregningsrækkefølge for fradrag og annulleringer

## Ændring

Den nuværende beregning trækker begge procenter fra som separate beløb baseret på total omsætning. Den korrekte rækkefølge er:

**Nuværende logik:**
```
Annulleringsbeløb = Omsætning × Annullering%
Fradragsbeløb = Omsætning × Fradrag%
Indtjening = Basisindtjening - Annulleringsbeløb - Fradragsbeløb
```

**Ny logik:**
```
1. Annulleringsbeløb = Omsætning × Annullering%
2. Reduceret omsætning = Omsætning - Annulleringsbeløb
3. Fradragsbeløb = Reduceret omsætning × Fradrag%
4. Indtjening = Basisindtjening - Annulleringsbeløb - Fradragsbeløb
```

---

## Teknisk ændring

**Fil:** `src/pages/reports/RevenueByClient.tsx` (linje 520-522)

Fra:
```typescript
const deductionAmount = client.totalRevenue * (deductionPct / 100);
const cancellationAmount = client.totalRevenue * (cancellationPct / 100);
const adjustedEarnings = client.totalEarnings - deductionAmount - cancellationAmount;
```

Til:
```typescript
// 1. Først: Beregn annulleringsbeløb fra total omsætning
const cancellationAmount = client.totalRevenue * (cancellationPct / 100);
// 2. Derefter: Beregn fradrag fra reduceret omsætning (efter annulleringer)
const revenueAfterCancellation = client.totalRevenue - cancellationAmount;
const deductionAmount = revenueAfterCancellation * (deductionPct / 100);
// 3. Endelig: Beregn justeret indtjening
const adjustedEarnings = client.totalEarnings - cancellationAmount - deductionAmount;
```

---

## Eksempel

| Omsætning | Annullering % | Fradrag % | **Nuværende** | **Ny beregning** |
|-----------|---------------|-----------|---------------|------------------|
| 100.000 kr | 10% | 5% | 85.000 kr | 85.500 kr |

**Nuværende:** 100.000 - 10.000 - 5.000 = 85.000 kr
**Ny:** 100.000 - 10.000 - (90.000 × 5%) = 100.000 - 10.000 - 4.500 = 85.500 kr

---

## Fil der ændres
- `src/pages/reports/RevenueByClient.tsx`
