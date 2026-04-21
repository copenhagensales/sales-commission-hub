

## Engangs-migration: Følg `merged_into_product_id` for alle eksisterende sale_items

### Hvad jeg fandt

5 deaktiverede (mergede) produkter har i alt **566 sale_items** der peger på dem i stedet for masteren — derfor rammer fx 225 kr.-reglen ikke 5GI-salgene (de tager 300 kr. fallback fra det gamle produkts `commission_dkk`).

| Items | Gammelt (merged) produkt | Master |
|---|---|---|
| 275 | Fri tale + 70 GB data (5G) (6 mdr. binding) | Fri Tale + 70 GB |
| 209 | 5GI - 279 kr. (3 måneder 129 kr) | **5G MBB** |
| 68 | Fri tale + fri data (5G) (EKSTRASIM) | Fri tale + fri data (5G) 109 kr |
| 10 | Fri tale + 110 GB data (5G) | Fri tale + 110 |
| 4 | 5GI - 279 kr. (2 måneder 99 kr) | **5G MBB** |

Master-produkterne (fx `5G MBB` og `Fri Tale + 70 GB`) har de korrekte aktive prisregler, så det eneste der mangler er at flytte `sale_items.product_id` over på masteren og køre rematch.

### Migration (kun engangs — ingen ingestion-kodeændringer i denne omgang)

**Ét SQL-statement** der opdaterer alle berørte rækker via JOIN på `products.merged_into_product_id`:

```sql
UPDATE sale_items si
SET product_id = p.merged_into_product_id,
    matched_pricing_rule_id = NULL,
    needs_mapping = false
FROM products p
WHERE si.product_id = p.id
  AND p.merged_into_product_id IS NOT NULL;
```

- Forventet: ~566 rækker opdateret
- `matched_pricing_rule_id = NULL` tvinger rematch til at re-evaluere reglen
- Sættes som regulær Supabase migration (skal køres med din standard godkendelse)

**Derefter trigges rematch** for at lægge de korrekte commission/revenue-tal ind:

```ts
await supabase.functions.invoke("rematch-pricing-rules", { body: {} });
```

Jeg kører den invoke direkte efter migrationen er gået igennem. Edge functionen plukker netop alle items hvor `matched_pricing_rule_id IS NULL`, finder den rigtige regel via campaign_mapping_id (de mergede 5GI-salg ligger på 5G-kampagner som er listet i 5G MBB-reglens `campaign_mapping_ids`), og opdaterer `mapped_commission` til 225 × qty.

### Verificering (efter kørsel)

- `SELECT COUNT(*) FROM sale_items si JOIN products p ON p.id = si.product_id WHERE p.merged_into_product_id IS NOT NULL;` → **0**
- 5GI-salget i screenshot'et: `mapped_commission` går fra 300 → 225 (eller 225 × quantity)
- Spot-check: `SELECT mapped_commission, mapped_revenue, matched_pricing_rule_id FROM sale_items WHERE product_id = '72c4a439-22c0-4db1-836b-a578d56fe81e' ORDER BY updated_at DESC LIMIT 10;` viser 225/650 og en `matched_pricing_rule_id`

### Hvad jeg IKKE rør i denne kørsel

- Ingestion-koden (`adversus-webhook`, `dialer-webhook`, `adversus-sync-v2`) — ingen ændringer nu, kun engangs-migration som du bad om
- `rematch-pricing-rules` edge function — uændret (den virker fint så snart product_id peger på masteren)
- `product_pricing_rules`, kampagner, andre produkter
- De 15 mergede produkter selv (de forbliver `is_active = false` med `merged_into_product_id` peger korrekt)

### Bemærkning til senere (ikke en del af denne opgave)
Næste gang en ny 5GI-mapping kommer ind via Adversus, vil den igen ramme det gamle produkt-id og falde tilbage til 300 kr. Permanent fix kræver enten: (a) at ingestion følger `merged_into_product_id`, eller (b) at pricing-engine'en gør det som sikkerhedsnet. Sig til når du vil have det permanente fix også.

