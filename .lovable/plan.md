

## Plan: Ret forvirrende tekst om bookinger og dage

**Problem:** Teksten "Hver 5 dage = 1 booking" giver indtryk af at 5 dage resulterer i én booking. Men meningen er at én booking tæller som kvalificeret ("placement") når den dækker mindst 5 dage.

### Ændring i `src/components/billing/SupplierReportTab.tsx`

**Linje 722** — Erstat:
```
Hver {minDaysPerLocation} dage = 1 booking
```
med:
```
1 placering = min. {minDaysPerLocation} dage på samme lokation
```

Det gør det klart at en placering kræver minimum X dage — ikke at X dage automatisk skaber en booking.

