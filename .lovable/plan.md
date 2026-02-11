

## Fix: Cap boderomkostninger ved "i dag" for alle klienter

### Problem
Naar "Denne maaned" vaelges den 11. februar, medregnes boderomkostninger for alle bookede dage i hele februar — ogsaa d. 12, 13 osv. — for **alle** klienter med lokationsbookings. Omsaetning og salgsdata stopper ved i dag. Det giver et skaevt billede for alle opgaver, ikke kun Yousee.

### Loesning
Cap `periodDaysArray` ved dagens dato for "month" og "payroll" modes, saa boderomkostninger kun taeller afviklede dage. Den fulde maaneds boder beregnes stadig separat (til parentes-visning).

### AEndring

**Fil: `src/components/salary/ClientDBTab.tsx`** (linje 572)

Foer:
```text
const periodDaysArray = eachDayOfInterval({ start: periodStart, end: periodEnd });
```

Efter:
```text
const today = new Date();
const effectivePeriodEnd = (periodMode === "month" || periodMode === "payroll") && today < periodEnd
  ? today
  : periodEnd;
const periodDaysArray = eachDayOfInterval({ start: periodStart, end: effectivePeriodEnd });
```

`fullMonthDaysArray` (linje 578) forbliver uaendret — den bruger allerede `monthEnd` og sikrer at parentes-vaerdien viser den fulde maaneds forventede boder.

### Resultat
- Alle klienters boderomkostninger matcher nu den faktiske salgsperiode (til og med i dag)
- Fuld maaneds boderomkostning vises stadig i parentes
- Ingen aendring for "week", "day" eller "custom" modes

### Beroert fil

| Fil | AEndring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Cap periodDaysArray ved today for month/payroll |

