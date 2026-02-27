

# Ret DataHealthChecks: praecis LEFT JOIN for "Salg uden sale_items"

## Problem
Den nuvaerende logik i `DataHealthChecks.tsx` bruger to upraecise metoder:
1. En `.not("id", "in", subquery)` som Supabase JS-klienten ikke understotter korrekt
2. En fallback der sammenligner `sale_items.created_at` med `sales.sale_datetime` -- de kan vaere forskellige, hvilket giver forkert taelling

Korrekt antal (verificeret med direkte SQL): **384 salg uden sale_items de seneste 24 timer**. UI viser aktuelt 184.

## Loesning
Opret en database-funktion med LEFT JOIN og kald den via RPC fra komponenten.

## AEndringer

### 1. Ny database-funktion (migration)

```sql
CREATE OR REPLACE FUNCTION public.get_sales_without_items_count(p_since timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE s.sale_datetime >= p_since
    AND si.id IS NULL;
$$;
```

### 2. Opdater `src/components/system-stability/DataHealthChecks.tsx`

Erstat linje 22-44 (den upraecise dobbelt-query logik) med et enkelt RPC-kald:

```typescript
// 1. Sales without sale_items (last 24h) -- accurate LEFT JOIN via RPC
const { data: orphanData } = await supabase.rpc("get_sales_without_items_count", {
  p_since: since24h,
});
const orphanCount = typeof orphanData === "number" ? orphanData : 0;

// Also fetch total sales for rejected ratio later
const { count: totalSales24h } = await supabase
  .from("sales")
  .select("id", { count: "exact", head: true })
  .gte("sale_datetime", since24h);
```

### Forventet effekt
- UI viser nu det korrekte antal (384 i stedet for 184)
- Eet enkelt database-kald i stedet for tre separate queries
- LEFT JOIN er den praecise metode til at finde salg uden tilhoerende sale_items

