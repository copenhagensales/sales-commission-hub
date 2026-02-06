

# Plan: Ret historiske sale_items med manglende provision

## Opgave

Opdater de **3.679 historiske sale_items** som har `mapped_commission = 0` selvom deres produkter har base-priser.

---

## Løsning

### Trin 1: Opdater `rematch-pricing-rules` edge function

Tilføj fallback til produktets base-pris når ingen prisregel matcher:

**Ændringer i `supabase/functions/rematch-pricing-rules/index.ts`:**

1. Hent alle produkter med base-priser ved start
2. I processeringsloopet: Hvis ingen prisregel matcher, brug produktets `commission_dkk` og `revenue_dkk`
3. Tilføj statistik for "baseProductFallback" i respons

### Trin 2: Kør funktionen

Kør edge function uden source-filter for at rette alle historiske data:

```json
{ "dry_run": false }
```

---

## Forventet resultat

| Kategori | Antal | Ny provision |
|----------|-------|--------------|
| Partnersalg FF-TRYG | 1.557 | 75 kr |
| Har Ændret - FF | 703 | 25 kr |
| Partnersalg FDM-TRYG | 258 | 75 kr |
| Lead (ASE) | 236 | 65 kr |
| 5GI (Eesy) | 160 | 300 kr |
| Andre | 765 | Varierende |

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/rematch-pricing-rules/index.ts` | Tilføj fallback til produktets base-pris |

---

## Sikkerhed

- Kun opdaterer sale_items med `mapped_commission = 0`
- `matched_pricing_rule_id` forbliver `NULL` (indikerer base-pris blev brugt)
- KPI-cache opdateres automatisk efterfølgende

