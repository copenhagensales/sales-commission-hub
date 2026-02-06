
# Plan: Vis regelnavn i stedet for produktnavn

## Oversigt
Ændrer "Produkt"-kolonnen til at vise prisreglens navn i stedet for produktnavnet.

---

## Dataopdatering

### Nuværende vs. ønsket visning

| Kolonne | Nuværende data | Ønsket data |
|---------|----------------|-------------|
| Produkt | `products.name` = "Salg" | `product_pricing_rules.name` = "A-kasse uden straksbetaling" |

---

## Ændringer i ImmediatePaymentASE.tsx

### 1. Opdater interface (linje 52-61)

Tilføj nyt felt til at gemme regelnavnet:

```typescript
interface ImmediatePaymentSale {
  // ... eksisterende felter
  rule_name: string;  // NYT: Regelnavnet fra product_pricing_rules
}
```

### 2. Opdater query til at hente regelnavn (linje 233-238)

Udvid forespørgslen til at inkludere `name` fra prisregler:

```typescript
const { data: pricingRules } = await supabase
  .from("product_pricing_rules")
  .select("id, name")  // Tilføj name
  .in("id", pricingRuleIds)
  .eq("allows_immediate_payment", true);
```

### 3. Gem regelnavn i resultatet (linje 244-261)

Opdater til at bruge regelnavnet fra Map:

```typescript
const immediatePaymentRules = new Map(
  pricingRules.map(r => [r.id, r.name])
);

// I loop:
rule_name: immediatePaymentRules.get(matchingItem.matched_pricing_rule_id) || "Ukendt regel",
```

### 4. Opdater tabel-header og celle (linje 306, 318)

| Før | Efter |
|-----|-------|
| `<TableHead>Produkt</TableHead>` | `<TableHead>Regel</TableHead>` |
| `{sale.product_name}` | `{sale.rule_name}` |

---

## Eksempel på visning efter ændring

```text
┌─────────────┬──────────────────────────────────────┬──────────┬───────────┬─────────────────────────┐
│ Dato        │ Regel                                │ Kunde    │ Status    │ Handling                │
├─────────────┼──────────────────────────────────────┼──────────┼───────────┼─────────────────────────┤
│ 6. feb 2026 │ A-kasse uden straksbetaling          │ Firma A  │ Afventer  │ [Tilføj straksbetaling] │
│ 5. feb 2026 │ A-kasse uden straksbetaling over ... │ Firma B  │ Aktiveret │ [Annuller straksbetaling]│
└─────────────┴──────────────────────────────────────┴──────────┴───────────┴─────────────────────────┘
```

---

## Berørt fil

| Fil | Ændringer |
|-----|-----------|
| `src/pages/ImmediatePaymentASE.tsx` | Tilføj `rule_name` til interface, opdater query, vis regelnavn i tabel |
