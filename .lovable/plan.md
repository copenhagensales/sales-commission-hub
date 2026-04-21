

## Kortlæg Alka's nye API-adgang via probe-script

### Mål
Du ved ikke præcis hvad I har fået åbnet — så jeg bygger et målrettet **probe-script** (edge function) der systematisk kalder relevante HeroBase-endpoints med Alka's credentials og rapporterer:

1. Hvilke endpoints svarer 200 vs 401/403/404
2. Hvilke nye felter dukker op pr. lead i forhold til i dag
3. Hvilken granularitet vi kan få på opkald, sessions og kampagner

Resultatet vises i et overskueligt JSON-rapport vi kan bruge som beslutningsgrundlag før vi rører selve `EnreachAdapter`.

### Nuværende tilstand (verificeret)
- Alka-integration: `48d8bd23-...`, host `wshero01.herobase.com/api`, samme host som ASE og Tryg
- Bruger i dag `/simpleleads?Projects=*&ModifiedFrom=...&AllClosedStatuses=true`
- Payload-felter på top-niveau: `uniqueId, status, closure, campaign, priority, data, ownerOrgUnit, uploadedByUser, lastModifiedByUser, firstProcessedByUser, uploadTime, firstProcessedTime, lastModifiedTime, closureData`
- `data`-objekt for et eksempel-salg: `Resultat, Mødedato, Mødetidspunkt, cusFornavn, cusEfternavn, cusAdresse, cusPOSTNR, cusPOSTDISTRIKT, cusBoligform, cusKUNDE_ID, cusPART_ID, cusTELEFONNR_MOBIL, Kontaktnummer, age` (Tryg/Alka kundefelter)

### Hvad probe-scriptet tjekker

**Endpoints (med Alka credentials):**
| Endpoint | Hvad det fortæller |
|---|---|
| `/myaccount/request/limits` + `/counts` | Hvilken kvote/plan Alka-brugeren har nu |
| `/projects` | Hvilke kampagne-projekter Alka-API-brugeren ser |
| `/campaigns` | Liste af kampagner med metadata (mål, status, ejere) |
| `/simpleleads?Projects=*` | Baseline — det vi har i dag |
| `/leads?Include=data,campaign,lastModifiedByUser,firstProcessedByUser,closureData,questions,answers,attempts,history` | Den "rige" variant — finder ud af hvilke `Include=`-flags der nu er åbnet |
| `/leads/{uniqueId}?Include=*` | Detalje-payload for et enkelt Alka-lead — viser ALLE felter der findes |
| `/calls?OrgCode=…&StartTime=…&TimeSpan=PT24H&Limit=100` | Om vi har CDR/opkaldsdata på Alka (i dag bruges kun for Eesy) |
| `/sessions?…` | Om vi kan trække sessions/hitrate-data |
| `/hooks` + `/hooks/meta` | Om vi kan tilmelde webhooks for Alka (vi bruger det allerede til andre) |
| `/users` evt. `/agents` | Om der er en dedikeret bruger-/agent-liste |

**Rapport pr. endpoint:**
- HTTP status + evt. fejl-besked
- Antal records returneret
- For lead-endpoints: union af alle nøgler set i `data`-objektet (sammenlignet med baseline) → fremhæver **nye felter**
- For `/calls`, `/sessions`: et eksempel-record så vi kan se feltstrukturen
- Rate limit-headers (`X-Rate-Limit-Remaining`, `Reset`) så vi ved om probe påvirker kvoten

### Implementering

**Ny edge function:** `supabase/functions/probe-enreach-integration/index.ts`
- Input: `{ integration_id }` (default Alka)
- Henter credentials via `get_dialer_credentials`-RPC (samme mønster som `test-ase-leads`)
- Kører alle ovenstående kald sekventielt med små pauser (respekterer rate limit)
- Returnerer struktureret rapport:

```json
{
  "integration": "alka",
  "host": "wshero01.herobase.com/api",
  "rateLimits": { "limits": {...}, "counts": {...} },
  "endpoints": {
    "/projects": { "ok": true, "count": 4, "sample": {...} },
    "/campaigns": { "ok": true/false, "status": 200/404, ... },
    "/leads (rich Include)": {
      "ok": true,
      "count": 25,
      "newDataFieldsVsBaseline": ["police_nr", "produkt", "..." ],
      "allDataFields": [...],
      "samplePayload": {...}
    },
    "/calls": { "ok": true/false, "count": 12, "sample": {...} },
    "/sessions": { ... },
    "/hooks": { ... }
  },
  "recommendations": [
    "Skift Alka fra /simpleleads til /leads med Include=… for at få X nye felter",
    "Aktiver call-sync — endpointet svarer nu 200 for orgCode TRYG Forsikring A/S"
  ]
}
```

**Trigger-knap i UI** (`src/pages/Settings.tsx` eller integration-detalje-siden): "Probe API-adgang" der kalder funktionen og viser rapporten i et dialog/JSON-viewer. Alternativt kan vi bare køre den én gang via `supabase--curl_edge_functions` og dele output i chatten — det er hurtigere hvis du ikke har brug for et permanent UI.

### Næste skridt EFTER probe (ikke en del af denne plan)
Når vi ved hvad der er åbnet, beslutter vi:
- Om Alka skal flyttes til `/leads`-endpointet (kræver ændring i `usesLeadsEndpoint`-getteren i `enreach.ts`)
- Om vi skal aktivere `/calls`-sync for Alka (kræver `callsOrgCodes` i registry-kaldet)
- Om nye felter skal mappes som produkter via `productExtraction.conditionalRules`

### Filer der berøres
- **Ny:** `supabase/functions/probe-enreach-integration/index.ts`
- **Valgfri:** lille knap i `src/pages/Settings.tsx` til at trigge probe og vise rapport
- `supabase/config.toml` — funktionen behøver ikke speciel config, deployes med default

### Hvad jeg ikke rører i denne runde
- `EnreachAdapter` (ingen sync-ændringer før vi har rapporten)
- Andre integrationer (ASE, Eesy, Tryg)
- Cron-schedules
- Pricing rules / produktmapping

### Verificering
- Probe kører fejlfrit mod Alka og returnerer status for alle 8-10 endpoints
- Rapporten lister konkret hvilke `data`-felter der er nye sammenlignet med dagens baseline
- Rate limit-tæller står stadig sundt efter kørsel (probe bruger <50 kald)
- Vi kan i chat-svaret se en konkret anbefaling: "I har nu adgang til X, Y, Z — næste skridt er…"

