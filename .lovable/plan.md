
# Plan: Automatisk opdatering af historiske salg ved prisændringer + dato-indstillinger på prisregler

## Oversigt

Denne plan implementerer to vigtige forbedringer:
1. **Automatisk opdatering af historiske sale_items** når produktpriser eller prisregler ændres
2. **Dato-baserede gyldighed** på prisregler (effective_from/effective_to)

---

## Nuværende arkitektur

Systemet har allerede centraliseret data-arkitektur:

```text
┌──────────────────────────────────────────────────────────────┐
│                   DATA FLOW                                   │
├──────────────────────────────────────────────────────────────┤
│  Integration Engine → sale_items (mapped_commission/revenue) │
│                           ↓                                   │
│  Dashboard/Løn/Rapporter ← læser direkte fra sale_items      │
└──────────────────────────────────────────────────────────────┘
```

**Korrekt observation**: Alle dashboards, løn, dagsrapporter osv. henter data fra `sale_items.mapped_commission` og `sale_items.mapped_revenue`. Så længe disse værdier er opdaterede, vises korrekt data overalt.

---

## Del 1: Automatisk opdatering ved prisændringer

### Hvad sker der i dag?
1. Når du ændrer en produktpris → gemmes i `products` + `product_price_history`
2. Historiske `sale_items` beholder deres gamle værdier
3. `rematch-pricing-rules` edge function skal køres manuelt

### Løsning: Automatisk trigger

Når en prisændring gemmes, kald automatisk `rematch-pricing-rules` for det specifikke produkt.

**Ændringer i ProductPricingRulesDialog.tsx:**
- Efter vellykket prisændring → kald edge function med `product_id` filter
- Vis progress/status til brugeren

**Ændringer i PricingRuleEditor.tsx:**
- Efter gem/opdatering af prisregel → kald edge function for det specifikke produkt

---

## Del 2: Dato-baserede prisregler (Gyldighedsperioder)

### Nye kolonner i `product_pricing_rules`

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `effective_from` | DATE | Reglen gælder fra denne dato (inklusiv) |
| `effective_to` | DATE NULL | Reglen gælder til denne dato (eksklusiv). NULL = ingen slutdato |

### Matchning-logik opdatering

Både `integration-engine/core/sales.ts` og `rematch-pricing-rules/index.ts` opdateres til:

```text
FOR hver prisregel DO
  IF regel.effective_from > salg.sale_datetime THEN SKIP
  IF regel.effective_to IS NOT NULL 
     AND regel.effective_to <= salg.sale_datetime THEN SKIP
  ... eksisterende betingelseslogik ...
END
```

### Historik for prisregler

Ny tabel: `pricing_rule_history` til at tracke ændringer i prisregler.

---

## Implementeringsplan

### Fase 1: Database-ændringer

**Migration 1: Tilføj dato-kolonner til prisregler**

```sql
ALTER TABLE product_pricing_rules 
ADD COLUMN effective_from DATE DEFAULT CURRENT_DATE,
ADD COLUMN effective_to DATE DEFAULT NULL;

COMMENT ON COLUMN product_pricing_rules.effective_from IS 'Reglen gælder fra denne dato (inklusiv)';
COMMENT ON COLUMN product_pricing_rules.effective_to IS 'Reglen gælder til denne dato (eksklusiv). NULL = ingen slutdato';
```

**Migration 2: Prisregel-historik tabel**

```sql
CREATE TABLE pricing_rule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id UUID REFERENCES product_pricing_rules(id) ON DELETE CASCADE,
  commission_dkk NUMERIC,
  revenue_dkk NUMERIC,
  conditions JSONB,
  campaign_mapping_ids UUID[],
  effective_from DATE,
  effective_to DATE,
  priority INTEGER,
  is_active BOOLEAN,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id)
);

-- RLS policies
ALTER TABLE pricing_rule_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read" ON pricing_rule_history FOR SELECT TO authenticated USING (true);
```

### Fase 2: Backend-logik

**Opdater `integration-engine/core/sales.ts`:**
- `matchPricingRule()` funktionen skal filtrere regler baseret på `effective_from` og `effective_to` vs. `sale.saleDate`

**Opdater `rematch-pricing-rules/index.ts`:**
- Tilføj `product_id` filter parameter (allerede delvist understøttet via `source`)
- Tilføj dato-baseret matching logik
- Understøt `effective_from_date` parameter for at kun opdatere salg efter en bestemt dato

### Fase 3: Frontend-ændringer

**PricingRuleEditor.tsx:**
- Tilføj dato-picker for "Gyldig fra" (effective_from)
- Tilføj valgfri dato-picker for "Gyldig til" (effective_to)
- Ved gem: kald rematch funktion automatisk

**ProductPricingRulesDialog.tsx:**
- Ved gem af basispris: kald rematch funktion for produktet
- Vis loading-state og resultat (antal opdaterede salg)

**Ny komponent: PricingRuleHistoryTab.tsx:**
- Viser historik over regelændringer (ligesom produkthistorik)

### Fase 4: Automatisk rematch-integration

**Ny hook: `useRematchPricingRules.ts`:**

```typescript
export function useRematchPricingRules() {
  return useMutation({
    mutationFn: async ({ 
      productId, 
      effectiveFromDate,
      dryRun = false 
    }) => {
      const response = await supabase.functions.invoke(
        'rematch-pricing-rules',
        { body: { product_id: productId, effective_from_date, dry_run: dryRun } }
      );
      return response.data;
    }
  });
}
```

---

## Teknisk oversigt

### Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/rematch-pricing-rules/index.ts` | Tilføj product_id filter + dato-logik |
| `supabase/functions/integration-engine/core/sales.ts` | Dato-baseret regel-matching |
| `supabase/functions/integration-engine/types.ts` | Tilføj effective_from/to til PricingRule type |
| `src/components/mg-test/PricingRuleEditor.tsx` | Dato-pickers + auto-rematch |
| `src/components/mg-test/ProductPricingRulesDialog.tsx` | Auto-rematch ved prisændring |

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `src/hooks/useRematchPricingRules.ts` | Hook til at kalde rematch edge function |
| `src/components/mg-test/PricingRuleHistoryTab.tsx` | Historik-visning for prisregler |

---

## Brugeroplevelse

Efter implementering:

1. **Ændrer du en produktpris** → Systemet opdaterer automatisk alle relaterede sale_items → Alle dashboards viser korrekt data med det samme
2. **Opretter/ændrer du en prisregel** → Kan vælge gyldighedsdato → Systemet opdaterer kun salg i den relevante periode
3. **Historik-fanen** → Viser både produktprishistorik OG regelændringshistorik

---

## Risiko-håndtering

- **Dry-run mode**: Vis først hvor mange salg der påvirkes før opdatering
- **Batch-processing**: Opdater i chunks for at undgå timeouts
- **Reversibility**: Historik-tabeller gør det muligt at se tidligere værdier

