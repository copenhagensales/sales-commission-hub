CREATE OR REPLACE FUNCTION public.get_fm_registration_products(p_campaign_id uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH camp AS (
    SELECT cc.id, cc.client_id
    FROM client_campaigns cc
    WHERE cc.id = p_campaign_id
  ),
  is_eesy_fm AS (
    SELECT EXISTS (
      SELECT 1
      FROM camp c
      JOIN clients cl ON cl.id = c.client_id
      WHERE lower(trim(cl.name)) = 'eesy fm'
    ) AS ok
  ),
  sibling_campaigns AS (
    SELECT cc.id
    FROM client_campaigns cc
    JOIN camp c ON c.client_id = cc.client_id
  ),
  maps AS (
    SELECT COALESCE(array_agg(m.id), '{}'::uuid[]) AS ids
    FROM adversus_campaign_mappings m
    WHERE m.client_campaign_id = p_campaign_id
  ),
  base AS (
    SELECT p.id, p.name, 0 AS pref
    FROM products p
    WHERE p.client_campaign_id = p_campaign_id
      AND p.is_active = true
  ),
  extra AS (
    SELECT DISTINCT p.id, p.name, 1 AS pref
    FROM products p
    JOIN product_pricing_rules r ON r.product_id = p.id AND r.is_active = true
    CROSS JOIN maps
    WHERE p.is_active = true
      AND (SELECT ok FROM is_eesy_fm)
      AND p.client_campaign_id IN (SELECT id FROM sibling_campaigns)
      AND r.campaign_match_mode = 'include'
      AND r.campaign_mapping_ids && maps.ids
  ),
  u AS (
    SELECT * FROM base
    UNION ALL
    SELECT * FROM extra
  )
  SELECT DISTINCT ON (lower(trim(u.name))) u.id, u.name
  FROM u
  ORDER BY lower(trim(u.name)), u.pref DESC, u.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_fm_registration_products(uuid) TO authenticated;