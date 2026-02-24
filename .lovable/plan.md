

## Diagnose: Hvad er galt med ASE-priserne?

### Prisreglerne ER korrekte i databasen

| Regel | Provision | Med straksbetaling | Status |
|---|---|---|---|
| A-kasse Lønmodtager | 400 kr | 1.000 kr | Korrekt konfigureret |
| Akasse Selvstændige | 400 kr | 1.000 kr | Korrekt konfigureret |
| Lønsikring Basis (<6000) | 200 kr | - | Korrekt konfigureret |
| Lønsikring Udvidet (≥6000) | 400 kr | - | Korrekt konfigureret |

### Problemet: 50 sale_items (20 hos Alexander) har aldrig fået en prisregel matched

Disse items har `matched_pricing_rule_id = NULL` og forkerte provisioner fra en gammel beregning:

| Forkert provision | Antal items | Forklaring |
|---|---|---|
| 1.400 kr | 25 (11 hos Alexander) | Gammel logik der summerede a-kasse + lønsikring i ét item |
| 800 kr | 13 (2 hos Alexander) | Gammel kombination (400+400) |
| NULL / 0 kr | 12 (4 hos Alexander) | Aldrig beregnet |
| 400 kr | 1 | Tilfældigt korrekt |

Hvert af de 11 salg med 1.400 kr provision har faktisk OGSÅ et separat korrekt Lønsikring-item (400 kr). Så provisionen tælles dobbelt.

### Eksempel: Et Alexander-salg (sale_id: 18d58174)

| Item | Produkt | Provision | Regel matched? |
|---|---|---|---|
| "Salg" | Salg | **1.400 kr** (FORKERT) | Nej - NULL |
| Lønsikring | Lønsikring | 400 kr (korrekt) | Ja - Lønsikring Udvidet |

Korrekt total for dette salg: 400 kr (a-kasse) + 400 kr (lønsikring) = **800 kr**
Nuværende total: 1.400 + 400 = **1.800 kr** (1.000 kr for meget)

### Rod-årsag

Rematch-funktionen processer kun items med `matched_pricing_rule_id IS NULL`. Disse 50 items ER umatched, men rematch er ikke blevet kørt siden de korrekte prisregler blev opsat. Dataen i items stammer fra en ældre beregningslogik.

### Yderligere problem: Forkert produkt-mapping

3 items har `adversus_product_title = "Lønsikring Udvidet"` men `product_id = Salg`. Rematch-funktionens `determineAseProductId` tjekker kun `product_id` mod LOENSIKRING_VARIANT_IDS -- den ser ikke på `adversus_product_title`. Disse items vil derfor fejlagtigt matches mod A-kasse-regler i stedet for Lønsikring-regler.

---

## Plan: Fix i to trin

### Trin 1: Fix rematch-funktionens product-detection (kodeændring)

**Fil: `supabase/functions/rematch-pricing-rules/index.ts`**

Udvid `determineAseProductId` til også at tjekke `adversus_product_title` fra sale_items:

```text
FØR: Tjekker kun product_id mod LOENSIKRING_VARIANT_IDS
EFTER: Tjekker OGSÅ adversus_product_title for "Lønsikring" patterns
```

Konkret: Hvis `adversus_product_title` indeholder "Lønsikring" (case-insensitive), og produktet IKKE allerede er Lønsikring, skal det korrigeres til `ASE_LOENSIKRING_PRODUCT_ID`.

Desuden skal `adversus_product_title` tilføjes til select-query'en (linje 293) så rematch har adgang til denne data.

### Trin 2: Kør rematch for alle ASE sale_items

Deploy den opdaterede funktion og kør rematch med `source: 'ase'` for at genberegne alle 50 umatched items. Resultatet:

```text
FØR (Alexander, 20 umatched "Salg" items):
  11 × 1.400 kr + 2 × 800 kr + 4 × 0 kr + 1 × 400 kr = 18.200 kr (forkert)

EFTER:
  Items UDEN straksbetaling → 400 kr hver
  Items MED straksbetaling → 1.000 kr hver  
  Lønsikring-items forbliver korrekte (200/400 kr)
```

### Samlet effekt på Alexanders provision

| Kategori | Antal | Nu | Korrekt |
|---|---|---|---|
| A-kasse med straksbetaling | 79 | 83.400 kr | 79.000 kr (79 × 1.000) |
| A-kasse uden straksbetaling | 1 + 20 umatched | 8.800 kr | 8.400 kr (21 × 400) |
| Lønsikring Udvidet | 56 | 22.400 kr | 22.400 kr (uændret) |
| **Total** | | **114.600 kr** | **109.800 kr** |

Bemærk: Den præcise korrektion afhænger af hvor mange af de 20 umatched items der skal have straksbetaling vs. standard provision. De 11 items med 1.400 kr er den største fejl, da lønsikring-provisionen er talt dobbelt.

