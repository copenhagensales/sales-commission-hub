
# Plan: Tilføj "Mulighed for straksbetaling" checkbox til prisregler

## Oversigt
Tilføjer en ny checkbox-indstilling "Mulighed for straksbetaling" i prisregel-editoren. Denne vises kun for ASE-produkter og gemmes som et boolean-felt i databasen.

## Database-ændring

### Ny kolonne i `product_pricing_rules`
```sql
ALTER TABLE product_pricing_rules 
ADD COLUMN allows_immediate_payment BOOLEAN DEFAULT false;
```

Denne kolonne tracker om reglen tillader straksbetaling.

---

## Frontend-ændringer

### PricingRuleEditor.tsx

**1. Tilføj ny state-variabel:**
```typescript
const [allowsImmediatePayment, setAllowsImmediatePayment] = useState(
  existingRule?.allows_immediate_payment ?? false
);
```

**2. Opdater PricingRule interface:**
```typescript
interface PricingRule {
  // ... eksisterende felter
  allows_immediate_payment?: boolean;
}
```

**3. Tilføj ny sektion med checkbox efter "Prissætning":**
```text
┌────────────────────────────────────────────────┐
│ 💳 Mulighed for straksbetaling                │
│                                                │
│ ☑ Tillad straksbetaling på denne regel        │
│                                                │
│ Hvis slået til, kan kunden betale straks      │
└────────────────────────────────────────────────┘
```

UI-koden:
```tsx
<div className="flex items-center justify-between">
  <div className="space-y-1">
    <Label>Mulighed for straksbetaling</Label>
    <p className="text-xs text-muted-foreground">
      Tillad straksbetaling for salg med denne regel
    </p>
  </div>
  <Switch
    checked={allowsImmediatePayment}
    onCheckedChange={setAllowsImmediatePayment}
  />
</div>
```

**4. Opdater saveMutation:**
Inkluder `allows_immediate_payment: allowsImmediatePayment` i `ruleData`-objektet.

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `product_pricing_rules` (database) | Tilføj `allows_immediate_payment` kolonne |
| `src/components/mg-test/PricingRuleEditor.tsx` | Tilføj switch UI og state |

---

## Placering i UI

Checkboxen placeres mellem "Prissætning" og "Aktiv" toggle:

```text
💰 Prissætning
├── Provision (kr): [600]
└── Omsætning (kr): [1500]

💳 Mulighed for straksbetaling     [Toggle: ☐/☑]
   Tillad straksbetaling for salg med denne regel

Aktiv                              [Toggle: ☑]
```

---

## Forventet resultat

1. Når man opretter/redigerer en prisregel for ASE-produkter (f.eks. "Salg"), vises en ny toggle
2. Værdien gemmes i databasen og kan læses ved næste redigering
3. Eksisterende regler får `false` som default-værdi
