

## Problem: Merge-dialogen viser ikke alle produkter

Merge-dialogen henter produkter med `is_active = true` og filtrerer via `client_campaign_id`. Men hovedtabellen viser produkter fra to kilder:
1. **RPC `get_aggregated_product_types`** (baseret på sale_items)
2. **`products`-tabellen** (manuelt oprettede)

Merge-dialogen bruger kun kilde 2, og filtrerer derudover inaktive produkter fra. Produkter uden `client_campaign_id` eller fra RPC-aggregeringen vises slet ikke.

### Fix

**Fil: `src/components/mg-test/ProductMergeDialog.tsx`**

I `loadProducts()`:
- Fjern `eq("is_active", true)` filteret, så alle produkter (inkl. potentielt inaktive varianter) vises
- Tilføj en visuel indikation (badge) på inaktive produkter, så brugeren kan se forskel
- Sikre at produkter uden `client_campaign_id` også kan indgå (vis dem under en "Ikke-tildelte" sektion eller inkluder dem altid)

Alternativt, hvis kun aktive produkter skal merges, behold `is_active = true` men sørg for at alle kampagne-IDs for kunden bliver hentet korrekt og at der ikke rammes en Supabase 1000-rækkers grænse.

### Anbefaling

Fjern `is_active`-filteret og vis alle produkter for kunden, med badge der viser status. Dette matcher hvad brugeren ser i hovedtabellen.

