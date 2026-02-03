
# Plan: Tilføj Dækningssum-betingelser med Numeriske Operatorer

## Oversigt
Udvider pricing rule editoren til at understøtte "Dækningssum" som en numerisk betingelse, hvor brugeren kan vælge et beløb og om reglen skal gælde når værdien er "over" eller "under" dette beløb.

## Nuværende Situation
- `conditions` feltet gemmer simple key-value par: `{"Tilskud": "0%", "A-kasse type": "Lønmodtager"}`
- Alle betingelser evalueres med exact match (`===`)
- UI understøtter kun dropdown med foruddefinerede værdier

## Løsning: Udvidet Condition Format

### Nyt JSON-format for numeriske betingelser
```text
+----------------------------------+
| Eksisterende format (bevares)    |
+----------------------------------+
| { "Tilskud": "0%" }              |
| - Matcher via equals             |
+----------------------------------+

+----------------------------------+
| Nyt format for numeriske         |
+----------------------------------+
| {                                |
|   "Dækningssum": {               |
|     "operator": "gte",           |
|     "value": 6000                |
|   }                              |
| }                                |
+----------------------------------+
```

### Understøttede operatorer
- `gte` = Greater than or equal (≥) / "over eller lig med"
- `lte` = Less than or equal (≤) / "under eller lig med"
- `gt` = Greater than (>) / "over"
- `lt` = Less than (<) / "under"

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/mg-test/PricingRuleEditor.tsx` | Tilføj special håndtering for numeriske betingelser |
| `supabase/functions/integration-engine/core/sales.ts` | Udvid matchPricingRule() til at evaluere numeriske operatorer |
| `supabase/functions/integration-engine/types.ts` | Tilføj type for numerisk betingelse |

## Tekniske Detaljer

### 1. PricingRuleEditor.tsx

Tilføj "Dækningssum" som en special numerisk betingelse:

```typescript
// Ny konstant for numeriske betingelser
const NUMERIC_CONDITION_KEYS = ["Dækningssum"];

// Operatorer til UI
const NUMERIC_OPERATORS = [
  { value: "gte", label: "Over eller lig med" },
  { value: "lte", label: "Under eller lig med" },
  { value: "gt", label: "Over" },
  { value: "lt", label: "Under" },
];
```

**UI for numerisk betingelse:**
```text
+---------------------------------------------+
| Dækningssum                                 |
|  +--------+  +---------------+              |
|  |  >=  v |  |  6000       |  [X]          |
|  +--------+  +---------------+              |
+---------------------------------------------+
```

- Dropdown til operator (over/under/over-eller-lig/under-eller-lig)
- Input felt til beløb (number)
- Slet-knap

### 2. sales.ts - matchPricingRule()

Udvid betingelses-evalueringen til at håndtere både:
1. Simple strings (eksisterende): `"Tilskud"` → `"0%"`
2. Numeriske objekter (nyt): `"Dækningssum"` → `{operator: "gte", value: 6000}`

```typescript
// I matchPricingRule():
for (const [condKey, condValue] of Object.entries(conditions)) {
  const leadField = allFields.find(f => f.label === condKey);
  
  if (typeof condValue === 'object' && condValue !== null && 'operator' in condValue) {
    // Numerisk sammenligning
    const numericCond = condValue as { operator: string; value: number };
    const leadValue = parseFloat(leadField?.value || '0');
    
    switch (numericCond.operator) {
      case 'gte': allConditionsMet = leadValue >= numericCond.value; break;
      case 'lte': allConditionsMet = leadValue <= numericCond.value; break;
      case 'gt': allConditionsMet = leadValue > numericCond.value; break;
      case 'lt': allConditionsMet = leadValue < numericCond.value; break;
    }
  } else {
    // Eksisterende string-sammenligning
    allConditionsMet = leadField?.value === condValue;
  }
}
```

### 3. types.ts

Tilføj type for numeriske betingelser:

```typescript
export interface NumericCondition {
  operator: 'gte' | 'lte' | 'gt' | 'lt';
  value: number;
}

// Opdateret PricingRule interface
export interface PricingRule {
  // ...
  conditions: Record<string, string | NumericCondition>;
  // ...
}
```

## Bagudkompatibilitet
- Eksisterende regler med simple string-værdier fortsætter med at virke
- Ingen databasemigration nødvendig - JSONB understøtter allerede det nye format
- Backend evaluerer først om værdien er et objekt (numerisk) eller string (eksisterende)

## Validering
- Input-felt accepterer kun tal
- Operator er påkrævet for numeriske betingelser
- Backend logger tydeligt når numeriske sammenligninger evalueres

