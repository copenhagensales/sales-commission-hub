
# Plan: Bevar straksbetaling-status ved prisændringer

## Problemet

Når `rematch-pricing-rules` kører i baggrunden efter en prisændring, overskriver den `mapped_commission` og `mapped_revenue` på alle sale_items - også dem hvor brugeren manuelt har aktiveret straksbetaling (`is_immediate_payment = true`).

**Resultat**: Brugerens straksbetalingsvalg bliver nulstillet, fordi funktionen ikke respekterer den eksisterende status.

## Løsning

Opdater `rematch-pricing-rules` edge function til at:
1. Læse `is_immediate_payment`-status fra hver sale_item
2. Hvis `is_immediate_payment = true`, bruge `immediate_payment_commission_dkk` og `immediate_payment_revenue_dkk` fra prisreglen i stedet for standard-værdier
3. Aldrig ændre `is_immediate_payment`-flaget - det er brugerens valg

## Tekniske ændringer

### Fil: `supabase/functions/rematch-pricing-rules/index.ts`

**1. Udvid sale_items query (linje ~198-214)**

Tilføj `is_immediate_payment` til SELECT:
```typescript
.select(`
  id,
  sale_id,
  product_id,
  quantity,
  matched_pricing_rule_id,
  mapped_commission,
  mapped_revenue,
  needs_mapping,
  is_immediate_payment,  // <-- TILFØJ DENNE
  sales!inner (...)
`)
```

**2. Udvid PricingRule interface (linje ~19-32)**

Tilføj immediate payment felter:
```typescript
interface PricingRule {
  // ... eksisterende felter
  immediate_payment_commission_dkk?: number | null;
  immediate_payment_revenue_dkk?: number | null;
}
```

**3. Opdater matchPricingRule return type**

Inkluder immediate payment værdier i return:
```typescript
return {
  commission: rule.commission_dkk,
  revenue: rule.revenue_dkk,
  immediatePaymentCommission: rule.immediate_payment_commission_dkk,
  immediatePaymentRevenue: rule.immediate_payment_revenue_dkk,
  // ... rest
}
```

**4. Opdater processering af sale_items (linje ~324-410)**

Bevar straksbetaling:
```typescript
const isImmediatePayment = item.is_immediate_payment === true;

if (matchedRule) {
  let commission: number;
  let revenue: number;
  
  if (isImmediatePayment && matchedRule.allowsImmediatePayment) {
    // Bruger har aktiveret straksbetaling - brug forhøjede satser
    commission = (matchedRule.immediatePaymentCommission ?? matchedRule.commission) * qty;
    revenue = (matchedRule.immediatePaymentRevenue ?? matchedRule.revenue) * qty;
  } else {
    // Standard satser
    commission = matchedRule.commission * qty;
    revenue = matchedRule.revenue * qty;
  }
  
  updates.push({
    id: item.id,
    product_id: correctProductId,
    matched_pricing_rule_id: matchedRule.ruleId,
    mapped_commission: commission,
    mapped_revenue: revenue,
    needs_mapping: false,
    // VIGTIGT: Inkluder IKKE is_immediate_payment - bevar brugerens valg
  });
}
```

**5. Udvid pricing rules query (linje ~256-259)**

Tilføj immediate payment kolonner:
```typescript
.select("id, product_id, name, conditions, commission_dkk, revenue_dkk, priority, is_active, campaign_mapping_ids, allows_immediate_payment, effective_from, effective_to, immediate_payment_commission_dkk, immediate_payment_revenue_dkk")
```

## Sammenfatning

| Før | Efter |
|-----|-------|
| Rematch overskriver alle sale_items med standard-provision | Rematch respekterer `is_immediate_payment` og bruger korrekte satser |
| Brugerens straksbetalingsvalg går tabt | Straksbetalingsvalg bevares altid |

## Deploy

Efter ændringerne skal `rematch-pricing-rules` edge function redeployes.
