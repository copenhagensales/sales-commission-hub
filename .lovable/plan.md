

## Redesign af Merge Wizard: Prisregler og produktnavn

### Ny wizard-flow (4 trin)

```text
Trin 1: Vælg kunde          (uændret)
Trin 2: Vælg produkter      (fjern target-valg, kun checkboxes)
Trin 3: Administrer regler   (NYT - vis alle pricing rules)
Trin 4: Navngiv produkt      (NYT - skriv/vælg produktnavn + bekræft)
```

### Trin 3 — Administrer prisregler

Henter alle `product_pricing_rules` for de valgte produkter og viser dem grupperet per produkt:

| Produkt | Regel | Provision | Revenue | Handling |
|---------|-------|-----------|---------|----------|
| Fri tale + 100GB | (regel 1) | 275 kr | 750 kr | Behold / Sæt slutdato / Slet |

Hver regel får tre valgmuligheder:
- **Behold** — reglen overføres til det nye produkt uændret
- **Sæt slutdato** — reglen beholdes men får en `effective_to`-dato (datepicker vises)
- **Slet** — reglen fjernes ved merge

Regler der allerede har `effective_to` vises med datoen og kan ændres.

### Trin 4 — Navngiv produkt

- Et tekstfelt til at skrive nyt produktnavn
- En dropdown med de valgte produkters navne som hurtigvalg
- Opsummering: antal regler der beholdes/afsluttes/slettes, antal sales og mappings der flyttes

### Merge-logik (ændringer)

Nuværende flow sletter kilde-regler og beholder targets. Ny flow:
1. Opret nyt produkt (eller genbrug et eksisterende ID) med det valgte navn
2. Flyt alle `adversus_product_mappings`, `sale_items`, `cancellation_product_mappings`, `product_campaign_overrides` til det nye produkt
3. For regler markeret "Behold": opdater `product_id` til nyt produkt
4. For regler markeret "Slutdato": opdater `product_id` + sæt `effective_to`
5. For regler markeret "Slet": slet reglen
6. Deaktiver alle kilde-produkter med `merged_into_product_id`

### Tekniske detaljer

**Fil: `src/components/mg-test/ProductMergeDialog.tsx`**

- Ny interface `RuleAction = { ruleId: string; action: 'keep' | 'end' | 'delete'; endDate?: string }`
- Ny state: `ruleActions: Map<string, RuleAction>`, `mergedProductName: string`
- Fjern `targetKey`/`targetProduct` state og logik
- Step 2: Fjern "Vælg som target"-knap, kræv kun min. 2 valgte
- Step 3: Fetch og vis pricing rules med action-valg per regel
- Step 4: Produktnavn-input + opsummering
- `handleMerge()`: Opret/genbrug produkt, håndter regler efter brugerens valg

