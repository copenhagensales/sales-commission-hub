

## Fix: Tilskudsregel matcher ikke for Switch Contact Center #1

### Problem
Prisreglerne for "Switch Contact Center #1" pa Switch Krydssalgs-kampagnen har et prioritetsproblem:

| Produkt | Regel | Prioritet | Provision |
|---------|-------|-----------|-----------|
| ATL | Tilskud=0% | **5** | 2.125 kr |
| ATL | Ingen betingelser | 0 | 1.883 kr |
| #1 | Tilskud=0% | **0** | 1.414 kr |
| #1 | Ingen betingelser | **0** | 1.253 kr |

Matching-logikken sorterer efter prioritet (hojest forst). Nar begge regler har prioritet 0, vinder reglen uden betingelser, fordi den matcher alt. Derfor far #1 kun 1.254 kr i stedet for 1.414 kr.

### Losning

**Database-opdatering**: Saet prioriteten pa Tilskud=0% reglen for Switch Contact Center #1 (pa Switch Krydssalgs-kampagnen) til 5:

```sql
UPDATE product_pricing_rules 
SET priority = 5 
WHERE id = '71ee6084-765d-4ca8-a698-0602d1df2036';
```

**Rematch**: Kor derefter rematch-pricing-rules for at genberegne provisioner pa eksisterende salg, der blev ramt af den forkerte prioritet.

### Forebyggelse
Overvej ogsa at tjekke de ovrige Switch Contact Center-produkter (#2, #3, #4) for samme problem, og saette Tilskud-regler til prioritet 5 konsekvent.
