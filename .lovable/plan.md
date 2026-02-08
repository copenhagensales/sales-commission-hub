
# Plan: Datamapping-fane i MG Test - Komplet Implementering (Alle Faser)

## Oversigt
Denne plan implementerer en ny "Datamapping" fane i MG Test-siden med komplet integration til backend og frontend. Datamapping fungerer som et **normaliseringslag** der standardiserer rådata fra alle API'er (Adversus, Enreach/HeroBase) til ensartede feltnavne, med GDPR-compliance og automatisk sletning.

---

## Hvad der vil blive bygget

### Fase 1: Database + Frontend UI

#### Database-tabeller

**1. `data_field_definitions` - Standard Feltdefinitioner**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid | Primaer noegle |
| field_key | text | Intern noegle, UNIQUE (f.eks. "phone_number") |
| display_name | text | Visningsnavn (f.eks. "Telefonnummer") |
| category | text | Kategori: customer, sale, employee, campaign, product |
| data_type | text | Type: string, number, date, boolean |
| is_pii | boolean | Persoenfoelsomt (GDPR) - default false |
| is_required | boolean | Obligatorisk felt - default false |
| is_hidden | boolean | Skjult i UI - default false |
| retention_days | integer | Dage foer sletning (null = aldrig, 0 = straks) |
| description | text | Valgfri beskrivelse af feltet |
| created_at / updated_at | timestamptz | Tidsstempler |

**2. `integration_field_mappings` - API-to-Standard Mapping**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid | Primaer noegle |
| integration_id | uuid | FK til dialer_integrations |
| source_field_path | text | Sti i API-data (f.eks. "lead.phone") |
| target_field_id | uuid | FK til data_field_definitions (null hvis ekskluderet) |
| is_excluded | boolean | Ignorer dette felt helt |
| transform_rule | jsonb | Valgfri transformering |
| sample_value | text | Sidste sample-vaerdi fra API |
| created_at / updated_at | timestamptz | Tidsstempler |

#### Frontend-komponenter

| Fil | Beskrivelse |
|-----|-------------|
| `src/components/mg-test/DataMappingTab.tsx` | Hovedkomponent med to sektioner |
| `src/components/mg-test/FieldDefinitionsManager.tsx` | CRUD for standard feltdefinitioner |
| `src/components/mg-test/IntegrationMappingEditor.tsx` | Mapping-interface pr. integration |
| `src/components/mg-test/FieldDefinitionDialog.tsx` | Dialog til opret/rediger felt |

#### Pre-populerede Feltdefinitioner

| field_key | display_name | category | is_pii |
|-----------|--------------|----------|--------|
| phone_number | Telefonnummer | customer | true |
| customer_name | Kundenavn | customer | true |
| customer_email | Kunde email | customer | true |
| agent_email | Saelger email | employee | true |
| agent_name | Saelger navn | employee | true |
| sale_datetime | Salgstidspunkt | sale | false |
| opp_number | OPP-nummer | sale | false |
| campaign_id | Kampagne ID | campaign | false |
| product_name | Produktnavn | product | false |
| product_price | Enhedspris | product | false |

---

### Fase 2: Frontend Optimering - Normaliserede Data

#### Database-udvidelse

**Ny kolonne i `sales` tabellen:**

```sql
ALTER TABLE sales ADD COLUMN normalized_data jsonb DEFAULT NULL;
```

Denne kolonne gemmer normaliserede data baseret på datamapping-konfigurationen:

```json
{
  "phone_number": "45123456",
  "customer_name": "Firma ApS",
  "agent_email": "saelger@cph-sales.dk",
  "opp_number": "OPP12345",
  "coverage_amount": "6000",
  "association_type": "Fagforening med lønsikring"
}
```

#### Frontend-forbedringer

**Ny hook: `useNormalizedSalesData.ts`**

```typescript
// Abstrakt hook der kan vaelge mellem raw_payload og normalized_data
export function useNormalizedSalesData(saleIds: string[]) {
  // Returnerer normaliserede data hvis tilgængelig
  // Falder tilbage til raw_payload parsing hvis ikke
}
```

**Fordele:**
- Dashboards og rapporter kan bruge ensartede feltnavne
- Ingen parsing af dialer-specifik data i frontend
- Hurtigere queries (direkte adgang til normaliserede felter)

---

### Fase 3: Backend Integration

#### Ny utility-funktion: `applyDataMappings()`

Placeres i `supabase/functions/integration-engine/core/mappings.ts`:

```typescript
export async function applyDataMappings(
  supabase: SupabaseClient,
  integrationId: string,
  rawData: Record<string, unknown>,
  log: LogFn
): Promise<{
  normalizedData: Record<string, unknown>;
  piiFields: string[];
  excludedFields: string[];
  retentionRules: Map<string, number>;
}> {
  // 1. Hent field definitions og mappings for denne integration
  // 2. Gennemløb rawData og match mod source_field_path
  // 3. Transformer til target_field_key
  // 4. Marker PII-felter
  // 5. Ekskluder markerede felter
  // 6. Returner normaliseret objekt + metadata
}
```

#### Adapter-integration

Opdater `adversus.ts` og `enreach.ts` adapters:

```typescript
// I fetchSales() metoden, efter rå data er hentet:

// Hent datamapping for denne integration
const mappings = await getIntegrationFieldMappings(supabase, integrationId);

// Anvend mappings på hver sale
for (const rawSale of rawSales) {
  const { normalizedData, excludedFields } = applyDataMappings(
    integrationId,
    rawSale,
    mappings
  );
  
  // Fjern ekskluderede felter fra rawPayload
  for (const field of excludedFields) {
    delete rawSale[field];
  }
  
  // Tilføj normalizedData til StandardSale
  sale.normalizedData = normalizedData;
}
```

#### `core/sales.ts` opdatering

Gem normaliserede data til sales-tabellen:

```typescript
// I processSalesBatch():
const saleData = {
  // ... eksisterende felter
  raw_payload: sale.rawPayload,
  normalized_data: sale.normalizedData || null,  // NY
};
```

#### Pricing Rule Matching forbedring

Opdater `matchPricingRule()` til at prioritere normaliserede feltnavne:

```typescript
function matchPricingRule(
  productId: string,
  pricingRulesMap: Map<string, PricingRule[]>,
  leadResultData: Array<{ label: string; value: string }>,
  campaignMappingId?: string | null,
  log?: LogFn,
  rawPayloadData?: Record<string, unknown>,
  normalizedData?: Record<string, unknown>,  // NY PARAMETER
  saleDate?: string | null
) {
  // Prioriter normalized_data hvis tilgængelig
  const dataSource = normalizedData || rawPayloadData;
  
  // Resten af matching-logikken forbliver den samme
  // Nu med ensartede feltnavne på tværs af alle integrationer
}
```

---

### Fase 4: GDPR Scheduler (Automatisk Sletning)

#### Ny Edge Function: `gdpr-data-cleanup`

```typescript
// supabase/functions/gdpr-data-cleanup/index.ts

// Kører dagligt via pg_cron
// 1. Hent alle felter med retention_days > 0
// 2. Find sales hvor sale_datetime + retention_days < nu
// 3. For hvert felt: nullify i normalized_data og raw_payload
// 4. Log til audit trail
```

#### Cron Job Setup

```sql
SELECT cron.schedule(
  'gdpr-cleanup-daily',
  '0 3 * * *',  -- Kører kl. 03:00 hver dag
  $$
  SELECT net.http_post(
    url:='https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/gdpr-data-cleanup',
    headers:='{"Authorization": "Bearer ..."}'::jsonb
  );
  $$
);
```

---

## Dataflow (Komplet)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION ENGINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Adversus/Enreach API                                                       │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────┐                                                       │
│  │ Adapter          │  Henter rå data fra dialer                            │
│  │ (adversus.ts)    │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ applyDataMappings()                                    [NY]     │       │
│  ├──────────────────────────────────────────────────────────────────┤       │
│  │ 1. Læs integration_field_mappings for denne integration         │       │
│  │ 2. Match source_field_path mod raw data                         │       │
│  │ 3. Transformer til target_field_key                             │       │
│  │ 4. Marker PII-felter                                            │       │
│  │ 5. Ekskluder markerede felter (is_excluded = true)              │       │
│  │ 6. Håndter retention_days = 0 (gem aldrig)                      │       │
│  └────────┬─────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ StandardSale     │  Nu med normalizedData objekt                         │
│  │ + normalizedData │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ core/sales.ts    │  Eksisterende processeringslogik                      │
│  │                  │  (produktmapping, pricing rules, sælger-match)        │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ matchPricingRule()                               [OPDATERET]    │       │
│  │ Bruger normalized_data (ensartede feltnavne)                    │       │
│  │ Fallback til raw_payload for backward compatibility             │       │
│  └────────┬─────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ sales tabel      │  raw_payload + normalized_data (ny kolonne)           │
│  │ sale_items       │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ useSalesAggregates / useDashboardSalesData                      │       │
│  │ (UÆNDRET - fortsætter med at virke)                             │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ useNormalizedSalesData                                 [NY]     │       │
│  │ - Læser normalized_data hvis tilgængelig                        │       │
│  │ - Fallback til raw_payload parsing                              │       │
│  │ - Ensartede feltnavne i hele frontend                           │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ Dashboards & Rapporter                                          │       │
│  │ - Kan query på normalized_data jsonb direkte                    │       │
│  │ - F.eks: WHERE normalized_data->>'opp_number' = 'OPP123'        │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            GDPR SCHEDULER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  pg_cron (dagligt kl. 03:00)                                                │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ gdpr-data-cleanup edge function                        [NY]     │       │
│  │                                                                  │       │
│  │ 1. Hent felter med retention_days > 0                           │       │
│  │ 2. Find sales hvor sale_datetime + retention_days < nu          │       │
│  │ 3. For hvert PII-felt:                                          │       │
│  │    - Sæt til null i normalized_data                             │       │
│  │    - Sæt til null i raw_payload                                 │       │
│  │ 4. Log til audit trail                                          │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration med Eksisterende Systemer

### Produktmapping (Produkt-fanen) - UÆNDRET
- `adversus_product_mappings` tabel fortsætter uændret
- `products` tabel med pricing rules forbliver autoritativ
- Datamapping standardiserer produktdata FØR matching

### Sælger-merge (Medarbejder-fanen) - UÆNDRET
- `master_employee` og `employee_identity` tabeller forbliver autoritative
- `employee_agent_mapping` bruges fortsat
- Datamapping sikrer `agent_email` ekstraheres konsistent

### Kampagnemapping (Kampagne-fanen) - UÆNDRET
- `adversus_campaign_mappings` tabel forbliver autoritativ
- `reference_extraction_config` kan fremover referere til datamapping-felter

### Pricing Rules - FORBEDRET
- `matchPricingRule()` bruger nu normalized_data
- Ensartede feltnavne på tværs af alle integrationer
- F.eks.: "Dækningssum" fra Enreach og "coverage_amount" fra Adversus → begge mappes til `coverage_amount`

---

## Visuel Struktur (Datamapping-fane)

```text
+--------------------------------------------------------------------------------------+
| [Produkt] [Kampagne] [Medarbejder] [Kunder] [Client Sales] [Datamapping]             |
+--------------------------------------------------------------------------------------+
|                                                                                      |
|  +--------------------------------------------------------------------------------+  |
|  | Standard Feltdefinitioner                                    [+ Nyt felt]      |  |
|  +--------------------------------------------------------------------------------+  |
|  | Felt           | Kategori | Type   | PII | Skjult | Retention | Oblig. | Handl.|  |
|  +----------------+----------+--------+-----+--------+-----------+--------+-------+  |
|  | telefonnummer  | Kunde    | string | X   |        | 365 dage  | X      | [..] |  |
|  | kundenavn      | Kunde    | string | X   |        | 365 dage  |        | [..] |  |
|  | agent_email    | Medarb.  | string | X   |        | -         | X      | [..] |  |
|  | opp_nummer     | Salg     | string |     |        | -         |        | [..] |  |
|  | cpr_nummer     | Kunde    | string | X   | X      | 0 (straks)|        | [..] |  |
|  +--------------------------------------------------------------------------------+  |
|                                                                                      |
|  +--------------------------------------------------------------------------------+  |
|  | API Feltmapping                                                                |  |
|  | +------------------------------------+                                         |  |
|  | | Valg integration: [Lovablecph  v]  |  [Hent sample-felter]                   |  |
|  | +------------------------------------+                                         |  |
|  |                                                                                |  |
|  | API-felt (kilde)           |   | Standard felt     | Ekskluder? | Preview     |  |
|  +----------------------------+---+-------------------+------------+-------------+  |
|  | lead.phone                 | > | telefonnummer v   | [ ]        | "45123456"  |  |
|  | lead.company               | > | kundenavn v       | [ ]        | "Firma ApS" |  |
|  | ownedBy.email              | > | agent_email v     | [ ]        | "aa@cph.dk" |  |
|  | leadResultData.OPP         | > | opp_nummer v      | [ ]        | "OPP123"    |  |
|  | leadResultData.cprNumber   | > | [Ingen] v         | [X] Ignorer| "xxxxxx"    |  |
|  |                                                                                |  |
|  |                                           [Gem mapping]                        |  |
|  +--------------------------------------------------------------------------------+  |
|                                                                                      |
+--------------------------------------------------------------------------------------+
```

---

## Implementeringsrækkefølge

### Fase 1: Database + Frontend UI
1. Opret `data_field_definitions` tabel med RLS
2. Opret `integration_field_mappings` tabel med RLS + FK
3. Indsæt standard feltdefinitioner (seed data)
4. Opret frontend-komponenter (DataMappingTab, FieldDefinitionsManager, etc.)
5. Tilføj "Datamapping" tab til MgTest.tsx

### Fase 2: Frontend Optimering
6. Tilføj `normalized_data` kolonne til `sales` tabel
7. Opret `useNormalizedSalesData` hook
8. Opdater relevante dashboards til at bruge normaliserede data

### Fase 3: Backend Integration
9. Implementer `applyDataMappings()` utility funktion
10. Opdater Adversus og Enreach adapters til at bruge datamappings
11. Opdater `core/sales.ts` til at gemme normalized_data
12. Opdater `matchPricingRule()` til at prioritere normalized_data

### Fase 4: GDPR Scheduler
13. Opret `gdpr-data-cleanup` edge function
14. Setup pg_cron job til daglig kørsel
15. Implementer audit logging

---

## Nye filer der oprettes

| Fil | Beskrivelse |
|-----|-------------|
| `src/components/mg-test/DataMappingTab.tsx` | Hovedkomponent |
| `src/components/mg-test/FieldDefinitionsManager.tsx` | CRUD for feltdefinitioner |
| `src/components/mg-test/IntegrationMappingEditor.tsx` | Mapping pr. integration |
| `src/components/mg-test/FieldDefinitionDialog.tsx` | Dialog til opret/rediger |
| `src/hooks/useNormalizedSalesData.ts` | Hook til normaliserede data |
| `supabase/functions/gdpr-data-cleanup/index.ts` | GDPR scheduler |
| `supabase/functions/integration-engine/core/normalize.ts` | applyDataMappings() |

## Filer der modificeres

| Fil | Ændring |
|-----|---------|
| `src/pages/MgTest.tsx` | Tilføj Datamapping tab (ved linje 2088) |
| `supabase/functions/integration-engine/adapters/adversus.ts` | Kald applyDataMappings() |
| `supabase/functions/integration-engine/adapters/enreach.ts` | Kald applyDataMappings() |
| `supabase/functions/integration-engine/core/sales.ts` | Gem normalized_data, opdater matchPricingRule() |
| `supabase/functions/integration-engine/types.ts` | Tilføj normalizedData til StandardSale |

---

## Backward Compatibility

- **100% backward compatible**: Alle eksisterende systemer fortsætter med at virke
- Datamapping er **opt-in** per integration
- `raw_payload` gemmes **altid** som backup
- Eksisterende pricing rules og feltnavne virker fortsat
- Frontend-queries behøver ikke ændres med det samme

---

## Estimeret Omfang
- 2 nye database-tabeller + 1 ny kolonne + RLS policies + seed data
- 5 nye React-komponenter + 1 hook
- 1 ny edge function (GDPR scheduler)
- 1 ny utility fil (normalize.ts)
- 5 fil-modifikationer
- 1 cron job setup
