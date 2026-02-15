

# Ret prisregler: Kun Relatel-produkter

## Problem
241 Relatel-prisregler har `effective_from = '2026-02-06'`, saa de ignorerer salg fra 15/1 - 5/2. Derudover mangler nogle Relatel-produkter fallback-regler. Resultatet er en difference paa ca. 4.495 kr for Rasmus alene.

De 29 regler for Eesy, 5GI og 5G Internet roeres IKKE.

## Loesning

### Trin 1: Fjern effective_from paa kun Relatel-regler (241 stk)
SQL-opdatering der kun rammer Relatel-produkter:

```text
UPDATE product_pricing_rules ppr
SET effective_from = NULL
FROM products p
WHERE ppr.product_id = p.id
AND ppr.effective_from = '2026-02-06'
AND (p.name ILIKE '%switch%' 
  OR p.name ILIKE '%MBB%' 
  OR p.name ILIKE '%omstilling%' 
  OR p.name ILIKE '%fri tale%'
  OR p.name ILIKE '%fri data%');
```

Dette goer de 241 Relatel-regler gyldige for alle datoer. De 29 Eesy/5GI-regler beholder deres `effective_from = 2026-02-06`.

### Trin 2: Opret manglende fallback-regler for Relatel
Produkter der helt mangler universelle fallback-regler:

| Produkt | Provision (kr) | Omsaetning (kr) |
|---------|---------------|-----------------|
| Fri Tale - 60 GB BTL #5 | 750 | 1.875 |
| Switch Professionel ATL | 703 | 1.758 |
| Switch Contact Center ATL (299kr) | 2.125 | 5.313 |
| Switch Contact Center #1 (199kr) | 1.414 | 3.535 |
| Omstillingsbruger #3 | 175 | 351 |

Disse oprettes som INSERT i `product_pricing_rules` med prioritet 0, ingen betingelser, og `effective_from = NULL`.

### Trin 3: Koer rematch
Kald `rematch-pricing-rules` edge function for source `Relatel_CPHSALES` for at genberegne provision paa alle Relatel-salg.

## Forventet resultat
- Rasmus's provision rettes fra 36.087 kr til ca. 40.582 kr
- Kun Relatel-regler pavirkes - Eesy/5GI forbliver uaendrede
- Alle Relatel-salg fra 15/1 og frem faar korrekte prisregler

## Tekniske detaljer
- Ingen kodeaendringer - kun SQL (UPDATE + INSERT) og et edge function kald
- 241 regler opdateres, 29 forbliver uaendrede
- 5 nye fallback-regler oprettes
