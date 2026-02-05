
# Plan: Tilføj Provision og Omsætning felter for straksbetaling

## Oversigt
Tilføjer to nye input-felter for "Provision" og "Omsætning" der vises når "Mulighed for straksbetaling" er aktiveret. Disse felter angiver de alternative beløb der anvendes hvis et salg konverteres til straksbetaling.

---

## 1. Database-ændring

### Nye kolonner i `product_pricing_rules`
```sql
ALTER TABLE product_pricing_rules 
ADD COLUMN immediate_payment_commission_dkk DECIMAL DEFAULT NULL,
ADD COLUMN immediate_payment_revenue_dkk DECIMAL DEFAULT NULL;
```

Disse kolonner er nullable - de udfyldes kun hvis straksbetaling er aktiveret.

---

## 2. Frontend-ændringer i PricingRuleEditor.tsx

### Ny state
```typescript
const [immediatePaymentCommission, setImmediatePaymentCommission] = useState(
  existingRule?.immediate_payment_commission_dkk?.toString() || ""
);
const [immediatePaymentRevenue, setImmediatePaymentRevenue] = useState(
  existingRule?.immediate_payment_revenue_dkk?.toString() || ""
);
```

### Opdater PricingRule interface
```typescript
interface PricingRule {
  // ... eksisterende felter
  immediate_payment_commission_dkk?: number | null;
  immediate_payment_revenue_dkk?: number | null;
}
```

### UI-ændring: Vis felter når toggle er aktiv
Lige under straksbetaling-toggle'en tilføjes en conditional sektion:

```text
💳 Mulighed for straksbetaling              [Toggle: ☑]
   Tillad straksbetaling for salg med denne regel

   ┌─────────────────────────────────────────┐
   │ 💰 Prissætning ved straksbetaling       │
   │                                         │
   │ Provision (kr)    │ Omsætning (kr)      │
   │ [______________]  │ [______________]    │
   └─────────────────────────────────────────┘
```

### Opdater saveMutation
Inkluder de nye felter i `ruleData`:
```typescript
immediate_payment_commission_dkk: allowsImmediatePayment && immediatePaymentCommission 
  ? parseFloat(immediatePaymentCommission) 
  : null,
immediate_payment_revenue_dkk: allowsImmediatePayment && immediatePaymentRevenue 
  ? parseFloat(immediatePaymentRevenue) 
  : null,
```

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `product_pricing_rules` (database) | Tilføj 2 nye kolonner |
| `src/components/mg-test/PricingRuleEditor.tsx` | Tilføj state, UI og gem-logik |

---

## Forventet resultat

1. Når "Mulighed for straksbetaling" aktiveres, vises to nye input-felter
2. Brugeren kan indtaste alternative provisions- og omsætningsbeløb
3. Værdierne gemmes kun når toggle er aktiv - ellers sættes de til null
4. Ved redigering af eksisterende regel indlæses værdierne korrekt
