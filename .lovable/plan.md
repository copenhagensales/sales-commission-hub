

## Kør enrichment-healer for Eesy TM salg

### Problem
De 19 Eesy TM salg mangler kontaktdata (`customer_phone` er NULL). Enrichment-healeren skal køres for at hente lead-data fra Adversus API'en via de nye CPHSalesAPI-credentials.

### Forudsætninger (allerede opfyldt)
- Integrationen "Eesy TM" eksisterer med korrekte credentials (ID: `fe87f6eb-dc6a-4209-9a47-d84054381452`)
- Enrichment-healeren matcher salg via `source`-feltet (= integrationsnavn "Eesy TM") og henter credentials via `getCredentialsByName("Eesy TM")`
- Healeren bruger `leadId` fra `raw_payload` til at hente lead-data fra `https://api.adversus.io/v1/leads/{leadId}`

### Trin

**1. Sæt enrichment_status til "pending" for Eesy TM salg**
- Kør UPDATE via insert-tool: sæt `enrichment_status = 'pending'` og `enrichment_attempts = 0` for alle salg med `source = 'Eesy TM'` der har `customer_phone IS NULL`
- Dette sikrer at healeren finder dem

**2. Kør enrichment-healer**
- Kald `supabase.functions.invoke("enrichment-healer", { body: { provider: "adversus", turboMode: true, maxBatch: 50 } })`
- Healeren vil:
  - Finde salg med `enrichment_status = 'pending'`
  - Gruppere dem under source "Eesy TM"
  - Hente credentials for "Eesy TM" integrationen
  - For hvert salg: hente lead-data fra Adversus API → opdatere `raw_payload` med `leadResultFields` + `leadResultData` + `customer_phone`

**3. Verificer resultater**
- Tjek at `customer_phone`, `raw_payload.leadResultFields` og `raw_payload.leadResultData` er udfyldt på de behandlede salg

### Hvad vi får med
Enrichment-healeren henter alt tilgængeligt fra Adversus `/leads/{id}` endpoint:
- Telefonnummer (→ `customer_phone`)
- Lead result data (alle felter fra lead-formularen inkl. OPP-nummer)
- Lead result fields (normaliseret key-value format)
- Kontaktdata (firma, telefon, email osv.)

