## Opdater RelatelProductsBoard.tsx

Erstat den nested PostgREST-query med kald til den nye RPC `get_relatel_product_counts`.

### Ændringer i `src/components/dashboard/RelatelProductsBoard.tsx`

1. Fjern `categorizeProduct`-helperen (logikken ligger nu i DB).
2. Erstat `useQuery`-body med:
   ```ts
   const { data, error } = await supabase.rpc("get_relatel_product_counts", {
     p_from: from.toISOString(),
     p_to: to.toISOString(),
   });
   if (error) throw error;
   return data?.[0] ?? { mobile_voice: 0, mobilt_bredbaand: 0, switch: 0 };
   ```
3. Behold periodevælger, UI-kort og query-key uændret (så cache invalidation virker som før).
4. Fjern nu ubrugte imports (fx `RELATEL_CLIENT_ID` hvis ikke længere brugt frontend-side).

### Zone
Gul (dashboard reporting). Ingen ændringer i pricing/løn/RLS. RPC er allerede deployet i forrige migration.
