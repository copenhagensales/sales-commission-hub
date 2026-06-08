CREATE OR REPLACE FUNCTION public.get_relatel_product_counts(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(mobile_voice bigint, mobilt_bredbaand bigint, switch_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH relatel_campaigns AS (
    SELECT cc.id
    FROM client_campaigns cc
    JOIN clients c ON c.id = cc.client_id
    WHERE c.name ILIKE 'Relatel'
  ),
  categorized AS (
    SELECT
      si.quantity,
      CASE
        WHEN LOWER(p.name) LIKE '%fri tale%' THEN 'mobile_voice'
        WHEN LOWER(p.name) LIKE '%mbb%'
          OR LOWER(p.name) LIKE '%mobilt bredbånd%'
          OR LOWER(p.name) LIKE '%mobilt bredbaand%' THEN 'mobilt_bredbaand'
        WHEN LOWER(p.name) LIKE '%contact center%'
          OR LOWER(p.name) LIKE '%professionel%'
          OR LOWER(p.name) LIKE '%professional%'
          OR LOWER(p.name) LIKE '%unlimited%'
          OR LOWER(p.name) LIKE '%omstilling%' THEN 'switch'
        ELSE NULL
      END AS category
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN products p ON p.id = si.product_id
    WHERE s.client_campaign_id IN (SELECT id FROM relatel_campaigns)
      AND s.sale_datetime >= p_from
      AND s.sale_datetime <= p_to
      AND COALESCE(s.validation_status, '') <> 'rejected'
  )
  SELECT
    COALESCE(SUM(CASE WHEN category = 'mobile_voice' THEN COALESCE(quantity,1) END), 0)::bigint,
    COALESCE(SUM(CASE WHEN category = 'mobilt_bredbaand' THEN COALESCE(quantity,1) END), 0)::bigint,
    COALESCE(SUM(CASE WHEN category = 'switch' THEN COALESCE(quantity,1) END), 0)::bigint
  FROM categorized;
$$;