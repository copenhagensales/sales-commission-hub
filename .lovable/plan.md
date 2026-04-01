

## Smart kampagne-gætning med godkendelsesflow

### Hvad bygges
En ny "Foreslå kunder"-knap der analyserer umappede kampagner og foreslår den mest sandsynlige kunde baseret på flere signaler. Forslagene vises i en godkendelsesdialog hvor du kan acceptere/afvise hvert forslag inden tildeling.

### Signaler (prioriteret)

1. **Produktmatch** (stærkest): Slå kampagnens solgte produkter op i `sale_items` → match mod `adversus_product_mappings` → `products.client_campaign_id` → klient. Tæl antal hits per klient, vinderen med flest hits foreslås.
2. **Navnematch**: Eksisterende `parseClientFromTitle`-logik (kampagnenavn indeholder kundenavn efter separator).
3. **Agentoverlap**: Find hvilke agenter der sælger i kampagnen → se hvilke kunder de primært sælger for i allerede mappede kampagner.

Hvert signal giver en score, og den klient med højest samlet score vælges. Konfidensen vises som "Høj/Medium/Lav".

### UI-flow

1. Ny knap **"Foreslå kunder"** ved siden af "Auto-fordel"
2. Klik starter analyse af alle umappede kampagner
3. Åbner en **dialog** med en tabel:
   - Kampagnenavn | Foreslået kunde | Konfidens | Begrundelse | ✓/✗
   - F.eks.: "Admill Internettjek" → Eesy TM (Høj) — "12 produkter matcher Eesy TM"
   - Checkbox per række + "Vælg alle" for batch-godkendelse
4. "Godkend valgte" knap tildeler kun afkrydsede forslag

### Tekniske detaljer

**Fil: `src/pages/MgTest.tsx`**

- Ny state: `suggestionsDialog` (open/close), `suggestions[]` array, `selectedSuggestions` set
- Ny async funktion `generateClientSuggestions()`:
  1. Hent umappede kampagner (hvor `client_campaign_id IS NULL`)
  2. For hver: hent `sale_items` via `sales.dialer_campaign_id` → match produkttitler mod `adversus_product_mappings` → opslå produkt → `client_campaign_id` → tæl klient-hits
  3. Supplement med `parseClientFromTitle`
  4. Returnér array af `{ campaignId, campaignName, suggestedClientId, clientName, confidence, reason, saleCount }`
- Godkendelsesfunktion genbruger eksisterende `saveCampaignMapping`-logik
- For at undgå N+1 queries: batch-hent alle sale_items for umappede kampagner i ét query, og brug in-memory maps til opslag

**Performanceoptimering**: Én samlet query henter alle `sale_items` + `adversus_product_title` for umappede kampagner, og én query henter alle `products` med `client_campaign_id`. Alt matching sker client-side i memory.

