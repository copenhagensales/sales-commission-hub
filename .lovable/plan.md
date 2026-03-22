
## Konklusion

Jeg har undersøgt det grundigt, og problemet er nu konkret lokaliseret:

```text
DailyReports:
sales (FM) filtreret på raw_payload.fm_seller_id
→ 42 salg / 18.480 kr for Frederik

Liga:
league-calculate-standings
→ get_sales_aggregates_v2
→ sales JOIN sale_items
→ 31 salg / 13.640 kr for Frederik
```

Det er altså **ikke** primært et UI-problem og **ikke** bare et periode-problem.

## Hvad jeg fandt

- Aktiv kvalifikationsperiode er: **15/03/2026 → 22/03/2026**
- Frederik Forman i liga-tabellen står aktuelt med **13.640 kr / 31 salg**
- I rå FM-salg for samme periode har Frederik faktisk **42 salg**
- **11 af de 42 FM-salg mangler `sale_items`**
- De 11 manglende ligger alle på **20/03**
- Produkterne findes og giver **440 kr pr. salg**
- Gapet er derfor præcist:
  - **11 × 440 = 4.840 kr**
  - **13.640 + 4.840 = 18.480 kr**

Det matcher præcis det tal du siger er korrekt.

## Hvorfor det sker

### Dagsrapporter
`src/pages/reports/DailyReports.tsx` har en separat FM-logik, der læser direkte fra `sales` og bruger:
- `raw_payload.fm_seller_id`
- `raw_payload.fm_product_name`
- produkt-priser fra `products`

Derfor tæller dagsrapporten også FM-salg, **selv når `sale_items` mangler**.

### Liga
`supabase/functions/league-calculate-standings/index.ts` kalder `get_sales_aggregates_v2`.

Den funktion aggregerer via:
- `sales`
- `JOIN sale_items`

Så når FM-salg mangler `sale_items`, bliver de usynlige for ligaen.

## Omfang

Det rammer ikke kun Frederik i den aktive kvalifikationsperiode:

- Frederik Forman: **11 manglende**
- Josefine Marie Eckerl Kaaring: **5 manglende**
- Sandra Rosenbaum: **4 manglende**

I alt: **20 FM-salg uden `sale_items`** i den aktuelle liga-periode.

## Hvad der skal bygges

### 1. Reparer de manglende FM `sale_items`
Lav en migration der backfiller alle FM-salg uden `sale_items` ved at genbruge den eksisterende FM-backfill-logik:
- match `raw_payload.fm_product_name` mod `products`
- brug prisregel/basepris
- indsæt manglende `sale_items`

Det vil få Frederik til at hoppe fra **13.640 → 18.480** uden at ændre liga-UI.

### 2. Harden FM-flowet så det ikke sker igen
Gør FM-oprettelsen mere robust, så et salg ikke kan ende i `sales` uden tilsvarende `sale_items`:
- opdater trigger-strategien så den også kan hele manglende items efterfølgende
- behold idempotency, så samme salg ikke dobbelttælles
- tilføj en integritets-check for FM-salg uden `sale_items`

### 3. Behold ligaen på backendens fælles aggregat
Når data er repareret, kan ligaen fortsætte med at bruge `get_sales_aggregates_v2`.
Det er bedre end at bygge endnu en speciallogik i ligaen.

### 4. Genberegn ligaen efter repair
Efter backfill:
- kør `league-calculate-standings` igen
- verificér Frederik = **42 salg / 18.480 kr**
- verificér også Josefine og Sandra

## Filer der bør ændres

| Fil | Ændring |
|---|---|
| ny migration i `supabase/migrations/...` | Backfill manglende FM `sale_items` + trigger-hardening |
| evt. FM trigger-definition i migration | Gør healing robust ved manglende items |
| `supabase/functions/league-calculate-standings/index.ts` | Sandsynligvis ingen logikændring nødvendig efter data-fix |
| `src/hooks/useFieldmarketingSales.ts` | Evt. ekstra safeguard efter manuelle inserts |
| `src/pages/vagt-flow/EditSalesRegistrations.tsx` | Evt. ekstra safeguard efter manuelle inserts |

## Anbefalet implementeringsrækkefølge

1. Backfill de manglende FM `sale_items`
2. Hardén trigger / repair-flow
3. Genkør liga-beregning
4. Verificér Frederik, Josefine og Sandra mod dagsrapporter for samme periode

## Succeskriterie

- Frederik Forman står i ligaen med **18.480 kr**
- Liga og dagsrapporter stemmer overens for samme periode
- Nye FM-salg kan ikke længere “falde ud” pga. manglende `sale_items`
