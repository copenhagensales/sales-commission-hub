## TL;DR

Tre præcise ændringer i to filer i `supabase/functions/integration-engine/`. Retter `ReferenceError: hasCampaignRestriction is not defined` der får `matchPricingRule` til at fejle silent på success-branchen i Deno edge runtime — rod-årsag til ASE/Relatel 0-commission siden 5. maj.

Ingen migrationer. Ingen DB-ændringer. Ingen rematch i denne PR.

## Verificeret før plan

Læst `supabase/functions/integration-engine/core/sales.ts` linje 160-245 ord-for-ord:

- **Linje 166:** `const hasRestriction = !!ids && ids.length > 0;` — variablen hedder `hasRestriction`.
- **Linje 167:** `const mode = (rule as any).campaign_match_mode === "exclude" ? "exclude" : "include";` — `as any`-cast bekræftet.
- **Linje 233:** `hasCampaignRestriction,` — shorthand-property der refererer en udefineret variabel. Bug bekræftet.

Linjenumre matcher 1:1 med bygge-ordren.

## Ændring 1 — Fix typo (rød zone, godkendt)

**Fil:** `supabase/functions/integration-engine/core/sales.ts` · linje 233

Før:
```ts
        hasCampaignRestriction,
```

Efter:
```ts
        hasCampaignRestriction: hasRestriction,
```

Bevarer log-feltnavnet `hasCampaignRestriction` så det matcher `rematch-pricing-rules/index.ts:240` og ikke brækker eventuelle log-aggregeringer. Værdien kommer nu fra den faktisk deklarerede variabel `hasRestriction`.

## Ændring 2 — Tilføj felt til PricingRule-type (grøn zone)

**Fil:** `supabase/functions/integration-engine/types.ts`
**Placering:** I eksisterende `PricingRule`-interface, indsæt mellem `campaign_mapping_ids` (linje 202) og `effective_from` (linje 203):

```ts
  campaign_match_mode?: "include" | "exclude";
```

## Ændring 3 — Fjern `as any`-cast (grøn zone)

**Fil:** `supabase/functions/integration-engine/core/sales.ts` · linje 167

Før:
```ts
    const mode = (rule as any).campaign_match_mode === "exclude" ? "exclude" : "include";
```

Efter:
```ts
    const mode = rule.campaign_match_mode === "exclude" ? "exclude" : "include";
```

Ingen runtime-effekt — kun TypeScript-rydning muliggjort af ændring 2.

## Hvad der IKKE røres

- `_shared/pricing-service.ts`
- `rematch-pricing-rules/index.ts`
- `pricingRuleMatching.ts` (frontend)
- `fmPricing.ts`
- `sale_items`, `product_pricing_rules`, `products` (ingen DB)
- Ingen migration
- Ingen rematch-operation (separat fra denne PR)
- Alle andre filer

## Acceptkriterier

- `ReferenceError` elimineres i success-branchen af `matchPricingRule`.
- Eksisterende include/exclude-logik uændret.
- `as any`-cast på linje 167 er væk; typen bærer feltet.
- Diff begrænset til netop disse to filer og netop disse tre punkter.

## Efter implementation

Jeg deployer `integration-engine` med `supabase--deploy_edge_functions` så fixet er live umiddelbart. Rematch for ASE/Relatel siden 5. maj kører som separat operation efter du har bekræftet at nye salg pricer korrekt.