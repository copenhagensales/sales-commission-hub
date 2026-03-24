

# Vis reelle produktnavne + provision & omsætning i preview

## Problem
Preview-tabellen viser "Abonnement1" som produktnavn — det er bare et internt mapping-navn. Brugeren vil se det faktiske produktnavn fra `sale_items.adversus_product_title` (f.eks. "Eesy 12 timer", "5GI"). Desuden mangler provision (commission) og omsætning (revenue) kolonner.

## Ændringer i `UploadCancellationsTab.tsx`

### 1. Udvid `MatchedSale` interface
Tilføj felter:
- `realProductName?: string` — det faktiske produktnavn fra sale_items
- `commission?: number` — mapped_commission fra sale_items  
- `revenue?: number` — mapped_revenue fra sale_items

### 2. Udvid sale_items fetch (linje ~860-875)
Hent `mapped_commission`, `mapped_revenue` sammen med `adversus_product_title`:
```typescript
.select("sale_id, adversus_product_title, mapped_commission, mapped_revenue")
```

Opdater `saleItemsMap` typen til at inkludere commission/revenue.

### 3. Resolve reelt produktnavn i matching-logikken
**Pass 1 (telefon-match, linje ~800-815)**: Når et match findes via `payloadPhoneField`, slå sale_items op for det matchede salg og find det item der hører til den pågældende abo-position. Da "Telefon Abo1" korresponderer med det første abonnement osv., kan vi matche via positionen eller blot vise alle items for salget. Enklere: brug `saleItemsMap` til at finde items for salget og resolve det rigtige navn.

Konkret: efter match, tilføj `realProductName` og `commission`/`revenue` fra sale_items der matcher positionen.

**Pass 2 (seller+dato fallback)**: Allerede har `saleItemTitle` (f.eks. "5GI") — brug dette som `realProductName` og hent commission/revenue fra sale_items.

### 4. Opdater preview-tabel (linje ~1478-1510)
- Vis `sale.realProductName` i stedet for `sale.targetProductName` i Produkt-kolonnen
- Tilføj kolonne **Provision** med `sale.commission` formateret som DKK
- Tilføj kolonne **Omsætning** med `sale.revenue` formateret som DKK
- Vis altid Produkt-kolonnen (fjern conditional check)

### 5. Formattering
Brug `formatCurrency` fra `@/lib/calculations/formatting` for DKK-visning.

## Teknisk detalje
For Pass 1 matches: Vi ved at "Telefon Abo1" → position 1 i salgets produkter. Vi matcher sale_item ved at tjekke index/position eller ved at kigge på `adversus_product_title` patterns. Simplest: for hvert matched salg, hent alle sale_items og vis det item der matcher den abo-position (1/2/3) baseret på mapping-indekset. Alternativt vis alle items' navne som comma-separated hvis positional mapping er usikker.

