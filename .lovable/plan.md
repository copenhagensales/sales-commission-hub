

## Vis kun ikke-skjulte produkter i produkt-mapping dropdown

### Problem
Produkt-listen i "Internt produkt"-dropdown'en viser også skjulte produkter (`is_hidden = true`). Den filtrerer allerede på `is_active`, men mangler filter på `is_hidden`.

### Ændring
**Fil:** `src/components/cancellations/SellerMappingTab.tsx`

I `ProductMappingSection`, tilføj `.eq("is_hidden", false)` til produkter-queryen (ca. linje 162):

```typescript
const { data, error } = await supabase
  .from("products")
  .select("id, name, client_campaign_id")
  .in("client_campaign_id", campaignIds)
  .eq("is_active", true)
  .eq("is_hidden", false)   // ← tilføj denne linje
  .order("name");
```

Én linje tilføjet — ingen andre ændringer nødvendige.

