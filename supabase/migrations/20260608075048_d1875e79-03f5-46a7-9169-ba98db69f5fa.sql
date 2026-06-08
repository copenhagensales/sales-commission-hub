
CREATE OR REPLACE FUNCTION public.get_relatel_product_counts(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  mobile_voice bigint,
  mobilt_bredbaand bigint,
  switch_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH relatel_campaigns AS (
    SELECT cc.id
    FROM public.client_campaigns cc
    JOIN public.clients c ON c.id = cc.client_id
    WHERE c.name ILIKE 'Relatel'
  ),
  categorized AS (
    SELECT
      si.quantity,
      LOWER(p.name) AS lname
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    JOIN public.products p ON p.id = si.product_id
    WHERE s.client_campaign_id IN (SELECT id FROM relatel_campaigns)
      AND s.sale_datetime >= p_from
      AND s.sale_datetime <= p_to
      AND (s.validation_status IS NULL OR s.validation_status <> 'rejected')
  )
  SELECT
    COALESCE(SUM(CASE WHEN lname LIKE '%fri tale%' THEN quantity ELSE 0 END), 0)::bigint AS mobile_voice,
    COALESCE(SUM(CASE WHEN lname LIKE '%mbb%' OR lname LIKE '%mobilt bredbånd%' OR lname LIKE '%mobilt bredbaand%' THEN quantity ELSE 0 END), 0)::bigint AS mobilt_bredbaand,
    COALESCE(SUM(CASE WHEN lname LIKE '%contact center%' OR lname LIKE '%professionel omstilling%' OR lname LIKE '%unlimited%' OR lname LIKE '%omstilling til brugere%' THEN quantity ELSE 0 END), 0)::bigint AS switch_count
  FROM categorized;
$$;

GRANT EXECUTE ON FUNCTION public.get_relatel_product_counts(timestamptz, timestamptz) TO authenticated, anon;
