

# ASE API Migration: /simpleleads til /leads?searchName=cphsales

## Oversigt
ASE har begrænset deres API-adgang. `/simpleleads`, `/users` og `/calls` er nu blokeret (403). Den eneste måde at hente salgsdata er via `/leads?searchName=cphsales`. Denne plan migrerer ASE-integrationen til det nye endpoint uden at påvirke andre integrationer (Tryg, Eesy osv.).

## Hvad virker / hvad er blokeret

| Endpoint | Status | Bruges af |
|----------|--------|-----------|
| /simpleleads | 403 BLOKERET | fetchSales, fetchSalesRange, fetchSalesRaw, fetchUsers, fetchSessionsRange |
| /users | 403 BLOKERET | (ikke brugt direkte - users udtrækkes fra leads) |
| /calls | 403 BLOKERET | fetchCalls, fetchCallsRange |
| /leads?searchName=cphsales | NYT endpoint | Skal bruges i stedet |
| /campaigns | 200 OK | fetchCampaigns |
| /projects | 200 OK | fetchAccessibleProjects |

## Implementeringsplan

### Trin 1: Test-funktion til at validere /leads datastruktur
Opret en midlertidig test edge function der kalder `/leads?searchName=cphsales&ModifiedFrom=2026-02-20` og logger det fulde response. Vi skal se:
- Paginerings-model (PageSize/PageNumber vs skip/take)
- Feltnavne (er det samme som simpleleads? uniqueId, closure, data, firstProcessedByUser osv.)
- Response-wrapper (array, Results, Leads?)

### Trin 2: Tilføj config-flag til ASE-integrationen
Tilføj `useLeadsEndpoint` og `leadsSearchName` til ASE's config i `dialer_integrations`:

```text
config.useLeadsEndpoint: true
config.leadsSearchName: "cphsales"
```

### Trin 3: Opdater EnreachAdapter med /leads support
Ændringer i `supabase/functions/integration-engine/adapters/enreach.ts`:

- **Ny metode**: `buildSalesEndpoint()` der vælger endpoint baseret på config:
  - Hvis `config.useLeadsEndpoint === true`: brug `/leads?searchName={config.leadsSearchName}&ModifiedFrom=...`
  - Ellers: brug `/simpleleads?Projects=*&ModifiedFrom=...` (uændret for Tryg/Eesy)

- **Tilpas paginering**: `/leads` bruger muligvis `PageSize`/`PageNumber` i stedet for `skip`/`take`. `processPageByPage` skal håndtere begge modeller.

- **Opdater disse metoder** til at bruge `buildSalesEndpoint()`:
  - `fetchSales()` (linje 317-491)
  - `fetchSalesRange()` (linje 494-632)
  - `fetchSalesRaw()` (linje 290-315)
  - `fetchUsers()` (linje 1196-1287) - udtrækker users fra leads
  - `fetchSessionsRange()` (linje 1571-1685)

- **Calls deaktiveret for ASE**: Da `/calls` er 403, skal adapter returnere tom array for ASE ved calls-sync.

### Trin 4: Opdater client-sales-overview edge function
Ændringer i `supabase/functions/client-sales-overview/index.ts`:
- Tilføj config-check for `useLeadsEndpoint`
- Brug `/leads?searchName=cphsales&ModifiedFrom=...` for ASE i stedet for `/simpleleads`

### Trin 5: Opdater enreach-diagnostics
Ændringer i `supabase/functions/enreach-diagnostics/index.ts`:
- Tilføj test af `/leads?searchName=cphsales` endpoint
- Vis sammenligning mellem gammel og ny datastruktur

## Hvad ændres IKKE
- Tryg, Eesy og andre integrationer: De fortsætter med `/simpleleads` uændret
- Webhook-parseren: Uændret (bruger ikke /simpleleads)
- Kampagne- og projekt-sync: Uændret (endpoints virker stadig)

## Risici og mitigering
- **Ukendt datastruktur**: `/leads` kan returnere felter med andre navne. Trin 1 (test) afdækker dette FØR vi koder om.
- **Paginering**: Hvis `/leads` ikke understøtter skip/take, skal vi tilpasse pagineringslogikken.
- **Sessions/hitrate**: Uden `/simpleleads` med `AllClosedStatuses=true` kan vi miste session-data for ASE. `/leads?searchName=cphsales` returnerer muligvis kun success-leads afhængig af visningens opsætning i HeroBase.

## Rækkefølge
1. Deploy test-funktion og valider datastruktur (Trin 1)
2. Baseret på resultaterne: tilpas adapter (Trin 2-3)
3. Opdater client-sales-overview (Trin 4)
4. Opdater diagnostik (Trin 5)
5. Test fuld sync-kørsel for ASE
6. Verificer at Tryg/Eesy fortsat virker uændret

