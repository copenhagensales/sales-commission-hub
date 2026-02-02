

# Plan: Flyt ASE Produktlogik fra Kode til Database-Regler

## Nuværende Situation

### ASE Dialer Integration Config (mangelfuld)
```json
{
  "productExtraction": {
    "strategy": "conditional",
    "dataFilters": [
      {"field": "lastModifiedByUser.orgCode", "value": "@copenhagensales.dk", "operator": "contains"}
    ]
    // ⚠️ MANGLER: conditionalRules[]
  }
}
```

### Tilgængelige Lead Data Felter
Fra ASE/HeroBase har vi 51 felter inkl.:
- `Forening`: "Fagforening med lønsikring", "Ase Lønmodtager", etc.
- `Lønsikring`: "Lønsikring Udvidet", "Lønsikring Super", etc.
- `A-kasse type`: "Lønmodtager", "Ung under uddannelse", "Selvstændig"
- `A-kasse salg`: "Ja", "Nej"

### Salgsfordelinger fra Database (647 salg)
| Kombination | Antal |
|-------------|-------|
| Fagforening m. lønsikring + Lønsikring Udvidet + Lønmodtager | 219 |
| Ase Lønmodtager + Lønmodtager | 144 |
| (tom - mangler data) | 119 |
| Ase Lønmodtager + Ung under uddannelse | 56 |
| Kun Lønmodtager | 31 |
| Kun Ung under uddannelse | 16 |
| Kun Lønsikring Udvidet | 15 |
| Kun Selvstændig | 15 |

## Løsning: Database-baserede Regler

### Trin 1: Opdater ASE Dialer Integration Config
Tilføj `conditionalRules` til `dialer_integrations` tabellen:

```json
{
  "productExtraction": {
    "strategy": "conditional",
    "dataFilters": [
      {"field": "lastModifiedByUser.orgCode", "value": "@copenhagensales.dk", "operator": "contains"}
    ],
    "conditionalRules": [
      {
        "conditions": [
          {"field": "A-kasse salg", "operator": "equals", "value": "Ja"},
          {"field": "A-kasse type", "operator": "isNotEmpty", "value": ""}
        ],
        "conditionsLogic": "AND",
        "extractionType": "composite",
        "productNameTemplate": "akasse - {{A-kasse type}}"
      },
      {
        "conditions": [
          {"field": "Forening", "operator": "equals", "value": "Fagforening med lønsikring"}
        ],
        "extractionType": "static_value",
        "staticProductName": "Fagforening med lønsikring"
      },
      {
        "conditions": [
          {"field": "Lønsikring", "operator": "isNotEmpty", "value": ""}
        ],
        "extractionType": "composite",
        "productNameTemplate": "{{Lønsikring}}"
      }
    ]
  }
}
```

### Trin 2: Opret/Match Produkter i Products Tabellen
Sikre at disse produkter eksisterer med korrekt `counts_as_sale`:
- `akasse - Lønmodtager` (findes)
- `akasse - Ung under uddannelse` (findes)
- `akasse - Selvstændig` (skal oprettes)
- `Fagforening med lønsikring` (findes)
- `Lønsikring Udvidet` (skal oprettes med counts_as_sale=false)
- `Lønsikring Super` (skal oprettes med counts_as_sale=false)

### Trin 3: Opret Prissætningsregler i UI
Via "Prissætningsregler" UI'en oprettes regler for hvert produkt. Eksempel for "A-kasse med straksbetaling":

**Regel: A-kasse Lønmodtager med Straksbetaling**
- Betingelser: `A-kasse type = Lønmodtager`, `Forening = Ase Lønmodtager`
- Provision: 400 kr
- Omsætning: 1500 kr

**Regel: A-kasse Studerende**
- Betingelser: `A-kasse type = Ung under uddannelse`
- Provision: 150 kr
- Omsætning: 400 kr

## Implementeringsplan

### Ændring 1: SQL Migration - Opdater ASE Config
```sql
UPDATE dialer_integrations
SET config = jsonb_set(
  config,
  '{productExtraction,conditionalRules}',
  '[
    {
      "conditions": [
        {"field": "A-kasse salg", "operator": "equals", "value": "Ja"},
        {"field": "A-kasse type", "operator": "isNotEmpty", "value": ""}
      ],
      "conditionsLogic": "AND",
      "extractionType": "composite",
      "productNameTemplate": "akasse - {{A-kasse type}}"
    },
    {
      "conditions": [
        {"field": "Forening", "operator": "equals", "value": "Fagforening med lønsikring"}
      ],
      "extractionType": "static_value",
      "staticProductName": "Fagforening med lønsikring"
    },
    {
      "conditions": [
        {"field": "Lønsikring", "operator": "isNotEmpty", "value": ""}
      ],
      "extractionType": "composite",
      "productNameTemplate": "{{Lønsikring}}"
    }
  ]'::jsonb
)
WHERE name = 'ase';
```

### Ændring 2: Opret Manglende Produkter
```sql
INSERT INTO products (name, commission_dkk, revenue_dkk, counts_as_sale)
VALUES 
  ('akasse - Selvstændig', 350, 800, true),
  ('Lønsikring Udvidet', 0, 0, false),
  ('Lønsikring Super', 0, 0, false)
ON CONFLICT (name) DO NOTHING;
```

### Ændring 3: Tilføj ASE-specifikke Betingelser til PricingRuleEditor
Udvid `CONDITION_OPTIONS` i `src/components/mg-test/PricingRuleEditor.tsx`:

```typescript
const CONDITION_OPTIONS: Record<string, string[]> = {
  // Eksisterende Adversus betingelser
  Bindingsperiode: ["12", "24", "36"],
  "Tilfredshedsgaranti - Switch": ["Ja", "Nej"],
  "Tilfredshedsgaranti - MBB": ["Ja", "Nej"],
  Tilskud: ["0%", "100%"],
  "Hoved oms trin": ["ATL", "1", "3", "5"],
  "Omstillingsbruger trin": ["ATL", "1", "3", "5"],
  
  // NYE: ASE/Enreach betingelser
  "A-kasse type": ["Lønmodtager", "Ung under uddannelse", "Selvstændig"],
  "A-kasse salg": ["Ja", "Nej"],
  "Forening": ["Fagforening med lønsikring", "Ase Lønmodtager"],
  "Lønsikring": ["Lønsikring Udvidet", "Lønsikring Super"],
};
```

### Ændring 4: Opdater matchPricingRule til at Understøtte Enreach Data
I `supabase/functions/integration-engine/core/sales.ts` skal `matchPricingRule` funktionen opdateres til at understøtte både Adversus (`leadResultData[]`) og Enreach (`rawPayload.data{}`):

```typescript
function matchPricingRule(
  productId: string,
  pricingRulesMap: Map<string, PricingRule[]>,
  leadResultData: Array<{ label: string; value: string }>,
  campaignMappingId?: string | null,
  rawPayloadData?: Record<string, unknown>, // NY PARAMETER
  log?: ...
): { commission: number; revenue: number; ruleId: string; ruleName: string } | null {
  // ...
  
  // Konverter rawPayloadData til samme format som leadResultData
  let allFields = [...leadResultData];
  if (rawPayloadData && typeof rawPayloadData === 'object') {
    for (const [key, value] of Object.entries(rawPayloadData)) {
      if (value !== null && value !== undefined) {
        allFields.push({ label: key, value: String(value) });
      }
    }
  }
  
  // Brug allFields til condition matching
  // ...
}
```

## Resultat

Efter implementering:
1. ASE salg vil automatisk matche produkter baseret på `Forening`, `Lønsikring` og `A-kasse type`
2. Prissætningsregler kan oprettes via UI'en uden kode-ændringer
3. Nye kombinationer kan tilføjes direkte i databasen
4. Integration-engine genkører vil tildele korrekt provision/omsætning

## Filer der Ændres
- Database: `dialer_integrations` (ASE config)
- Database: `products` (nye produkter)
- `src/components/mg-test/PricingRuleEditor.tsx` (udvid CONDITION_OPTIONS)
- `supabase/functions/integration-engine/core/sales.ts` (understøt Enreach data i matchPricingRule)

