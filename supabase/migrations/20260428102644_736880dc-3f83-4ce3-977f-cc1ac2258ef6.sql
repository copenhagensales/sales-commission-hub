
-- =============================================================================
-- 1. CLEANUP: Reject existing ASE duplicates (same sale_id + member_number)
-- =============================================================================
WITH ase_client AS (
  SELECT id FROM public.clients WHERE lower(btrim(name)) = 'ase' LIMIT 1
),
ase_queue AS (
  SELECT
    cq.id,
    cq.sale_id,
    cq.created_at,
    cq.deduction_date,
    cq.uploaded_data,
    btrim(coalesce(
      cq.uploaded_data->>'Medlemsnummer',
      cq.uploaded_data->>'medlemsnummer',
      cq.uploaded_data->>'Member Number',
      cq.uploaded_data->>'Member number'
    )) AS member_number,
    -- "Completeness score": prefers rows that have deduction_date AND provision data
    (CASE WHEN cq.deduction_date IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN cq.uploaded_data ? 'Provision' AND cq.uploaded_data->'Provision' IS NOT NULL AND cq.uploaded_data->>'Provision' <> '' THEN 1 ELSE 0 END)
    + (CASE WHEN cq.uploaded_data ? 'CPO' AND cq.uploaded_data->'CPO' IS NOT NULL AND cq.uploaded_data->>'CPO' <> '' THEN 1 ELSE 0 END)
      AS completeness
  FROM public.cancellation_queue cq
  JOIN ase_client a ON a.id = cq.client_id
  WHERE cq.upload_type = 'cancellation'
    AND cq.status = 'approved'
),
ranked AS (
  SELECT
    aq.*,
    ROW_NUMBER() OVER (
      PARTITION BY aq.sale_id, aq.member_number
      ORDER BY aq.completeness DESC, aq.created_at ASC, aq.id ASC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY aq.sale_id, aq.member_number) AS dup_count
  FROM ase_queue aq
  WHERE aq.member_number IS NOT NULL AND aq.member_number <> ''
)
UPDATE public.cancellation_queue cq
SET status = 'rejected',
    reviewed_at = COALESCE(cq.reviewed_at, now()),
    uploaded_data = COALESCE(cq.uploaded_data, '{}'::jsonb)
      || jsonb_build_object(
           '_dedup_rejected_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           '_dedup_reason', 'ase_member_number_duplicate'
         )
FROM ranked r
WHERE r.id = cq.id
  AND r.rn > 1
  AND r.dup_count > 1;

-- =============================================================================
-- 2. CLEANUP: General duplicates per (client_id, sale_id, upload_type, target_product_name)
--    Keep oldest, reject the rest. Skips already-rejected rows.
-- =============================================================================
WITH active AS (
  SELECT
    id, client_id, sale_id, upload_type,
    lower(btrim(coalesce(target_product_name, ''))) AS norm_product,
    created_at
  FROM public.cancellation_queue
  WHERE status IN ('pending', 'approved')
),
ranked AS (
  SELECT
    a.*,
    ROW_NUMBER() OVER (
      PARTITION BY a.client_id, a.sale_id, a.upload_type, a.norm_product
      ORDER BY a.created_at ASC, a.id ASC
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY a.client_id, a.sale_id, a.upload_type, a.norm_product
    ) AS dup_count
  FROM active a
)
UPDATE public.cancellation_queue cq
SET status = 'rejected',
    reviewed_at = COALESCE(cq.reviewed_at, now()),
    uploaded_data = COALESCE(cq.uploaded_data, '{}'::jsonb)
      || jsonb_build_object(
           '_dedup_rejected_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           '_dedup_reason', 'sale_product_duplicate'
         )
FROM ranked r
WHERE r.id = cq.id
  AND r.rn > 1
  AND r.dup_count > 1;

-- =============================================================================
-- 3. PREVENT FUTURE DUPLICATES: Partial unique index on active rows
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS cancellation_queue_unique_active_sale_product
ON public.cancellation_queue (
  client_id,
  sale_id,
  upload_type,
  (lower(btrim(coalesce(target_product_name, ''))))
)
WHERE status IN ('pending', 'approved');

-- =============================================================================
-- 4. ASE-SPECIFIC GUARD: Block duplicate member_number on same sale
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prevent_cancellation_queue_ase_member_dup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ase_client_id uuid;
  v_member_number text;
  v_existing_id uuid;
BEGIN
  -- Only check active rows
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_ase_client_id
  FROM public.clients
  WHERE lower(btrim(name)) = 'ase'
  LIMIT 1;

  IF v_ase_client_id IS NULL OR NEW.client_id IS DISTINCT FROM v_ase_client_id THEN
    RETURN NEW;
  END IF;

  v_member_number := btrim(coalesce(
    NEW.uploaded_data->>'Medlemsnummer',
    NEW.uploaded_data->>'medlemsnummer',
    NEW.uploaded_data->>'Member Number',
    NEW.uploaded_data->>'Member number'
  ));

  IF v_member_number IS NULL OR v_member_number = '' THEN
    RETURN NEW;
  END IF;

  SELECT cq.id INTO v_existing_id
  FROM public.cancellation_queue cq
  WHERE cq.client_id = v_ase_client_id
    AND cq.sale_id = NEW.sale_id
    AND cq.upload_type = NEW.upload_type
    AND cq.status IN ('pending', 'approved')
    AND cq.id IS DISTINCT FROM NEW.id
    AND btrim(coalesce(
          cq.uploaded_data->>'Medlemsnummer',
          cq.uploaded_data->>'medlemsnummer',
          cq.uploaded_data->>'Member Number',
          cq.uploaded_data->>'Member number'
        )) = v_member_number
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Dublet annullering: ASE-medlemsnummer % findes allerede aktivt på dette salg (eksisterende række: %)', v_member_number, v_existing_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_cancellation_queue_ase_member_dup_trg ON public.cancellation_queue;

CREATE TRIGGER prevent_cancellation_queue_ase_member_dup_trg
BEFORE INSERT OR UPDATE ON public.cancellation_queue
FOR EACH ROW
EXECUTE FUNCTION public.prevent_cancellation_queue_ase_member_dup();
