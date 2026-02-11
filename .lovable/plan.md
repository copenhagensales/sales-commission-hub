

## Multi-select af Daekningssum-vaerdier

### Problem
I dag kan man kun vaelge en enkelt vaerdi/operator for Daekningssum (f.eks. ">= 6000"). Brugeren oensker at kunne vaelge flere specifikke Daekningssum-vaerdier paa samme tid, saa en regel kan matche f.eks. baade 5000 og 10000.

### Loesning
Tilfoej en ny operator "Er en af" (in) til Daekningssum, som tillader multi-select af specifikke beloeb.

### AEndringer

**1. Frontend - PricingRuleEditor.tsx**
- Tilfoej ny operator `{ value: "in", label: "Er en af (multi-valg)" }` til `NUMERIC_OPERATORS`
- Udvid `NumericConditionValue` med `values?: number[]` felt
- Naar operator er "in", vis en multi-value input (f.eks. komma-separerede tal eller chips med tilfoej/fjern)
- UI: Inputfelt hvor man kan skrive et beloeb og tilfoeje det, med chips der viser de valgte vaerdier og kan fjernes

**2. Backend - integration-engine/types.ts**
- Tilfoej `'in'` til `NumericCondition.operator` union type
- Tilfoej `values?: number[]` til `NumericCondition` interface

**3. Backend - integration-engine/core/sales.ts**
- Tilfoej case for `'in'` i `evaluateNumericCondition`:
  ```
  case 'in': return (condition.values ?? []).includes(numericLeadValue);
  ```

**4. Backend - rematch-pricing-rules/index.ts**
- Samme aendring som sales.ts: tilfoej `'in'` case i `evaluateNumericCondition`
- Opdater `NumericCondition` interface med `'in'` og `values`

### UI-design for "Er en af"
Naar brugeren vaelger "Er en af" operatoren:
- Vis et number-inputfelt med en "Tilfoej" knap
- Valgte vaerdier vises som chips/badges (f.eks. `[5000 x] [10000 x]`)
- Klik paa X paa en chip fjerner vaerdien

### Eksempel paa gemt data
```json
{
  "Daekningssum": {
    "operator": "in",
    "value": 0,
    "values": [5000, 6000, 10000]
  }
}
```

### Bagudkompatibilitet
- Eksisterende regler med gte/lte/gt/lt/between paavirkes ikke
- `value` feltet beholdes (bruges bare ikke ved "in")
- Backend falder tilbage til `false` hvis `values` mangler ved "in"

