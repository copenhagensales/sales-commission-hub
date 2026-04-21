

## Diagnose: Hvorfor agent-emailen er tom på Alka-leads (kun Alka API)

### Nuværende viden
- 18.574 Alka-leads tjekket via `/simpleleads` → **0 har email på `lastModifiedByUser`**
- Agent identificeres kun via `orgCode` (fx `T02OLJE`, `T01CSIM`)
- `/users` (587 brugere) indeholder emails (`@tryg.dk` m.fl.) — data findes, men leveres ikke inline med leads
- Vi kalder `/simpleleads` UDEN `Include`-parameter (ASE bruger `Include` på `/leads`-endpointet)

### Mål for denne fase
Bekræft hvilken af 3 årsager der reelt blokerer email-attribution — så Fase 2's design bliver korrekt første gang. **Kun Alka API kaldes**, ingen andre integrationer røres.

### Tjek der tilføjes til probe (Alka-only)

**Fil:** `supabase/functions/probe-enreach-integration/index.ts` (kører kun mod `integration_id=48d8bd23-...`)

**Tjek A — `Include` på `/simpleleads`**  
Kald `/simpleleads?Projects=*&ModifiedFrom=...&Include=lastModifiedByUser,firstProcessedByUser&Limit=10` mod Alka. Sammenlign payload med baseline-kald uden `Include`. Rapportér: er `email`-feltet nu udfyldt?

**Tjek B — Krydsreferér orgCode mod `/users`**  
Hent `/users` (Alka credentials, 587 brugere), byg map `orgCode → { email, name }`. For de 86 unikke orgCodes vi så i lead-auditten: hvor mange kan slås op? Hvilke email-domæner dominerer?

**Tjek C — `/leads/{uniqueId}` på et enkelt Alka-lead**  
`/leads` (liste) gav 500 globalt, men detalje-endpointet er muligvis åbent. Prøv på 1 konkret Alka `uniqueId` med `Include=lastModifiedByUser,firstProcessedByUser` for at se om enkelt-payload har user-info.

### Output-format

Rapporten skal give entydigt svar:

```
agentDiagnosis: {
  testA_includeOnSimpleleads: { worked: true/false, sampleEmail: "..." },
  testB_orgCodeToUserMap: { 
    totalOrgCodes: 86, 
    matchedInUsers: <n>, 
    topDomains: { "@tryg.dk": <n>, ... } 
  },
  testC_leadsDetail: { worked: true/false, sampleEmail: "..." },
  recommendation: "Brug Include på /simpleleads" | "Pre-fetch /users og byg orgCode-map" | "Kombinér"
}
```

### Filer der berøres
- `supabase/functions/probe-enreach-integration/index.ts` (udvid med 3 tjek)

### Hvad jeg IKKE rører
- Andre integrationer (Tryg, Eesy, ASE, Adversus) — probe kalder kun Alka credentials
- `EnreachAdapter`, sync-logik, calls-sync, andre edge functions
- Database (ren read-only diagnose)
- Rate limit: probe bruger <20 nye kald, deles med Alka's egen kvote

### Næste skridt
Kør probe → læs rapport → vælg endeligt Fase 2-design (Include-parameter VS user-pre-fetch VS hybrid).

