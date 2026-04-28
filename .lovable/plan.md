# Eesy TM pricing-oprydning — endelig plan

## TL;DR
9 parent-produkter på Eesy TM. Du har givet den definitive prisliste. Vi rydder ~85 dubletregler op til præcis 18 (2 pr. produkt: standard + specialkampagne), backfiller `client_campaign_id`, opdaterer `products`-tabellens fallback-priser, tilføjer beskyttelse mod fremtidige dubletter, og rematcher alt 2026-data. Merge-strukturen bevares uændret — child-produkter arver automatisk parent's pricing rules.

---

## Sandheden (din endelige prisliste)

| Parent-produkt | Product ID | Std prov | Special prov | CPO |
|---|---|---|---|---|
| 5G MBB | `72c4a439…` | 300 | 225 | 650 |
| Fri tale + 110 | `5e20993c…` | 375 | 260 | 700 |
| Fri tale + 150 GB data (5G) (6 mdr. binding) | `d1bc3454…` | 375 | 275 | 750 |
| Fri tale + 170 GB | `2810fbad…` | 375 | 275 | 750 |
| Fri tale + 20 GB data (6 mdr. binding) | `f18da6d2…` | 250 | 190 | 550 |
| Fri tale + 30 GB data | `b95e648d…` | 250 | 190 | **550** |
| Fri Tale + 70 GB | `c44aa333…` | 300 | 225 | 625 |
| Fri tale + fri data | `21a7f7aa…` | 375 | 275 | 750 |
| Ekstra Frifri (= Fri tale + fri data 5G 109 kr) | `bd58176b…` | 350 | 260 | 700 |

**Specialkampagne-mappings:** `Pricebook Internet Tjek` (`159413c4…`) + `Admill - Valino` (`20f9af1f…`).

---

## Merge-struktur — bevares uændret

Vi rører ikke `merged_into_product_id`. Pricing-motoren matcher kun på parent (det er allerede sådan `pricingRuleMatching.ts` virker). Eksempler:

- `5G MBB` parent → 3 deaktiverede 5GI-children peger ind. Alle nye 5GI-salg får 5G MBB's rule.
- `Fri tale + 110` parent → 2 children (110 GB 5G + 110 GB 5G 10% rabat).
- `Fri tale + 30 GB data` parent → 1 child ("(6 mdr. binding)").

Børn beholder deres historiske `commission_dkk`/`revenue_dkk` for sale_items der ALLEREDE er matchet — vi rematcher kun fremadrettet og for 2026.

---

## Eksekvering

### Steg 1 — Backfill `products.client_campaign_id` på alle 9 parents
I dag har kun 4/9 parents sat `client_campaign_id`. Vi sætter `d031126c-aec0-4b80-bbe2-bbc31c4f04ba` (Eesy TM Products) på alle 9 parents.

### Steg 2 — Opdater `products.commission_dkk` / `revenue_dkk` til **standard**-pris
Så fallback (når ingen rule matcher) giver standard, ikke special. Ændringer:

| Produkt | Før (commission/revenue) | Efter |
|---|---|---|
| Fri tale + 30 GB data | 250 / 500 | 250 / **550** |
| Fri Tale + 70 GB | 300 / 600 | 300 / **625** |

Resten matcher allerede prislisten.

### Steg 3 — Konsolidér pricing rules
For hvert af de 9 parent-produkter:
1. **Deaktivér** alle eksisterende rules (`is_active = false`, ingen sletning — historik bevares)
2. **Opret 2 nye rules** med `effective_from = 2026-01-01`:
   - **"Standard 2026"** — alle Eesy mappings UNDTAGEN special-mappings, std pris, `priority = 0`
   - **"Specialkampagne 2026"** — kun `Pricebook Internet Tjek` + `Admill Valino`, special pris, `priority = 10`

`campaign_match_mode = 'include'` for begge.

**Resultat:** 18 aktive rules i alt på Eesy TM (2 × 9 produkter).

### Steg 4 — UNIQUE-constraint mod fremtidige dubletter
```sql
CREATE UNIQUE INDEX idx_pricing_rules_unique_per_product_period
ON product_pricing_rules (product_id, effective_from, COALESCE(name, ''))
WHERE is_active = true;
```
Tvinger oprydning hvis nogen prøver at duplikere en rule for samme produkt fra samme dato med samme navn. Pragmatisk — fanger 95% af utilsigtede dubletter uden at blokere bevidste varianter.

### Steg 5 — Rematch alt 2026 Eesy TM-data
Kør `rematch-pricing-rules` edge function:
```ts
{ effective_from_date: '2026-01-01' }
```
Forventet: ~2.000-3.000 sale_items opdateres med konsistente priser.

### Steg 6 — Verificering
Generér `/mnt/documents/eesy-pricing-fix-report.csv` med før/efter pr. produkt:
- `sales_count`, `total_commission`, `total_revenue`
- `matched_pricing_rule_id` distribution
- Liste af deaktiverede rule-IDs (for rollback)

---

## Før/efter-tal (estimat)

| Måling | Før | Efter |
|---|---|---|
| Aktive rules på 9 Eesy TM parents | ~85 | 18 |
| Parents med `client_campaign_id` sat | 4/9 | 9/9 |
| Sale_items i april med `matched_pricing_rule_id` | ~30% | ~95% |
| Dubletter per produkt-mapping kombination | 2-4 | 1 |
| Risiko for tilfældig prisvalg | Høj | Nul |
| Total april-revenue | ~830.000 kr | ~830.000 kr ±2% (mest konsistens, lille drift hvor special-mappings før blev fejl-matchet) |

---

## Risici og rollback
- **Deaktiverede rules slettes IKKE.** Rollback = sæt `is_active = true` igen og kør rematch.
- **CSV-backup** med alle ændrede rule-IDs gemmes i `/mnt/documents/`.
- **Specialkampagne-mappings:** Hvis flere mappings end `Pricebook Internet Tjek` + `Admill Valino` skal tælle som "special", siger du det nu.
- **Zone:** RØD (pricing-motor). Din godkendelse af denne plan udgør den eksplicitte godkendelse principperne kræver.

---

## Hvad jeg IKKE rører
- Merge-struktur (`merged_into_product_id`) — uændret
- Børn-produkter (de er inaktive og bruges kun til historik)
- `product_campaign_overrides` (åben beslutning §7)
- Andre klienter
- `pricingRuleMatching.ts` / `_shared/pricing-service.ts` (logikken er korrekt)

---

**Klar til eksekvering ved din godkendelse.** Leveres som én migration (steg 1, 4) + insert-tool kald for data-updates (steg 2, 3) + ét edge-funktion-kald (steg 5) + en CSV-rapport (steg 6).
