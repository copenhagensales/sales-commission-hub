

## Fix: Kurv-rettelser dropdown viser forkerte/duplikerede produkter (kun Eesy FM)

### Problem
"Ret produkt til" dropdownen henter **alle** produkter globalt (ingen kampagne-scope). Den filtrerer kun på `target_product_name` (string), så brugeren ser enten kun ét match eller alle produkter — ofte med duplikater. Godkendelsen slår op med `.eq("name", ...)` som er tvetydigt.

### Root cause (linje 395-406)
```typescript
// Henter ALLE produkter uden filter
const { data } = await supabase.from("products").select("id, name").order("name");
```

### Ændringer — `src/components/cancellations/ApprovalQueueTab.tsx`

**A) Scope produkter til klientens kampagner**
- Hent kampagne-IDs for `clientId` (allerede tilgængelig i komponenten eller kan tilføjes).
- Ændr `clientProducts`-query til at filtrere produkter via `campaign_mappings` eller `client_campaigns` → `products` relationen, så kun relevante produkter for den valgte klients kampagner vises.
- Alternativt: hent produkter via `sale_items` der allerede er knyttet til kampagnens salg.

**B) Brug produkt-ID i stedet for navn**
- Ændr `SelectItem value={p.id}` (UUID) i stedet for `value={p.name}`.
- `productOverrides` gemmer nu produkt-ID i stedet for produktnavn.
- Dropdown viser `p.name` som label, men value er `p.id` → ingen duplikat-problemer.

**C) Opdater godkendelses-mutation (linje 746-749)**
- Ændr fra: `.eq("name", overrideProductName).maybeSingle()`
- Til: `.eq("id", overrideProductId).single()`
- Omdøb parameter fra `overrideProductName` til `overrideProductId`.

**D) Dedupliker dropdown på navn (Eesy FM)**
- Da flere produkter kan have samme navn men forskellige IDs, dedupliker visningen på navn så brugeren ser hvert unikt produktnavn én gang.
- Behold det første produkt-ID for hvert unikt navn.

### Scope
- Ændringer kun i `ApprovalQueueTab.tsx`
- Kun Eesy FM påvirkes af kampagne-scopet
- Andre klienter får også bedre produktvalg (ID-baseret) men er funktionelt upåvirkede
- Ingen databaseændringer

