
# Plan: Opret Lead-Specifik Diagnostik Funktion

## Problemanalyse

### Hvad vi har opdaget:
1. **Sales API'en** (`/sales`) returnerer **altid tom** `leadResultData: []` for kampagne 98374 og 101396
2. **Leads API'en** (`/leads?filters=campaignId`) returnerer **korrekt** `resultData` med felter (bevist af diagnostik for kampagne 85913)
3. Synkroniseringslogikken i `adversus.ts` henter leads via `/leads` endpoint - men noget går galt for specifikke kampagner

### Root Cause Hypotese:
Den nuværende synkronisering bruger `/leads?filters=campaignId` til at bygge et lead-cache, men:
- Kampagne 98374 og 101396 har muligvis for mange leads (>5000 pageSize limit)
- Eller leads fra disse kampagner er "arkiverede" og ikke inkluderet i standard `/leads` query

## Løsning

Opret en ny diagnostik-funktion der tester et **specifikt lead ID** direkte via `/leads/{leadId}` endpoint for at verificere om Adversus API'en returnerer data for det lead.

### Ændringer:

**Fil: `supabase/functions/adversus-lead-check/index.ts`** (NY FIL)

Ny edge function der:
1. Modtager `integration_name` og `lead_id` som parametre
2. Henter credentials fra `dialer_integrations`
3. Kalder `/leads/{leadId}` endpoint direkte
4. Returnerer det fulde lead objekt inkl. `resultData`

```typescript
// Nøglefunktionalitet:
const leadUrl = `${baseUrl}/leads/${leadId}`;
const leadRes = await fetch(leadUrl, { headers: { Authorization: authHeader } });
const leadData = await leadRes.json();

return {
  leadId,
  hasResultData: (leadData.resultData || []).length > 0,
  resultData: leadData.resultData,
  resultFields: buildResultFields(leadData.resultData),
  fullLead: leadData
};
```

**Fil: `supabase/config.toml`**
- Tilføj konfiguration for den nye `adversus-lead-check` funktion

## Forventet Resultat

Efter deploy kan vi kalde:
```bash
curl -X POST /adversus-lead-check \
  -d '{"integration_name": "Relatel_CPHSALES", "lead_id": "966712638"}'
```

Og verificere om:
- Adversus API'en **kan** returnere resultData for det lead
- Eller om leadet virkelig ikke har nogen felter udfyldt i Adversus

## Næste Skridt (Efter Diagnostik)

Baseret på resultatet:
1. **Hvis lead HAR data**: Problemet er i synkroniseringslogikken (pagination/caching issue)
2. **Hvis lead IKKE har data**: Problemet er i Adversus kampagne-konfiguration
