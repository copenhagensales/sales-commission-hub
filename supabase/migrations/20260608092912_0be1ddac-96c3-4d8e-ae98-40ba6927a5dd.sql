WITH relatel_campaigns AS (
  SELECT id FROM public.client_campaigns WHERE client_id = '0ff8476d-16d8-4150-aee9-48ac90ec962d'
),
relatel_products AS (
  SELECT DISTINCT p.id, p.name, p.commission_dkk AS base_comm, p.revenue_dkk AS base_rev
  FROM public.products p
  WHERE p.is_active IS NOT FALSE
    AND p.commission_dkk > 0
    AND EXISTS (
      SELECT 1 FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      WHERE si.product_id = p.id
        AND s.client_campaign_id IN (SELECT id FROM relatel_campaigns)
        AND s.sale_datetime >= '2026-01-01'
    )
),
existing AS (
  SELECT product_id,
    BOOL_OR(is_active AND effective_from = '2026-05-15'
            AND (conditions IS NULL OR conditions = '{}'::jsonb OR (conditions->>'Tilskud') IS NULL)
            AND (campaign_mapping_ids IS NULL OR COALESCE(array_length(campaign_mapping_ids,1),0) = 0
                 OR array_length(campaign_mapping_ids,1) >= 50)
    ) AS slot_provision_fyldt,
    BOOL_OR(is_active AND effective_from = '2026-05-15'
            AND (conditions->>'Tilskud') = '0%'
            AND (campaign_mapping_ids IS NULL OR COALESCE(array_length(campaign_mapping_ids,1),0) = 0
                 OR array_length(campaign_mapping_ids,1) >= 50)
    ) AS slot_tilskud_fyldt,
    MAX(CASE WHEN is_active AND (conditions->>'Tilskud') = '0%'
              AND COALESCE(effective_from,'1900-01-01') < '2026-05-15'
              AND (campaign_mapping_ids IS NULL OR COALESCE(array_length(campaign_mapping_ids,1),0) = 0
                   OR array_length(campaign_mapping_ids,1) >= 50)
            THEN commission_dkk END) AS gammel_tilskud_comm,
    MAX(CASE WHEN is_active AND (conditions->>'Tilskud') = '0%'
              AND COALESCE(effective_from,'1900-01-01') < '2026-05-15'
              AND (campaign_mapping_ids IS NULL OR COALESCE(array_length(campaign_mapping_ids,1),0) = 0
                   OR array_length(campaign_mapping_ids,1) >= 50)
            THEN revenue_dkk END) AS gammel_tilskud_rev
  FROM public.product_pricing_rules
  GROUP BY product_id
),
prov_rules AS (
  SELECT rp.id AS product_id,
         'NY provision (2026-05-15, +10%)' AS rule_name,
         ROUND(rp.base_comm * 1.10, 2) AS commission_dkk,
         rp.base_rev AS revenue_dkk
  FROM relatel_products rp
  LEFT JOIN existing e ON e.product_id = rp.id
  WHERE LOWER(rp.name) NOT LIKE '%mbb%'
    AND NOT COALESCE(e.slot_provision_fyldt, false)
),
tilskud_rules AS (
  SELECT rp.id AS product_id,
         'Ny tilskud (2026-05-15, 20%)' AS rule_name,
         ROUND(
           (CASE WHEN LOWER(rp.name) LIKE '%mbb%' THEN rp.base_comm ELSE rp.base_comm * 1.10 END)
           + ((e.gammel_tilskud_comm - rp.base_comm) / 0.125) * 0.20
         , 2) AS commission_dkk,
         COALESCE(e.gammel_tilskud_rev, rp.base_rev) AS revenue_dkk
  FROM relatel_products rp
  JOIN existing e ON e.product_id = rp.id
  WHERE NOT COALESCE(e.slot_tilskud_fyldt, false)
    AND e.gammel_tilskud_comm IS NOT NULL
    AND e.gammel_tilskud_comm > rp.base_comm
)
INSERT INTO public.product_pricing_rules
  (product_id, name, commission_dkk, revenue_dkk, priority, is_active,
   conditions, campaign_mapping_ids, effective_from, campaign_match_mode)
SELECT product_id, rule_name, commission_dkk, revenue_dkk,
       0, true,
       '{}'::jsonb, NULL::uuid[], '2026-05-15'::date, 'include'
FROM prov_rules
UNION ALL
SELECT product_id, rule_name, commission_dkk, revenue_dkk,
       0, true,
       '{"Tilskud":"0%"}'::jsonb, NULL::uuid[], '2026-05-15'::date, 'include'
FROM tilskud_rules;