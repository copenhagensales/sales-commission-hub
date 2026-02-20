

## Fix: FM provision matcher forkert prisregel

### Problem
Database-triggeren `create_fm_sale_items_fn` ignorerer `campaign_mapping_ids` feltet i `product_pricing_rules` tabellen. Den vælger blot den "nyeste" regel for et givet produkt, uanset hvilken kampagne salget tilhorer.

For eksempel for "Eesy uden forste maaned (IKKE Nuuday)":
- Eesy **gaden** kampagne: 450 kr provision
- Eesy **marked** kampagne: 385 kr provision

Resultatet er, at alle FM-salg far den samme provision (typisk 385 kr), uanset om de er fra gaden eller marked.

### Lossning
Opdater trigger-funktionen `create_fm_sale_items_fn` sa den:

1. Henter salgets `client_campaign_id` (som allerede er sat af `enrich_fm_sale` triggeren)
2. Finder den tilsvarende `adversus_campaign_mapping` for den campaign
3. Matcher `campaign_mapping_ids` i `product_pricing_rules` mod den korrekte mapping
4. Falder tilbage til en regel UDEN campaign-restriction hvis ingen match findes
5. Falder til sidst tilbage til base product prices

### Tekniske detaljer

**Database migration** - opdater funktionen:

```sql
CREATE OR REPLACE FUNCTION create_fm_sale_items_fn() ...
```

Kerneandrring i pricing rule lookup:

```text
-- 1. Find adversus_campaign_mapping_id for salgets client_campaign
SELECT id INTO v_campaign_mapping_id
FROM adversus_campaign_mappings
WHERE client_campaign_id = NEW.client_campaign_id
LIMIT 1;

-- 2. Forsog forst kampagne-specifik regel
SELECT commission_dkk, revenue_dkk INTO v_rule_commission, v_rule_revenue
FROM product_pricing_rules
WHERE product_id = v_product_id AND is_active = true
  AND v_campaign_mapping_id = ANY(campaign_mapping_ids)
ORDER BY priority DESC NULLS LAST
LIMIT 1;

-- 3. Fallback: universel regel (ingen campaign restriction)
IF v_rule_commission IS NULL THEN
  SELECT commission_dkk, revenue_dkk INTO v_rule_commission, v_rule_revenue
  FROM product_pricing_rules
  WHERE product_id = v_product_id AND is_active = true
    AND (campaign_mapping_ids IS NULL OR campaign_mapping_ids = '{}')
  ORDER BY priority DESC NULLS LAST
  LIMIT 1;
END IF;
```

**Rettelse af eksisterende data** - korra allerede forkerte sale_items via SQL update der gen-matcher med korrekt campaign.

### Trin

1. Deploy ny trigger-funktion med campaign-aware pricing lookup
2. Kor data-fix pa eksisterende sale_items der har forkert provision
3. Trigger leaderboard/KPI recalculation sa dashboardet opdateres

