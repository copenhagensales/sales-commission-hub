

## Vis Centre/Boder med fuld måneds-beløb i parentes

### Hvad ændres
Når du vælger en kortere periode (fx en uge), viser Centre/Boder i dag kun beløbet for den valgte periode. Med denne ændring vises det som fx **-57.000 kr.** med **(77.700 kr./md.)** i parentes nedenunder, så du altid ved hvad den fulde måneds bookingomkostning er.

### Teknisk plan

**Fil 1: `src/components/salary/ClientDBTab.tsx`**

1. Beregn fuld-måneds lokationsomkostninger ved siden af periode-specifikke:
   - Udled `monthStart` og `monthEnd` fra `periodStart` (via `startOfMonth`/`endOfMonth`)
   - Tilføj en ekstra `fullMonthLocationCostsMap` der itererer over hele månedens dage i stedet for kun perioden
   - Kun beregnes hvis perioden IKKE allerede er en hel måned (for at undgå dobbeltberegning)

2. Udvid `ClientDBData` interfacet med et nyt felt:
   - `fullMonthLocationCosts: number` — den samlede bookingomkostning for hele måneden

3. Sæt værdien i clientDataList-opbygningen:
   - `fullMonthLocationCosts: isFMClient ? (fullMonthLocationCostsMap.get(client.id) || 0) : 0`

4. Send `fullMonthLocationCosts` videre til `ClientDBExpandableRow` via props

**Fil 2: `src/components/salary/ClientDBExpandableRow.tsx`**

1. Udvid `ClientDBRowData` interfacet med `fullMonthLocationCosts: number`

2. I den udvidede rækkevisning, ændr Centre/Boder-cellen:
   - Vis periode-beløbet som før: `-57.000 kr.`
   - Tilføj en linje under med fuld måneds-beløb i parentes: `(77.700 kr./md.)`
   - Kun vis parentes-linjen hvis `fullMonthLocationCosts !== locationCosts` (dvs. perioden er kortere end hele måneden)

### Eksempel på visning

```text
Centre/Boder
-57.000 kr.
(77.700 kr./md.)
```

### Berørte filer
| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Beregn `fullMonthLocationCosts`, udvid interface, send som prop |
| `src/components/salary/ClientDBExpandableRow.tsx` | Udvid interface, vis fuld-måned i parentes |

