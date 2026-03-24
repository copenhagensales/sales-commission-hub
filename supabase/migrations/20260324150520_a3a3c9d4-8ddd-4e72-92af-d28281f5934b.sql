
CREATE OR REPLACE FUNCTION public.rollback_cancellation_import(p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_approved_count integer := 0;
  v_pending_count integer := 0;
  v_sale_ids uuid[];
  v_sale_id uuid;
BEGIN
  -- 1. Get all approved queue items for this import and collect sale_ids
  SELECT array_agg(DISTINCT sale_id) INTO v_sale_ids
  FROM cancellation_queue
  WHERE import_id = p_import_id AND status = 'approved';

  -- 2. Reverse sale_items.is_cancelled for affected sales
  IF v_sale_ids IS NOT NULL THEN
    UPDATE sale_items
    SET is_cancelled = false
    WHERE sale_id = ANY(v_sale_ids)
      AND is_cancelled = true;

    -- 3. Reverse sales.validation_status back from 'cancelled'
    UPDATE sales
    SET validation_status = 'approved'
    WHERE id = ANY(v_sale_ids)
      AND validation_status = 'cancelled';
  END IF;

  -- 4. Count items
  SELECT count(*) INTO v_approved_count FROM cancellation_queue WHERE import_id = p_import_id AND status = 'approved';
  SELECT count(*) INTO v_pending_count FROM cancellation_queue WHERE import_id = p_import_id AND status = 'pending';

  -- 5. Delete all queue items for this import
  DELETE FROM cancellation_queue WHERE import_id = p_import_id;

  -- 6. Delete the import record
  DELETE FROM cancellation_imports WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'reversed_approved', v_approved_count,
    'removed_pending', v_pending_count,
    'reversed_sales', COALESCE(array_length(v_sale_ids, 1), 0)
  );
END;
$$;
