

# Ret Eesy prisregler + tjek oevrige produkter

## Overblik over problemer fundet

### Problem 1: 29 Eesy/5GI TM-regler med effective_from = 2026-02-06
Samme problem som Relatel - reglerne gaelder kun for salg efter 6. februar. Paavirker:
- **5GI**: 216 umatchede items (af 312) - faar base 300 kr i stedet for regel 225 kr
- **5GI varianter** (279 kr/md binding): 6 kampagne-specifikke regler
- **5G Internet**: 2 regler
- **Eesy 99 varianter** (Nuuday/IKKE Nuuday, med/uden foerste maaned): 8 regler
- **Eesy varianter** (med/uden foerste maaned): 8 regler
- **5 GB - 1 Time BTL**: 1 regel med Tilskud=0% betingelse

### Problem 2: Eesy FM-produkter mangler universelle fallback-regler
22 Eesy FM-produkter ("Fri tale + X GB data") har KUN kampagne-specifikke regler (6 kampagner pr. produkt). Salg fra andre kampagner falder tilbage til basispriser i products-tabellen, som er HOEJERE end de korrekte priser:

| Produkt-type | Basispris | Regelpris | Umatchede | Difference pr. stk |
|-------------|-----------|-----------|-----------|-------------------|
| Fri tale + 70 GB | 300 kr | 225 kr | 205 | -75 kr |
| Fri tale + fri data 10% | 375 kr | 275 kr | 160 | -100 kr |
| Fri tale + fri data 123kr 10% | 350 kr | 280 kr | 110 | -70 kr |
| Fri tale + 100 GB 10% | 350 kr | 260 kr | 30 | -90 kr |
| Fri tale + 60 GB | 300 kr | 225 kr | 30 | -75 kr |
| + 17 andre produkter | ... | ... | ~100 | -60 til -100 kr |

Estimeret total OVERSKYDENDE provision pga. forkerte basispriser: ca. 55.000 kr for hele perioden.

### Problem 3: Oevrige produkter uden regler
Andre produkter (Tryg, Codan, TDC Erhverv, Finansforbundet, ASE) bruger udelukkende basispriser fra products-tabellen og har INGEN prisregler. Disse er korrekte hvis basispriserne stemmer.

## Loesning

### Trin 1: Fjern effective_from paa de 29 Eesy/5GI-regler

```text
UPDATE product_pricing_rules
SET effective_from = NULL
WHERE effective_from = '2026-02-06';
```

Der er nu praecis 29 regler tilbage med denne dato (alle Relatel-regler blev rettet tidligere). Alle 29 er Eesy/5GI-produkter.

### Trin 2: Opret universelle fallback-regler for 22 Eesy FM-produkter
INSERT universelle regler (priority 0, ingen kampagne-begraensning, ingen betingelser) for alle Eesy FM-produkter der mangler dem:

| Produkt | Provision | Omsaetning |
|---------|-----------|------------|
| Fri tale + 20 GB data (5G) | 190 kr | 500 kr |
| Fri tale + 20 GB data | 190 kr | 500 kr |
| Fri tale + 30 GB data (5G) | 190 kr | 500 kr |
| Fri tale + 30 GB data | 190 kr | 500 kr |
| Fri tale + 60 GB data (5G) | 225 kr | 600 kr |
| Fri tale + 70 GB data (5G) | 225 kr | 600 kr |
| Fri tale + 100 GB data (5G) | 275 kr | 750 kr |
| Fri tale + 100 GB data 10% Rabat | 260 kr | 700 kr |
| Fri tale + 100 GB + 40 GB EU | 275 kr | 750 kr |
| Fri tale + 110 GB data (5G) | 275 kr | 750 kr |
| Fri tale + 110 GB data 10% Rabat | 260 kr | 700 kr |
| Fri tale + 150 GB data (5G) | 275 kr | 750 kr |
| Fri tale + 150 GB data 10% Rabat | 275 kr | 750 kr |
| Fri tale + 170 GB data (5G) binding | 275 kr | 750 kr |
| Fri tale + 170 GB data 10% Rabat | 275 kr | 750 kr |
| Fri tale + 170 GB (6 mdr) 10% Rabat | 275 kr | 750 kr |
| Fri tale + fri data (5G) | 275 kr | 750 kr |
| Fri tale + fri data 10% Rabat | 275 kr | 750 kr |
| Fri tale + fri data 109 kr | 280 kr | 700 kr |
| Fri tale + fri data 123 kr | 280 kr | 700 kr |
| Fri tale + fri data 123 kr 10% Rabat | 280 kr | 700 kr |
| Fri tale + fri data 123 kr. 10% Rabat | 280 kr | 700 kr |

### Trin 3: Koer rematch for Eesy
Kald `rematch-pricing-rules` for source `Eesy` for at genberegne provision paa alle Eesy TM og FM salg.

## Forventet resultat
- **Eesy TM (5GI)**: 216 umatchede items faar korrekte kampagne-specifikke priser (225 kr i stedet for 300 kr base)
- **Eesy FM**: ~635 umatchede items faar korrekte priser (LAVERE end basispriser - reducerer provision med ca. 55.000 kr total)
- Alle oevrige produkter (Tryg, Codan, TDC Erhverv osv.) er upaavirkede

## Tekniske detaljer
- 1 SQL UPDATE (29 regler faar effective_from = NULL)
- 22 SQL INSERTs (universelle fallback-regler for Eesy FM)
- 1 edge function kald (rematch for Eesy)
- Ingen kodeaendringer
