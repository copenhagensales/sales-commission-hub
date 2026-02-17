

# Rematch alle ASE-salg med opdaterede prisregler

## Baggrund
Prisreglen "A-kasse uden straksbetaling under 6000 lønsikring" er opdateret til intervallet 1-5999 (tidligere 0-5999). Alle eksisterende ASE-salg skal genmatches for at sikre korrekte provisioner.

## Forventet resultat efter rematch

| Scenarie | Daekningssum | Regel | Provision |
|----------|-------------|-------|-----------|
| Uden loensikring (beriget til 0) | 0 | Basisregel (prio 1) | 400 kr |
| Reel daekningssum 1-5999 | 1-5999 | Under 6000 (prio 2) | 600 kr |
| Med loensikring (beriget til 6000) | 6000+ | Over 6000 (prio 3) | 800 kr |

## Plan

### Trin 1: Nulstil matched_pricing_rule_id paa ASE Salg
Saet `matched_pricing_rule_id = NULL` paa alle sale_items med ASE Salg-produktet, saa de kan genmatches:

```text
UPDATE sale_items
SET matched_pricing_rule_id = NULL
WHERE product_id = '1ad52862-2102-472e-9cdf-52f9c76997a2'
```

### Trin 2: Koer rematch for ASE Salg
Kald `rematch-pricing-rules` edge-funktionen med product_id for ASE Salg. Da Supabase har en 1000-raekke graense, koeres funktionen gentagne gange indtil alle er behandlet.

### Trin 3: Nulstil og rematch ASE Lead
Gentag trin 1-2 for ASE Lead-produktet (`e360f3c2-b448-474b-bbf8-e7dc629a0d2a`).

### Trin 4: Verificer
- Tjek at ingen salg har `matched_pricing_rule_id = NULL` tilbage
- Bekraeft at `is_immediate_payment`-flaget er bevaret paa de salg der havde det

## Teknisk note
- Ingen kodeaendringer noedvendige -- edge-funktionen haandterer allerede data-enrichment (Daekningssum=0 eller 6000) og det opdaterede regelinterval
- `is_immediate_payment` pavirkes ikke af rematch, da feltet bevidst udelades fra update-payloaden
- Funktionen skal maaske koeres 2-3 gange per produkt pga. 1000-raekke graensen

