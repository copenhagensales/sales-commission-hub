## Problem

I `ProductPricingRulesDialog` (åbnet fra MgTest når du redigerer et produkts prisregler) viser kampagne-multiselect ALLE `adversus_campaign_mappings` på tværs af alle klienter — også når `clientId` allerede er kendt og endda er nøgle i queryKey'en. Det gør listen ulæselig (Cph Sales Google, Switch, Winback osv. vises selvom produktet hører til Eesy TM).

## Løsning

Filtrer query'en på `client_campaign_id → client_campaigns.client_id = clientId`.

### Ændring (1 fil)

**`src/components/mg-test/ProductPricingRulesDialog.tsx`** — opdater `campaigns`-query (linje 126-138):

```ts
const { data: campaigns } = useQuery({
  queryKey: ["campaign-mappings-for-rules", clientId],
  queryFn: async () => {
    let query = supabase
      .from("adversus_campaign_mappings")
      .select("id, adversus_campaign_name, client_campaign_id, client_campaigns!inner(client_id)")
      .order("adversus_campaign_name");

    if (clientId) {
      query = query.eq("client_campaigns.client_id", clientId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as CampaignMapping[];
  },
  enabled: open,
});
```

### Edge cases
- **`clientId` mangler** (produkt uden klient-tilknytning): vis alle kampagner (nuværende adfærd) — så vi ikke ender med tom liste.
- **Eksisterende regler med kampagner fra anden klient**: Kan ske hvis nogen tidligere har valgt på tværs. De gemte IDs bevares i DB; de vises bare ikke i listen længere. Hvis det skal håndteres senere, kan vi tilføje en advarsel — ikke i scope nu.

### Zone
Gul (MgTest pricing-editor UI). Ingen ændring i pricing-motor eller skema. Ingen migration.

### Test
1. Åbn et Eesy TM-produkt → kampagnedropdown skal kun vise Eesy TM's kampagner (Mobilpriser, Karman, Admill, Pricebook m.fl.).
2. Åbn et Tryg-produkt → kun Tryg-kampagner.
3. "Vælg alle" / "Ryd" virker stadig på den filtrerede liste.