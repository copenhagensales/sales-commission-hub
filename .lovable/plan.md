

## Plan: Tilføj title-baseret fallback-opslag i webhook produktmapping

### Problem
Webhook'en slår kun op i `adversus_product_mappings` via `adversus_external_id`. Når Adversus sender et nyt numerisk ID (f.eks. `9515`) for et produkt der allerede er mappet via titel (f.eks. `"Fri tale + 170 GB data (5G) (6 mdr. binding)"`), finder den ingen mapping og markerer salget som `needs_mapping = true`.

### Løsning
Tilføj et ekstra opslag i **begge webhook-filer** så de også tjekker `adversus_product_title` i `adversus_product_mappings` inden de opgiver:

**Filer der ændres:**
1. `supabase/functions/dialer-webhook/index.ts`
2. `supabase/functions/adversus-webhook/index.ts`

### Ændring (identisk i begge filer)

Efter det eksisterende `adversus_external_id`-opslag (linje ~222-244 i dialer-webhook), og **før** det direkte `products`-navneopslag, tilføj:

```text
Eksisterende flow:
  1. Slå op via adversus_external_id → fundet? → brug product_id
  2. [NY] Slå op via adversus_product_title → fundet? → brug product_id + opdater mapping med nyt external_id
  3. Slå op direkte i products via titel → fundet? → opret mapping
  4. Ellers → needs_mapping = true
```

Trin 2 (nyt) gør følgende:
- Query `adversus_product_mappings` med `.eq('adversus_product_title', product.title)` og `.not('product_id', 'is', null)`
- Hvis fundet: sæt `mappedProductId`, hent provision/omsætning fra `products`, sæt `needsMapping = false`
- Opdater den fundne mapping-row med det nye `adversus_external_id` så fremtidige opslag er hurtigere

### Eksisterende items

For de nuværende `needs_mapping`-items (9515, 9457, 7755): Kør `rematch-pricing-rules` efter deploy — den resolver allerede via titel og vil automatisk sætte `product_id` og `needs_mapping = false`.

### Ingen database-ændringer
Alt bruger eksisterende tabeller og kolonner. Kun edge function-kodeændringer + redeploy.

