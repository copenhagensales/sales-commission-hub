

## Plan: Filtrér sælgere uden beløb fra lønoversigten

**Mål:** Kun vise medarbejdere i Sælgerlønninger-tabellen som har en værdi større end 0 i mindst én kolonne i den valgte lønperiode.

### Ændring

**Fil:** `src/components/salary/SellerSalariesTab.tsx`

I `filteredData` useMemo (linje ~65-76), tilføj et ekstra filter efter søgefiltrering, der fjerner rækker hvor alle beløbskolonner er 0:

```typescript
// After search filter, remove sellers with all-zero amounts
.filter(seller =>
  seller.commission !== 0 ||
  seller.cancellations !== 0 ||
  seller.vacationPay !== 0 ||
  seller.diet !== 0 ||
  seller.sickDays !== 0 ||
  seller.dailyBonus !== 0 ||
  seller.startupBonus !== 0 ||
  seller.referralBonus !== 0
)
```

Dette sikrer at kun medarbejdere med aktivitet i perioden vises, mens total-rækken og badge-tælleren automatisk opdateres korrekt, da de allerede beregnes fra `filteredData`.

