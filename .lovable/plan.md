

## Konfigurer ALKA API med produktregler, datafiltre og org codes

### Analyse af sample-data
Test-kaldet viser at ALKA API'et har **nøjagtig samme datastruktur** som Tryg:
- `data.Resultat` — bruges til at matche succesfulde leads
- `campaign.code` — bruges i produktnavnet (f.eks. "Meeting -- MB_Agentur Villa alle områder")
- `lastModifiedByUser.orgCode` — bruges til org code filtrering
- `firstProcessedByUser.orgCode` — fallback for agent-attribution

### Ændringer

#### 1. Opdater `dialer_integrations.config` for ALKA (database UPDATE)
Sæt config identisk med Tryg:
```json
{
  "productExtraction": {
    "strategy": "conditional",
    "conditionalRules": [{
      "conditionKey": "Resultat",
      "conditionValue": "",
      "extractionType": "composite",
      "productNameTemplate": "Meeting -- {{campaign.code}}"
    }],
    "dataFilters": [{
      "field": "lastModifiedByUser.orgCode",
      "operator": "contains",
      "value": "@copenhagensales.dk"
    }]
  },
  "sync_frequency_minutes": 15,
  "sync_schedule": "4,19,34,49 * * * *"
}
```

#### 2. Sæt `calls_org_codes` for ALKA
Sæt til `["Copenhagen sales"]` ligesom Tryg, så sessions/calls filtreres korrekt.

#### 3. Tilføj ALKA til `tv-dashboard-data` mappings
Map `alka` → ALKA client ID `0a8048ac-ac28-4999-b1a7-5d1238d7fc2c` i TV dashboard-funktionen.

### Ingen kodeændringer i adapteren
Enreach-adapteren håndterer allerede denne konfiguration generisk — det er kun database-config og én edge function der skal opdateres.

### Filer der ændres
1. **Database**: UPDATE `dialer_integrations` config og calls_org_codes for ALKA (ID: `48d8bd23-df14-41fe-b000-abb8a4d6cd1d`)
2. **`supabase/functions/tv-dashboard-data/index.ts`** — tilføj `alka` mapping

