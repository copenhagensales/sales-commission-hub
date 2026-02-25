

## Fix: Adskil API-budget per integration (ikke per provider)

### Problem
Backend-funktionen `provider-sync.ts` summerer API-forbrug for **alle** Adversus-integrationer i en fælles pulje (1000 req/hr). Da Lovablecph og Relatel_CPHSALES har separate Adversus-konti med egne API-credentials, bør de have uafhængige budgetter. Den nuværende logik kan fejlagtigt stoppe den ene integration fordi den anden har brugt "for mange" kald.

### Løsning
Ændre `getBudgetUsage()` i `provider-sync.ts` til at beregne budget **per integration** i stedet for per provider. Dermed kan Lovablecph bruge op til 1000 req/hr uden at Relatel's forbrug påvirker det, og omvendt.

### Tekniske ændringer

**Fil: `supabase/functions/integration-engine/actions/provider-sync.ts`**

1. Ændre `getBudgetUsage()` til at modtage et enkelt `integrationId` i stedet for `provider`:

```text
// Fra: summerer alle integrationer for provideren
async function getBudgetUsage(supabase, provider, log): number
  -> henter ALLE integration IDs for provider
  -> summerer api_calls_made for dem alle

// Til: kun den specifikke integration
async function getIntegrationBudgetUsage(supabase, integrationId, log): number
  -> summerer api_calls_made kun for denne integration
```

2. Opdatere provider-sync-loopet til at tjekke budget per integration:

```text
for (const integration of integrations) {
  // Budget-check pr. integration (ikke samlet for provider)
  const integrationUsage = await getIntegrationBudgetUsage(supabase, integration.id, log);
  if (integrationUsage >= budgetThreshold) {
    skipped.push(integration.name);
    continue;
  }
  // ... sync integration ...
}
```

**Fil: `supabase/functions/integration-engine/actions/safe-backfill.ts`**

3. Tilsvarende ændring i `getProviderApiUsage()` -- begrænse budget-tjek til den specifikke integration der backfilles, ikke alle integrationer for provideren.

### Filer der ændres

| Fil | Ændring |
|---|---|
| `supabase/functions/integration-engine/actions/provider-sync.ts` | `getBudgetUsage` beregner per integration i stedet for per provider |
| `supabase/functions/integration-engine/actions/safe-backfill.ts` | `getProviderApiUsage` beregner per integration i stedet for per provider |

### Resultat
- Lovablecph og Relatel_CPHSALES kører med uafhængige budgetter (1000 req/hr hver)
- Ingen integration stoppes af en andens API-forbrug
- System Stability-dashboardet viser allerede korrekte per-integration tal (ingen frontend-ændring nødvendig)
