

## Fix: Tilføj sygeløn til omkostningssortering

### Problem
Når du sorterer klienterne efter "Omkostninger", medregnes `sickPayAmount` ikke i summen. Det betyder at klienter med høj sygeløn kan fremstå billigere end de reelt er.

### Rettelse

**Fil: `src/components/salary/ClientDBTab.tsx`** (linje 772-773)

Tilføj `a.sickPayAmount` og `b.sickPayAmount` til sorteringsberegningen:

```
// Før:
aVal = a.adjustedSellerCost + a.locationCosts + a.assistantAllocation + a.leaderAllocation + a.leaderVacationPay + a.atpBarsselAllocation;

// Efter:
aVal = a.adjustedSellerCost + a.sickPayAmount + a.locationCosts + a.assistantAllocation + a.leaderAllocation + a.leaderVacationPay + a.atpBarsselAllocation;
```

### ATP/Barsel — allerede korrekt
Koden tæller allerede sælgere + assistenter + leder per team (linje 373-377), så ingen ændring er nødvendig her.

### Berørte filer
| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Tilføj `sickPayAmount` til omkostningssortering (2 linjer) |

