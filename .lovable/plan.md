

## Problem: Produkter uden kampagne-tildeling mangler i merge-dialogen

**220 af 454 aktive produkter** har `client_campaign_id = NULL` (inkl. 4 Eesy-produkter). Merge-dialogen filtrerer på `client_campaign_id IN (kampagne-ids)`, så disse produkter vises aldrig.

### Fix

**Fil: `src/components/mg-test/ProductMergeDialog.tsx`** — `loadProducts()`

Ændre forespørgslen til at hente produkter i **to trin**:
1. Produkter med `client_campaign_id` i kundens kampagner (som nu)
2. Produkter med `client_campaign_id IS NULL` der har tilknytning til kunden via `sale_items` → `sales` → `integration` → `client_campaign`

Alternativt (simplere): Hent **alle produkter** (inkl. dem uden kampagne) og vis dem i en separat sektion "Ikke-tildelte produkter" i step 2, så brugeren kan inkludere dem i merge.

**Anbefalet tilgang**: Udvid queryen til også at hente produkter uden `client_campaign_id`, og vis dem samlet i listen med en badge "Ingen kampagne". Dette matcher hovedtabellens adfærd der bruger RPC-aggregering.

```typescript
// Hent kampagne-tildelte produkter
const { data: campaignProducts } = await supabase
  .from("products")
  .select("id, name, client_campaign_id, is_active")
  .in("client_campaign_id", campaignIds)
  .order("name");

// Hent produkter uden kampagne-tildeling
const { data: unassignedProducts } = await supabase
  .from("products")
  .select("id, name, client_campaign_id, is_active")
  .is("client_campaign_id", null)
  .order("name");

// Kombiner begge lister
setProducts([...(campaignProducts ?? []), ...(unassignedProducts ?? [])]);
```

UI i step 2 viser en separator eller badge for "Ikke-tildelte" produkter så brugeren kan skelne.

