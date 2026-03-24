

# Fix: TDC OPP Backfill bruger forkert API-endpoint

## Fund

De "failed" og "pending" salg mangler OPP-numre fordi backfill-funktionen kalder `/v1/leads/{leadId}` — men leads i Adversus bliver genbrugt/slettet, så API'en returnerer tomt data.

De succesfuldt "healed" salg har en `raw_payload`-struktur der stammer fra `/v1/sales/{orderId}` endpointet, som inkluderer `leadResultData` med OPP-numre — også efter leads er genbrugt.

**Nøgletal:**
| Status | Antal | Har OPP | Handling |
|---|---|---|---|
| failed + har OPP | 28 | Ja | Markér som "healed" (data er allerede der) |
| failed + mangler OPP | 84 | Nej | Genhent via `/sales/{orderId}` |
| pending + mangler OPP | 241 | Nej | Genhent via `/sales/{orderId}` |
| **Total at fixe** | **353** | | |

## Løsning

### 1. Ret backfill-funktionen: brug `/v1/sales/{orderId}` i stedet for `/v1/leads/{leadId}`

**Fil: `supabase/functions/tdc-opp-backfill/index.ts`**

- Ændr API-kaldet fra `GET /v1/leads/${leadId}` til `GET /v1/sales/${sale.adversus_external_id}` (ordre-ID)
- `/v1/sales/{id}` returnerer hele ordren inkl. `leadResultData` med OPP-numre — selv når leadet er genbrugt
- Fjern kravet om `leadId` i filtreringen (vi bruger `adversus_external_id` i stedet)
- Bevar den eksisterende `leadResultFields`-mapping fra `leadResultData`

### 2. Inkludér "failed" salg i query'en

- Udvid query til også at hente salg med `enrichment_status = 'failed'` (ikke kun "pending")
- Skip salg der allerede har OPP i `leadResultFields` (de 28 stk markeres direkte som "healed")

### 3. Migration: markér de 28 "failed" der allerede har OPP

- Kør en SQL-migration der sætter `enrichment_status = 'healed'` for de 28 salg der fejlagtigt er markeret som "failed" men allerede har OPP-data

## Estimeret kørselstid
- 325 salg × 1.05s delay ≈ **6 minutter** med autoRun
- Derefter invokering af funktionen

