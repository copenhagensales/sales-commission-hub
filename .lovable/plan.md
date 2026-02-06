

# Plan: Brug regelnavn som produktnavn ved match

## Oversigt

Tilføj mulighed for at prisregler kan overskrive produktnavnet med deres eget navn, når de matcher et salg. Dette gør det muligt at vise f.eks. "ASE A-kasse Straks" i stedet for det generiske produktnavn "ASE A-kasse".

## Nuværende situation

- `product_pricing_rules.name` indeholder allerede et valgfrit navn
- `sale_items` gemmer IKKE noget visningsnavn - produktnavnet hentes altid fra `products.name`
- Når en regel matcher, gemmes kun `matched_pricing_rule_id`

## Løsning

### Del 1: Database-ændringer

**Ny kolonne i `product_pricing_rules`:**

| Kolonne | Type | Default | Beskrivelse |
|---------|------|---------|-------------|
| `use_rule_name_as_display` | BOOLEAN | false | Hvis true, bruges regelnavnet i stedet for produktnavnet |

**Ny kolonne i `sale_items`:**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `display_name` | TEXT | Det navn der vises i dashboards. NULL = brug produktnavn |

### Del 2: Backend-logik

**Integration-engine (`sales.ts`):**
- Ved matchning, hvis regel har `use_rule_name_as_display = true`, sæt `display_name = rule.name`

**Rematch-pricing-rules (`index.ts`):**
- Samme logik: Opdater `display_name` baseret på regelindstillingen

```text
IF matchedRule.useRuleNameAsDisplay AND matchedRule.ruleName THEN
  display_name = matchedRule.ruleName
ELSE
  display_name = NULL (brug produktnavn)
```

### Del 3: Frontend-ændringer

**PricingRuleEditor.tsx:**
Tilføj checkbox under regelnavnet:

```text
┌─────────────────────────────────────────────────────┐
│  Navn (valgfri)                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ ASE A-kasse Straks                          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ☑️ Brug dette navn i stedet for produktnavnet     │
│     (Vises i dashboards og rapporter)               │
└─────────────────────────────────────────────────────┘
```

**ImmediatePaymentASE.tsx:**
- Ved aktivering af straksbetaling: Opdater også `display_name` hvis reglen har det konfigureret
- Ved annullering: Nulstil `display_name` til NULL

### Del 4: Dashboards og rapporter

Alle steder der viser produktnavn skal bruge logikken:
```typescript
const displayName = saleItem.display_name || product?.name || "Ukendt produkt";
```

Dette inkluderer:
- MgTest.tsx (produktkolonnen)
- DailyReports.tsx
- Lønoversigter

## Implementeringsplan

| Trin | Fil | Ændring |
|------|-----|---------|
| 1 | Database migration | Tilføj `use_rule_name_as_display` til `product_pricing_rules` og `display_name` til `sale_items` |
| 2 | `integration-engine/types.ts` | Tilføj `use_rule_name_as_display` til PricingRule interface |
| 3 | `integration-engine/core/sales.ts` | Returnér display_name fra matchPricingRule, gem i sale_items |
| 4 | `rematch-pricing-rules/index.ts` | Opdater display_name ved rematch |
| 5 | `PricingRuleEditor.tsx` | Tilføj checkbox "Brug dette navn i stedet for produktnavnet" |
| 6 | `ImmediatePaymentASE.tsx` | Inkluder display_name i mutations |
| 7 | Dashboards | Opdater til at bruge display_name med fallback |

## Eksempel på flow

1. Admin opretter prisregel "ASE Basis Straks" med:
   - Provision: 500 kr
   - ☑️ "Brug dette navn i stedet for produktnavnet"

2. Salg importeres → matcher reglen

3. `sale_items` får:
   - `matched_pricing_rule_id: <regel-id>`
   - `display_name: "ASE Basis Straks"`
   - `mapped_commission: 500`

4. Dashboard viser "ASE Basis Straks" i produktkolonnen

## Resultat

- Admin kan styre præcist hvad der vises for hvert prisscenarie
- Straksbetaling kan vise f.eks. "ASE Straks" i stedet for generisk produktnavn
- Alle dashboards og rapporter viser det korrekte navn automatisk

