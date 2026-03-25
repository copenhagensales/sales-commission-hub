

## Fix: Udvid produkt-dropdown med navne fra både annulleringer og kurv-rettelser

### Problem
Dropdown'en for Excel-produktnavne henter kun fra `cancellation_queue.target_product_name`, men den filtrerer ikke på `upload_type`. Hvis klienten primært har haft kurv-rettelser eller slet ingen uploads, er listen tom eller ufuldstændig.

### Løsning
**Fil:** `src/components/cancellations/SellerMappingTab.tsx`

Udvid den eksisterende `excelProductNames`-query til at hente `target_product_name` fra **alle** queue-rækker for klienten — uanset `upload_type` (både `cancellation` og `basket_difference`) og uanset `status` (pending, cancelled, basket_changed, rejected). Det dækker både igangværende og historiske uploads.

Derudover tilføjes en ekstra datakilde: unikke `adversus_product_title` fra `sale_items` for klientens kampagner, som fallback for klienter helt uden uploads.

### Ændringer

1. **Behold den eksisterende queue-query**, men fjern evt. implicit filtrering — den nuværende query henter allerede alle statuser og upload_types, men listen kan være tom hvis `target_product_name` ikke blev sat ved upload. Ingen ændring nødvendig her.

2. **Tilføj ny query** der henter unikke `adversus_product_title` fra `sale_items` via klientens kampagner (genbruger eksisterende `campaignIds`-query):
```typescript
const { data: saleItemNames = [] } = useQuery({
  queryKey: ["sale-item-product-names", campaignIds],
  queryFn: async () => {
    if (campaignIds.length === 0) return [];
    const { data, error } = await supabase
      .from("sale_items")
      .select("adversus_product_title")
      .in("sale_id", 
        supabase.from("sales").select("id").in("client_campaign_id", campaignIds)
      )
      .not("adversus_product_title", "is", null);
    if (error) throw error;
    return [...new Set(data.map(d => d.adversus_product_title).filter(Boolean))];
  },
  enabled: campaignIds.length > 0,
});
```

   Da Supabase JS-klienten ikke understøtter sub-selects i `.in()`, bruges i stedet en to-trins tilgang: først hentes salgs-IDs for kampagnerne, derefter hentes unikke produktnavne fra sale_items.

3. **Kombiner begge lister** og fjern allerede mappede navne:
```typescript
const allExcelNames = [...new Set([...excelProductNames, ...saleItemNames])]
  .sort((a, b) => a.localeCompare(b, "da"));
const availableExcelNames = allExcelNames.filter(n => !mappedNames.has(n));
```

4. **Forbedre fritekst-UX**: Tillad Enter-tast til at bekræfte manuelt skrevet navn og gør "Brug [navn]"-knappen tydeligere.

### Forventet resultat
- Dropdown viser produktnavne fra **alle** uploads (annulleringer + kurv-rettelser, aktive + historiske)
- Suppleret med produktnavne fra faktiske salg som fallback
- Klarere UX for manuel indtastning af nye navne

