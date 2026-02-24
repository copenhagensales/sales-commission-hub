

# Fix: Udvid soegning i "Sync enkelt salg" til at inkludere raw_payload

## Problem

Soegningen i `SyncSingleSaleDialog` soeger kun paa 6 standardkolonner via `.or()`. Telefonnummeret "36685603" ligger i `raw_payload` JSONB-feltet (ikke i `customer_phone` som er `null`), saa soegningen finder det ikke.

## Loesning

Brug den eksisterende `search_sales` RPC-funktion (oprettet tidligere), som soeger paa baade standardkolonner OG `raw_payload::text`. Dette giver fuld soegning i alle felter.

## Aendring

### Fil: `src/components/settings/SyncSingleSaleDialog.tsx`

Erstat den nuvaerende `.or()` soegning (linje 91-107) med et to-trins flow:

1. Kald `search_sales` RPC for at faa matchende sale IDs (soeger i alle felter inkl. `raw_payload::text`)
2. Hent de fulde sale-records via `.in("id", matchedIds)` med filtrering paa `integration_type`

```typescript
// Foer (linje 91-107):
const orFilter = [
  `adversus_external_id.ilike.%${q}%`,
  ...
].join(",");
const { data, error } = await supabase
  .from("sales")
  .select(...)
  .or(orFilter)
  .eq("integration_type", provider)
  ...

// Efter:
// Trin 1: Hent matchende IDs fra RPC (soeger i ALLE felter inkl. raw_payload)
const { data: matchedIds, error: rpcError } = await supabase
  .rpc("search_sales", { search_query: q, max_results: 50 });
if (rpcError) throw rpcError;
if (!matchedIds?.length) {
  setSearchResults([]);
  toast.info("Ingen salg fundet for soegningen");
  return;
}

// Trin 2: Hent fulde records filtreret paa provider
const { data, error } = await supabase
  .from("sales")
  .select("id, adversus_external_id, agent_name, agent_email, customer_company, customer_phone, sale_datetime, enrichment_status, internal_reference, integration_type")
  .in("id", matchedIds)
  .eq("integration_type", provider)
  .order("sale_datetime", { ascending: false })
  .limit(10);
```

### Hvad dette loeser

- Telefonnumre i `raw_payload` (som "36685603") kan nu findes
- Lead IDs, Sales IDs og alle andre felter i JSON-payloaden er soegbare
- Filtrering paa `integration_type` (provider) bevares
- Ingen nye database-migrationer -- bruger den allerede oprettede `search_sales` RPC

