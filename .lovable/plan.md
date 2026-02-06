
# Plan: Fix "Tæl som bisalg" persistence bug

## Problemresumé
Indstillingen "Tæl som bisalg" gemmes korrekt i databasen, men vises ikke korrekt i MG Test fordi `counts_as_cross_sale` kolonnen mangler i datahentningen.

---

## Root Cause
Der er 4 steder hvor `counts_as_cross_sale` mangler:

| Sted | Problem |
|------|---------|
| RPC-funktion `get_aggregated_product_types` | Kolonnen returneres ikke |
| TypeScript interface `AggregatedProductRpc` | Felt mangler |
| Mapping af RPC → `AggregatedProduct` | Værdi overføres ikke |
| Query for manuelle produkter | Kolonne hentes ikke |

---

## Løsning

### 1. Opdater RPC-funktionen i databasen

Tilføj `counts_as_cross_sale` til return type og SELECT:

```sql
CREATE OR REPLACE FUNCTION public.get_aggregated_product_types()
RETURNS TABLE(
  -- eksisterende kolonner...
  counts_as_sale boolean,
  counts_as_cross_sale boolean,  -- NY
  is_hidden boolean,
  -- ...
)
AS $$
  SELECT DISTINCT ON (...)
    -- eksisterende...
    COALESCE(p.counts_as_sale, true) as counts_as_sale,
    COALESCE(p.counts_as_cross_sale, false) as counts_as_cross_sale,  -- NY
    -- ...
$$;
```

### 2. Opdater TypeScript interface

I `src/pages/MgTest.tsx` linje 37-50:

```typescript
interface AggregatedProductRpc {
  // ...eksisterende felter
  counts_as_sale: boolean;
  counts_as_cross_sale: boolean;  // TILFØJ
  is_hidden: boolean;
  // ...
}
```

### 3. Opdater RPC → AggregatedProduct mapping

I `src/pages/MgTest.tsx` linje 543-552:

```typescript
product: item.product_id
  ? {
      id: item.product_id,
      name: item.product_name ?? "",
      commission_dkk: item.commission_dkk,
      revenue_dkk: item.revenue_dkk,
      client_campaign_id: item.product_client_campaign_id,
      counts_as_sale: item.counts_as_sale ?? true,
      counts_as_cross_sale: item.counts_as_cross_sale ?? false,  // TILFØJ
      is_hidden: item.is_hidden ?? false,
    }
  : null,
```

### 4. Opdater manual products query

I `src/pages/MgTest.tsx` linje 392-413:

```typescript
const { data, error } = await supabase
  .from("products")
  .select(`
    id,
    name,
    commission_dkk,
    revenue_dkk,
    external_product_code,
    counts_as_sale,
    counts_as_cross_sale,  // TILFØJ
    is_hidden,
    client_campaign_id,
    client_campaigns!inner(...)
  `)
```

### 5. Opdater manual products mapping

I `src/pages/MgTest.tsx` linje 584-592:

```typescript
product: {
  id: p.id,
  name: p.name,
  commission_dkk: p.commission_dkk,
  revenue_dkk: p.revenue_dkk,
  client_campaign_id: p.client_campaign_id,
  counts_as_sale: p.counts_as_sale ?? true,
  counts_as_cross_sale: p.counts_as_cross_sale ?? false,  // TILFØJ
  is_hidden: p.is_hidden ?? false,
},
```

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| Database migration | Opdater RPC-funktion |
| `src/pages/MgTest.tsx` | 4 ændringer (interface + query + 2x mapping) |

---

## Dataflow efter fix

```text
Database: products.counts_as_cross_sale = true
           ↓
RPC: get_aggregated_product_types() returnerer counts_as_cross_sale
           ↓
MgTest.tsx: AggregatedProductRpc modtager værdien
           ↓
Mapping: AggregatedProduct.product.counts_as_cross_sale sættes korrekt
           ↓
Dialog: countsAsCrossSale prop har den rigtige værdi
           ↓
UI: "Tæl som bisalg" vises korrekt
```

---

## Verificering

Efter implementation:
1. Åbn et produkt (fx "Switch Contact Center #4")
2. Verificer at "Tæl som bisalg" er markeret
3. Luk dialogen og åbn igen
4. Verificer at indstillingen stadig er markeret
