

## Fix: Brug `get_sales_report_detailed` RPC til korrekte salgstal

### Problem
Den nuværende `useClientForecast` henter **alle** salg fra `sales`-tabellen uden team-filter og rammer Supabase's 1000-rækkers grænse. Desuden filtrerer den ikke på `client_campaigns` eller `validation_status`, som den eksisterende rapporteringslogik gør.

### Løsning
Brug den allerede eksisterende `get_sales_report_detailed` RPC-funktion, som:
- Korrekt joiner `sales → sale_items → products → agents → employee_master_data`
- Filtrerer på `client_campaign_id` (via client_id)
- Ekskluderer rejected salg
- Kun tæller produkter med `counts_as_sale = true`
- Kører som SECURITY DEFINER (ingen RLS-problemer)

### Nødvendig ændring

**Database**: Tilføj `client_id` kolonne til `forecast_settings` så vi ved hvilken klient teamet tilhører (behøves for RPC-kaldet). Alternativt kan vi slå det op via teamets medarbejdere → client_campaigns, men en direkte reference er simplere.

**`src/hooks/useClientForecast.ts`**:
1. Kald `get_sales_report_detailed(client_id, monthStart, cutoffDate)` i stedet for den rå sales-query
2. Match RPC-resultatet (som returnerer `employee_name, product_name, quantity`) til teammedlemmer
3. Summer `quantity` per medarbejder for at få faktisk salg MTD
4. Resten af beregningen (projected, rolling avg, etc.) forbliver uændret

**`src/components/forecast/CreateForecastDialog.tsx`**: 
- Tilføj client_id lookup baseret på valgt team (via client_campaigns relation)
- Gem client_id i forecast_settings ved oprettelse

### Fordele
- Bruger **præcis** samme logik som Salgsrapporter-siden
- Ingen 1000-rækkers begrænsning (RPC kører server-side)
- Korrekt filtrering på validation_status og counts_as_sale

### Berørte filer
- Migration: tilføj `client_id` til `forecast_settings`
- `src/hooks/useClientForecast.ts` — erstat rå sales-query med RPC
- `src/components/forecast/CreateForecastDialog.tsx` — gem client_id
- `src/hooks/useForecastSettings.ts` — inkluder client_id i typen

