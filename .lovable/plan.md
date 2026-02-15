

# Fix: ASE prisregler matcher forkert - manglende provision

## Problem
206 ASE-salg rammer den lavprioriterede fallback-regel (400 kr provision) i stedet for de korrekte Daekningssum-baserede regler (600/800 kr). To separate fejl:

1. **Daekningssum-betingelsen ekskluderer 0**: Reglen "under 6000 loensikring" kraever `between 1-5999`, men data-berigelsen saetter Daekningssum=0 for salg uden loensikring. Vaerdien 0 falder uden for intervallet.

2. **Reglerne har unodvendig datobegr. (effective_from)**: De hojprioriterede regler gaelder kun fra 11. feb 2026. 189 salg foer denne dato matcher kun fallback-reglen.

## Loesning

### Trin 1: Opdater prisregler i databasen

Kora SQL-migration der:

1. Aendrer "under 6000 loensikring" Loenmodtager-reglen (id: `c3296963`):
   - Daekningssum-betingelse fra `between 1-5999` til `between 0-5999`
   - Fjern `effective_from` (saet til NULL)

2. Aendrer "over 6000 loensikring" Loenmodtager-reglen (id: `edafbf2e`):
   - Fjern `effective_from` (saet til NULL)

3. Aendrer "over 6000 Selvstaendig" reglen (id: `1546cfe6`):
   - Fjern `effective_from` (saet til NULL)

4. Aendrer "Selvstaendig uden straks" reglen (id: `1ca3463a`):
   - Fjern `effective_from` (saet til NULL)

### Trin 2: Kor rematch

Kald `rematch-pricing-rules` edge function med `product_id` for ASE Salg-produktet for at opdatere alle eksisterende salg med de korrekte provisioner.

### Forventet effekt

- Salg UDEN loensikring (Daekningssum=0): 400 kr -> 600 kr provision (standard) / 1.000 -> 1.200 kr (straks)
- Salg MED loensikring (Daekningssum>=6000): 400 kr -> 800 kr provision (standard) / 1.000 -> 1.400 kr (straks)
- Gaelder nu for alle salg uanset dato

### Tekniske detaljer

SQL for regelopdatering:
```text
-- Fix Daekningssum between 0-5999 (inkluder 0)
UPDATE product_pricing_rules
SET conditions = jsonb_set(
  conditions::jsonb,
  '{Dækningssum}',
  '{"operator":"between","value":0,"value2":5999}'
),
effective_from = NULL
WHERE id = 'c3296963-0c24-4977-9f16-8882a77d2db7';

-- Fjern datobegr. paa ovrige regler
UPDATE product_pricing_rules
SET effective_from = NULL
WHERE id IN (
  'edafbf2e-54f3-41a1-a96c-9a819392c31b',
  '1546cfe6-6479-4781-9373-9ce6e338ad78',
  '1ca3463a-efa3-4ec1-a844-36449e31f2c9'
);
```

Derefter rematch via edge function:
```text
POST rematch-pricing-rules
{ "product_id": "1ad52862-2102-472e-9cdf-52f9c76997a2" }
```

### Ingen kodeaendringer
Fejlen er udelukkende i prisregel-konfigurationen i databasen. Hverken frontend eller backend-kode skal aendres.
